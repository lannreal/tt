#!/usr/bin/env node
// Enhanced Diagnostic script - testing binary & navigation matrices
const { spawn } = require('child_process');
const net = require('net');
const os = require('os');
const path = require('path');
const fs = require('fs');

async function testConfig(name, browserBinary, extraArgs, navMethod) {
    console.log(`\n========================================`);
    console.log(`TEST: ${name}`);
    console.log(`Binary: ${browserBinary}`);
    console.log(`Args: ${extraArgs.join(' ')}`);
    console.log(`Nav method: ${navMethod}`);
    console.log(`========================================`);

    const port = await new Promise(res => {
        const s = net.createServer();
        s.listen(0, '127.0.0.1', () => {
            const p = s.address().port;
            s.close(() => res(p));
        });
    });

    const tmpDir = path.join(process.env.TMPDIR || os.tmpdir(), `tt_test_${Date.now()}`);
    const args = [
        `--remote-debugging-port=${port}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--ignore-certificate-errors',
        '--disable-web-security',
        `--user-data-dir=${tmpDir}`,
        ...extraArgs
    ];

    const proc = spawn(browserBinary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', d => stderr += d.toString());

    let ready = false;
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 200));
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(300) });
            if (res.ok) { ready = true; break; }
        } catch (e) {}
    }

    if (!ready) {
        console.log('❌ FAILED to start CDP. Stderr:', stderr.slice(0, 300));
        try { proc.kill(); } catch(e) {}
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
        return false;
    }

    console.log('✅ CDP Ready!');

    let tabWsUrl = '';
    try {
        const listRes = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) });
        const tabs = await listRes.json();
        const tab = tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        tabWsUrl = tab?.webSocketDebuggerUrl;
    } catch(e) {}

    if (!tabWsUrl) {
        try {
            const newTab = await fetch(`http://127.0.0.1:${port}/json/new`, { method: 'PUT', signal: AbortSignal.timeout(1000) }).then(r => r.json());
            tabWsUrl = newTab.webSocketDebuggerUrl;
        } catch(e) {}
    }

    if (!tabWsUrl) {
        console.log('❌ Cannot get WebSocket URL');
        try { proc.kill(); } catch(e) {}
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
        return false;
    }

    const ws = new WebSocket(tabWsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let id = 1;
    const pending = new Map();
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve } = pending.get(msg.id);
            pending.delete(msg.id);
            resolve(msg);
        }
    };

    function send(method, params = {}) {
        return new Promise((resolve) => {
            const reqId = id++;
            const timer = setTimeout(() => {
                pending.delete(reqId);
                resolve({ error: { message: 'TIMEOUT' } });
            }, 5000);
            pending.set(reqId, { resolve: (msg) => { clearTimeout(timer); resolve(msg); } });
            ws.send(JSON.stringify({ id: reqId, method, params }));
        });
    }

    await send('Page.enable');
    await send('Network.enable');

    const targetUrl = 'https://www.tiktok.com/search?q=test';
    console.log(`Navigating to ${targetUrl} via ${navMethod}...`);

    if (navMethod === 'page_navigate') {
        const r = await send('Page.navigate', { url: targetUrl });
        console.log('Page.navigate result:', JSON.stringify(r.result || r.error));
    } else if (navMethod === 'location_href') {
        const r = await send('Runtime.evaluate', { expression: `window.location.href = "${targetUrl}"` });
        console.log('Runtime.evaluate location.href result:', JSON.stringify(r.result || r.error));
    }

    let success = false;
    for (let i = 1; i <= 6; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const evalRes = await send('Runtime.evaluate', {
            expression: `JSON.stringify({ url: location.href, title: document.title, bodyLen: (document.body?.innerText||'').length, videoLinks: document.querySelectorAll('a[href*="/video/"]').length })`,
            returnByValue: true
        });
        const parsed = JSON.parse(evalRes.result?.result?.value || '{}');
        console.log(`  [${i * 1.5}s] url="${parsed.url}" title="${parsed.title}" bodyLen=${parsed.bodyLen} videoLinks=${parsed.videoLinks}`);
        if (parsed.url && parsed.url.includes('tiktok.com') && (parsed.bodyLen > 0 || parsed.videoLinks > 0 || parsed.title.includes('TikTok'))) {
            console.log(`🎉 SUCCESS WITH ${name}!`);
            success = true;
            break;
        }
    }

    try { ws.close(); } catch(e) {}
    try { proc.kill(); } catch(e) {}
    await new Promise(r => setTimeout(r, 300));
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
    return success;
}

(async () => {
    const prefix = process.env.PREFIX || '/data/data/com.termux/files/usr';
    const headlessShell = path.join(prefix, 'lib', 'chromium', 'headless_shell');
    const chrome = path.join(prefix, 'lib', 'chromium', 'chrome');
    const browserBin = fs.existsSync(headlessShell) ? headlessShell : (fs.existsSync(chrome) ? chrome : path.join(prefix, 'bin', 'chromium-browser'));

    console.log('Detected environment binary:', browserBin);

    // Matrix of configs to test
    const configs = [
        {
            name: '1. Headless Shell + Page.navigate',
            bin: fs.existsSync(headlessShell) ? headlessShell : browserBin,
            args: ['about:blank'],
            nav: 'page_navigate'
        },
        {
            name: '2. Headless Shell + location.href',
            bin: fs.existsSync(headlessShell) ? headlessShell : browserBin,
            args: ['about:blank'],
            nav: 'location_href'
        },
        {
            name: '3. Chrome ELF + --headless (classic) + Page.navigate',
            bin: fs.existsSync(chrome) ? chrome : browserBin,
            args: ['--headless', 'about:blank'],
            nav: 'page_navigate'
        },
        {
            name: '4. Chrome ELF + --headless (classic) + location.href',
            bin: fs.existsSync(chrome) ? chrome : browserBin,
            args: ['--headless', 'about:blank'],
            nav: 'location_href'
        },
        {
            name: '5. Chrome ELF + --single-process + location.href',
            bin: fs.existsSync(chrome) ? chrome : browserBin,
            args: ['--headless', '--single-process', '--no-zygote', 'about:blank'],
            nav: 'location_href'
        }
    ];

    for (const cfg of configs) {
        const ok = await testConfig(cfg.name, cfg.bin, cfg.args, cfg.nav);
        if (ok) {
            console.log(`\n\n🏆 FOUND WORKING COMBINATION: ${cfg.name}`);
            break;
        }
    }

    console.log('\n=== DIAGNOSTIC COMPLETE ===');
    process.exit(0);
})().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
