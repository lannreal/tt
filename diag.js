#!/usr/bin/env node
// Diagnostic script - run this on Termux and paste the FULL output
const { spawn, execSync } = require('child_process');
const net = require('net');
const os = require('os');
const path = require('path');
const fs = require('fs');
const http = require('http');

(async () => {
    console.log('=== TT TERMUX DIAGNOSTIC ===');
    console.log('OS:', os.platform(), os.arch(), os.release());
    console.log('Node:', process.version);
    console.log('PREFIX:', process.env.PREFIX || '(not set)');
    console.log('TMPDIR:', process.env.TMPDIR || os.tmpdir());

    // 1. Find browser binary
    const prefix = process.env.PREFIX || '/data/data/com.termux/files/usr';
    const candidates = [
        path.join(prefix, 'bin', 'chromium-browser'),
        path.join(prefix, 'bin', 'chromium'),
        path.join(prefix, 'lib', 'chromium', 'chrome'),
        path.join(prefix, 'bin', 'headless_shell'),
        path.join(prefix, 'lib', 'chromium', 'headless_shell'),
    ];

    let browserPath = null;
    for (const c of candidates) {
        const exists = fs.existsSync(c);
        const isFile = exists ? fs.statSync(c).isFile() : false;
        const isSymlink = exists ? fs.lstatSync(c).isSymbolicLink() : false;
        console.log(`  ${c}: exists=${exists} file=${isFile} symlink=${isSymlink}`);
        if (exists && !browserPath) browserPath = c;
    }

    if (!browserPath) {
        console.log('ERROR: No browser binary found!');
        process.exit(1);
    }

    console.log('\nSelected browser:', browserPath);

    // Check if it's a script or ELF binary
    try {
        const head = fs.readFileSync(browserPath, { encoding: null }).slice(0, 128);
        if (head[0] === 0x23 && head[1] === 0x21) { // #! shebang
            const content = fs.readFileSync(browserPath, 'utf8');
            console.log('Type: SHELL SCRIPT');
            console.log('--- Script content (first 500 chars) ---');
            console.log(content.slice(0, 500));
            console.log('--- End script ---');
        } else if (head[0] === 0x7f && head[1] === 0x45) { // ELF
            console.log('Type: ELF binary');
        } else {
            console.log('Type: Unknown, first bytes:', head.slice(0, 8).toString('hex'));
        }
    } catch (e) {
        console.log('Cannot read binary:', e.message);
    }

    // Check symlink target
    try {
        const real = fs.realpathSync(browserPath);
        if (real !== browserPath) console.log('Symlink resolves to:', real);
    } catch (e) {}

    // 2. Get free port
    const port = await new Promise(res => {
        const s = net.createServer();
        s.listen(0, '127.0.0.1', () => {
            const p = s.address().port;
            s.close(() => res(p));
        });
    });
    console.log('\nUsing port:', port);

    // 3. Spawn browser with different headless modes to test
    const tmpDir = path.join(process.env.TMPDIR || os.tmpdir(), `tt_diag_${Date.now()}`);
    
    const args = [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--ignore-certificate-errors',
        '--disable-web-security',
        `--user-data-dir=${tmpDir}`,
        'about:blank'
    ];

    console.log('\nSpawning:', path.basename(browserPath));
    console.log('Args:', args.join(' '));

    const proc = spawn(browserPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    let stdout = '';
    proc.stderr?.on('data', d => { stderr += d.toString(); });
    proc.stdout?.on('data', d => { stdout += d.toString(); });
    proc.on('error', e => console.log('SPAWN ERROR:', e.message));

    // 4. Wait for CDP to be ready
    console.log('\nWaiting for CDP...');
    let ready = false;
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 300));
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) });
            if (res.ok) {
                const ver = await res.json();
                console.log('CDP Ready! Browser:', ver.Browser);
                console.log('Protocol:', ver['Protocol-Version']);
                console.log('User-Agent:', ver['User-Agent']);
                ready = true;
                break;
            }
        } catch (e) {}
    }

    if (!ready) {
        console.log('\nFAILED: CDP never became ready after 9 seconds');
        console.log('STDERR:', stderr.slice(0, 1000));
        console.log('STDOUT:', stdout.slice(0, 500));

        // Try old --headless mode
        console.log('\n--- RETRYING with --headless (old mode) ---');
        proc.kill();
        await new Promise(r => setTimeout(r, 500));

        const port2 = port + 1;
        const tmpDir2 = tmpDir + '_v2';
        const args2 = args.map(a => a === '--headless=new' ? '--headless' : a.includes(`--remote-debugging-port`) ? `--remote-debugging-port=${port2}` : a.includes('user-data-dir') ? `--user-data-dir=${tmpDir2}` : a);
        
        console.log('Args:', args2.join(' '));
        const proc2 = spawn(browserPath, args2, { stdio: ['pipe', 'pipe', 'pipe'] });
        let stderr2 = '';
        proc2.stderr?.on('data', d => { stderr2 += d.toString(); });
        proc2.on('error', e => console.log('SPAWN ERROR v2:', e.message));
        
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 300));
            try {
                const res = await fetch(`http://127.0.0.1:${port2}/json/version`, { signal: AbortSignal.timeout(500) });
                if (res.ok) {
                    const ver = await res.json();
                    console.log('CDP Ready (old mode)! Browser:', ver.Browser);
                    ready = true;
                    break;
                }
            } catch (e) {}
        }
        if (!ready) {
            console.log('FAILED v2 too. STDERR:', stderr2.slice(0, 1000));
        }
        try { proc2.kill(); } catch(e) {}
        try { fs.rmSync(tmpDir2, { recursive: true, force: true }); } catch(e) {}
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
        process.exit(1);
    }

    // 5. Check stderr for warnings
    if (stderr.length > 0) {
        console.log('\nBrowser STDERR (first 800 chars):');
        console.log(stderr.slice(0, 800));
    }

    // 6. List tabs
    try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) });
        const tabs = await res.json();
        console.log('\nTabs:', JSON.stringify(tabs.map(t => ({ id: t.id, type: t.type, title: t.title, url: t.url, wsUrl: !!t.webSocketDebuggerUrl })), null, 2));
    } catch (e) {
        console.log('Failed to list tabs:', e.message);
    }

    // 7. Connect WebSocket and test Page.navigate
    let tabWsUrl;
    try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) });
        const tabs = await res.json();
        const tab = tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        tabWsUrl = tab?.webSocketDebuggerUrl;
    } catch(e) {}

    if (!tabWsUrl) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/new`, { method: 'PUT', signal: AbortSignal.timeout(2000) });
            const tab = await res.json();
            tabWsUrl = tab.webSocketDebuggerUrl;
            console.log('Created new tab for WS');
        } catch(e) {
            console.log('Cannot create new tab:', e.message);
        }
    }

    if (!tabWsUrl) {
        console.log('No WebSocket URL available!');
        proc.kill();
        process.exit(1);
    }

    console.log('\nConnecting WS:', tabWsUrl);
    const ws = new WebSocket(tabWsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    console.log('WebSocket connected!');

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

    // Enable domains
    const r1 = await send('Page.enable');
    console.log('Page.enable:', r1.error ? `ERROR: ${r1.error.message}` : 'OK');
    const r2 = await send('Network.enable');
    console.log('Network.enable:', r2.error ? `ERROR: ${r2.error.message}` : 'OK');

    // Check current URL
    const r3 = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
    console.log('Current URL:', r3.result?.result?.value || 'UNKNOWN');

    // Navigate to TikTok
    console.log('\nNavigating to TikTok...');
    const navResult = await send('Page.navigate', { url: 'https://www.tiktok.com/search?q=test' });
    console.log('Page.navigate result:', JSON.stringify(navResult.result || navResult.error));

    // Wait and check page state every 2s for 20s
    for (let i = 1; i <= 10; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const evalResult = await send('Runtime.evaluate', {
            expression: `JSON.stringify({ url: location.href, title: document.title, bodyLen: (document.body?.innerText||'').length, snippet: (document.body?.innerText||'').slice(0,100).replace(/\\n+/g,' '), videoLinks: document.querySelectorAll('a[href*="/video/"]').length })`,
            returnByValue: true
        });
        const val = evalResult.result?.result?.value;
        let parsed;
        try { parsed = JSON.parse(val); } catch(e) { parsed = { raw: val }; }
        console.log(`[${i*2}s] URL=${parsed.url} title="${parsed.title}" bodyLen=${parsed.bodyLen} videoLinks=${parsed.videoLinks} snippet="${(parsed.snippet||'').slice(0,60)}"`);
        
        if (parsed.videoLinks > 0) {
            console.log('\n✅ SUCCESS! Video links found on TikTok!');
            break;
        }
    }

    // Cleanup
    try { ws.close(); } catch(e) {}
    try { proc.kill(); } catch(e) {}
    await new Promise(r => setTimeout(r, 500));
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
    console.log('\n=== END DIAGNOSTIC ===');
    process.exit(0);
})().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
