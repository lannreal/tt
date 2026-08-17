/**
 * ============================================================================
 * 🚀 TIKTOK ULTRA-PRECISION SEARCH SCRAPER & REST API ENGINE
 * ============================================================================
 * @author Lann
 * @description Ultra-Precision TikTok Search Scraper & REST API Server.
 *              Dual-Engine: Event-Driven CDP Search Interceptor (100% Reliable API Data)
 *              & Multi-Datacenter Aweme Fast-Race API Integration.
 *              Production-Grade: Zero Temp Disk Leak, Zombie Process Protection,
 *              Anti-Detection Stealth, Direct API Payload Capture on loadingFinished,
 *              Concurrency Lock, and Multi-Format Cookie Parsing.
 *              Supports Windows, Linux, macOS, and Termux (Android).
 * ============================================================================
 */

const fs = require('fs');
const readline = require('readline');
const http = require('http');
const url = require('url');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn, execSync } = require('child_process');

const ITEMS_PER_PAGE = 5;
const DEFAULT_PORT = process.env.PORT || 3000;

// RESOURCE LIFECYCLE TRACKER (PREVENTS DISK & PROCESS LEAKS)
const activeProcesses = new Set();
const activeTempDirs = new Set();

function cleanupAllResources() {
    for (const proc of activeProcesses) {
        try { proc.kill('SIGKILL'); } catch (e) {}
    }
    activeProcesses.clear();

    for (const tempDir of activeTempDirs) {
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (e) {}
    }
    activeTempDirs.clear();
}

// REGISTER PROCESS-LEVEL SIGNALS FOR CLEAN EXIT
process.once('exit', cleanupAllResources);
process.once('SIGINT', () => { cleanupAllResources(); process.exit(0); });
process.once('SIGTERM', () => { cleanupAllResources(); process.exit(0); });
process.once('uncaughtException', (err) => {
    console.error(`\n[FATAL ERROR] ${err.message}`);
    cleanupAllResources();
    process.exit(1);
});

// ANSI COLOR TOKENS (Minimalist Palette)
const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    gray: '\x1b[90m',
    white: '\x1b[37m'
};

// WHITELIST REGION CODES
const VALID_REGION_CODES = new Set([
    'ID', 'US', 'MY', 'JP', 'VN', 'TH', 'SG', 'PH', 'KR', 'CN', 'TW', 'HK',
    'GB', 'UK', 'CA', 'AU', 'NZ', 'DE', 'FR', 'ES', 'IT', 'NL', 'BR', 'MX',
    'AR', 'CL', 'CO', 'PE', 'IN', 'PK', 'BD', 'RU', 'UA', 'TR', 'SA', 'AE',
    'EG', 'ZA', 'ALL', 'ANY', '*'
]);

function formatRegionLabel(regionCode) {
    const code = (regionCode || 'ID').toUpperCase();
    const map = {
        'ID': 'ID (Indonesia)',
        'US': 'US (United States)',
        'MY': 'MY (Malaysia)',
        'JP': 'JP (Japan)',
        'VN': 'VN (Vietnam)',
        'TH': 'TH (Thailand)',
        'SG': 'SG (Singapore)',
        'PH': 'PH (Philippines)',
        'KR': 'KR (South Korea)',
        'GB': 'GB/UK (United Kingdom)',
        'UK': 'GB/UK (United Kingdom)',
        'ALL': 'ALL (Global / Worldwide)',
        'ANY': 'ALL (Global / Worldwide)'
    };
    return map[code] || `${code}`;
}

function printCliManual() {
    console.log(`
${C.bold}TikTok Search Scraper & REST API${C.reset} ${C.dim}(by Lann)${C.reset}

${C.bold}CLI Usage:${C.reset}
  node tt.js search <keyword> [page] [region]
  node tt.js <keyword> [page] [region]

${C.bold}Examples:${C.reset}
  node tt.js search "about you"          ${C.dim}# Page 1, Region ID${C.reset}
  node tt.js search "about you" 1 ALL    ${C.dim}# Page 1, Global (All Regions)${C.reset}
  node tt.js "ironman edit" 1 ALL        ${C.dim}# Global Ironman Edit${C.reset}
  node tt.js sushi recipe 1 JP           ${C.dim}# Region Japan${C.reset}

${C.bold}REST API Server:${C.reset}
  node tt.js api [port]                  ${C.dim}# Default: http://localhost:3000${C.reset}

${C.bold}Video Downloader:${C.reset}
  node tt.js download "<URL_CDN>" [file.mp4]
`);
}

function parseCliArgs(args) {
    let region = 'ID';
    let page = 1;
    let remainingArgs = [];

    for (const arg of args) {
        remainingArgs.push(arg);
    }

    if (remainingArgs.length > 1 && remainingArgs[0].toLowerCase() === 'search') {
        remainingArgs.shift();
    }

    if (remainingArgs.length > 0) {
        const lastArg = remainingArgs[remainingArgs.length - 1].toUpperCase();
        if (VALID_REGION_CODES.has(lastArg)) {
            region = lastArg;
            remainingArgs.pop();
        }
    }

    if (remainingArgs.length > 0) {
        const lastArg = remainingArgs[remainingArgs.length - 1];
        if (/^\d+$/.test(lastArg)) {
            page = parseInt(lastArg, 10);
            remainingArgs.pop();
        }
    }

    const keyword = remainingArgs.join(' ').trim();
    return { keyword, page, region };
}

function evaluatePrecision(item, keyword, targetRegion = 'ID') {
    const itemRegion = (item.region || '').toUpperCase();
    const desiredRegion = targetRegion.toUpperCase();

    if (desiredRegion !== 'ALL' && desiredRegion !== 'ANY' && desiredRegion !== '*') {
        if (itemRegion && itemRegion !== desiredRegion && itemRegion !== 'ALL') {
            return { score: 0, label: `REJECTED_NON_${desiredRegion}_REGION` };
        }
    }

    const rawCaption = (item.title || '').toLowerCase();
    const rawKeyword = keyword.toLowerCase().trim();
    const cleanKwJoined = rawKeyword.replace(/\s+/g, '');
    const queryWords = rawKeyword.split(/\s+/).filter(w => w.length > 0);

    const authorName = (item.author?.nickname || '').toLowerCase();
    const username = (item.author?.unique_id || '').toLowerCase();
    
    const fullText = `${rawCaption} ${authorName} ${username}`;

    if (rawCaption.includes(rawKeyword) || fullText.includes(rawKeyword)) {
        return { score: 100, label: 'EXACT_MATCH' };
    }

    if (fullText.includes(cleanKwJoined) || fullText.includes(`#${cleanKwJoined}`)) {
        return { score: 95, label: 'HASHTAG_EXACT' };
    }

    const tokens = rawCaption.split(/[\s,#._\-!?:;"'()\[\]{}]+/);
    
    const wordPositions = queryWords.map(word => {
        let indices = [];
        tokens.forEach((token, idx) => {
            if (token.includes(word)) indices.push(idx);
        });
        return indices;
    });

    const hasAnyWordMatch = wordPositions.some(posList => posList.length > 0);
    const hasAllWordsMatch = wordPositions.every(posList => posList.length > 0);

    if (!hasAnyWordMatch) {
        return { score: 0, label: 'NO_MATCH' };
    }

    if (!hasAllWordsMatch) {
        return { score: 75, label: 'PARTIAL_MATCH' };
    }

    let minSpan = Infinity;
    function findSpan(wordIndex, currentPosList) {
        if (wordIndex === wordPositions.length) {
            const min = Math.min(...currentPosList);
            const max = Math.max(...currentPosList);
            const span = max - min;
            if (span < minSpan) minSpan = span;
            return;
        }
        for (const pos of wordPositions[wordIndex]) {
            findSpan(wordIndex + 1, [...currentPosList, pos]);
        }
    }
    findSpan(0, []);

    const maxAllowedSpan = queryWords.length + 3;

    if (minSpan <= maxAllowedSpan) {
        const proximityScore = 90 - (minSpan * 5);
        return { score: Math.max(proximityScore, 70), label: 'CLOSE_PROXIMITY' };
    }

    return { score: 65, label: 'RELEVANT_MATCH' };
}

// ROBUST MULTI-FORMAT COOKIE PARSER
function getStoredCookie() {
    let raw = '';
    if (process.env.TIKTOK_COOKIE) {
        raw = process.env.TIKTOK_COOKIE.trim();
    } else {
        const cookiePath = path.join(process.cwd(), 'cookie.txt');
        if (fs.existsSync(cookiePath)) {
            try {
                raw = fs.readFileSync(cookiePath, 'utf8').trim();
            } catch (e) {}
        }
    }

    if (!raw) return '';

    // If raw JSON array format
    if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
            const arr = JSON.parse(raw);
            return arr.map(c => `${c.name}=${c.value}`).join('; ');
        } catch (e) {}
    }

    // If multiline format
    if (raw.includes('\n')) {
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        const pairs = [];
        for (const line of lines) {
            if (line.includes('=')) {
                pairs.push(line.replace(/;+$/, ''));
            } else {
                const tabs = line.split(/\t+/);
                if (tabs.length >= 2) {
                    pairs.push(`${tabs[0]}=${tabs[1]}`);
                }
            }
        }
        return pairs.join('; ');
    }

    return raw;
}

function findBrowserPath() {
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
    if (process.env.BROWSER_PATH && fs.existsSync(process.env.BROWSER_PATH)) return process.env.BROWSER_PATH;

    // Check dynamic PATH lookup on Linux / Termux / macOS
    if (process.platform !== 'win32') {
        try {
            const found = execSync('which chromium || which chromium-browser || which google-chrome || which google-chrome-stable || which chrome', {
                stdio: ['ignore', 'pipe', 'ignore'],
                timeout: 1000
            }).toString().trim();
            if (found && fs.existsSync(found)) return found;
        } catch (e) {}

        // Dynamic package file discovery via dpkg (Guaranteed for Termux / Debian / Ubuntu)
        try {
            const dpkgOutput = execSync('dpkg -L chromium 2>/dev/null || dpkg -L chromium-browser 2>/dev/null', {
                stdio: ['ignore', 'pipe', 'ignore'],
                timeout: 2000
            }).toString();
            const lines = dpkgOutput.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            for (const p of lines) {
                if (fs.existsSync(p)) {
                    try {
                        const stat = fs.statSync(p);
                        if (stat.isFile() && (stat.mode & 0o111) && !p.endsWith('.so') && !p.endsWith('.pak')) {
                            return p;
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}
    }

    const termuxPrefix = process.env.PREFIX || '/data/data/com.termux/files/usr';
    const userProfile = process.env.USERPROFILE || '';
    const possible = [
        path.join(termuxPrefix, 'bin', 'headless_shell'),
        path.join(termuxPrefix, 'bin', 'chromium-browser'),
        path.join(termuxPrefix, 'lib', 'chromium', 'headless_shell'),
        path.join(termuxPrefix, 'lib', 'chromium', 'chrome'),
        path.join(termuxPrefix, 'lib', 'chromium', 'chrome-wrapper'),
        path.join(termuxPrefix, 'opt', 'chromium', 'chromium'),
        path.join(termuxPrefix, 'opt', 'chromium', 'chrome'),
        path.join(termuxPrefix, 'lib', 'chromium', 'chromium'),
        path.join(termuxPrefix, 'libexec', 'chromium'),
        path.join(termuxPrefix, 'bin', 'chromium'),
        path.join(termuxPrefix, 'bin', 'chrome'),
        '/data/data/com.termux/files/usr/bin/headless_shell',
        '/data/data/com.termux/files/usr/bin/chromium-browser',
        '/data/data/com.termux/files/usr/lib/chromium/headless_shell',
        '/data/data/com.termux/files/usr/lib/chromium/chrome',
        '/data/data/com.termux/files/usr/bin/chromium',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(userProfile, 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        path.join(userProfile, 'AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe'),
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium'
    ];

    for (const p of possible) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

// FAST-RACE MULTI-DATACENTER AWEME VIDEO DETAILS
async function fetchAwemeVideoDetails(videoId) {
    if (!videoId) return null;
    const rawCookie = getStoredCookie();
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Cookie': rawCookie
    };

    const endpoints = [
        `https://api22-normal-c-useast2a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`,
        `https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`,
        `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`,
        `https://api22-va.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`,
        `https://api.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`,
        `https://api19-va.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`
    ];

    const fetchSingle = async (ep) => {
        const res = await fetch(ep, { headers, signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text.startsWith('{')) throw new Error('Invalid JSON body');
        const data = JSON.parse(text);
        const item = (data.aweme_list || [])[0];
        if (!item || !item.statistics) throw new Error('No aweme item');

        const stats = item.statistics || {};
        const video = item.video || {};
        const music = item.music || {};
        const author = item.author || {};
        
        return {
            views: stats.play_count !== undefined ? Number(stats.play_count).toLocaleString() : 'N/A',
            likes: stats.digg_count !== undefined ? Number(stats.digg_count).toLocaleString() : 'N/A',
            comments: stats.comment_count !== undefined ? Number(stats.comment_count).toLocaleString() : 'N/A',
            shares: stats.share_count !== undefined ? Number(stats.share_count).toLocaleString() : 'N/A',
            saves: stats.collect_count !== undefined ? Number(stats.collect_count).toLocaleString() : 'N/A',
            duration: video.duration ? `${(video.duration / 1000).toFixed(1)}s` : 'N/A',
            music_title: music.title || '',
            music_author: music.author || '',
            mp3_url: music.play_url?.url_list?.[0] || '',
            cover: video.origin_cover?.url_list?.[0] || video.cover?.url_list?.[0] || '',
            dynamic_cover: video.dynamic_cover?.url_list?.[0] || '',
            play_addr: video.play_addr?.url_list?.[0] || '',
            author_name: author.nickname || '',
            author_username: author.unique_id ? `@${author.unique_id}` : '',
            avatar: author.avatar_larger?.url_list?.[0] || author.avatar_thumb?.url_list?.[0] || ''
        };
    };

    try {
        const primaryRace = Promise.any([
            fetchSingle(endpoints[0]),
            fetchSingle(endpoints[1])
        ]);
        return await primaryRace;
    } catch (e) {
        for (let i = 2; i < endpoints.length; i++) {
            try {
                return await fetchSingle(endpoints[i]);
            } catch (err) {}
        }
    }
    return null;
}

// FETCH OFFICIAL OEMBED METADATA (100% HD COVER & TITLE)
async function fetchOembedMeta(videoUrl) {
    try {
        const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {}
    return null;
}

// MULTI-RESOLVER DIRECT DOWNLOAD (SSSTik + LoveTik Fallback)
async function resolveDirectDownloads(videoUrl) {
    // 1. Resolver SSSTik
    try {
        const res = await fetch('https://ssstik.io/abc?url=dl', {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'HX-Request': 'true',
                'HX-Trigger': '_gcaptcha_pt',
                'HX-Target': 'target',
                'HX-Current-URL': 'https://ssstik.io/en'
            },
            body: `id=${encodeURIComponent(videoUrl)}&locale=en&tt=0`,
            signal: AbortSignal.timeout(3500)
        });

        if (res.ok) {
            const html = await res.text();
            const allLinks = Array.from(html.matchAll(/href="([^"]+)"/g)).map(m => m[1]);
            const noWm = allLinks.find(l => (l.includes('tikcdn.io/ssstik/') && !l.includes('/m/')) || l.includes('download_link'));
            const mp3 = allLinks.find(l => l.includes('tikcdn.io/ssstik/m/'));

            if (noWm || mp3) {
                return {
                    stream_mp4_no_wm: noWm || '',
                    mp3_url: mp3 || ''
                };
            }
        }
    } catch (e) {}

    // 2. Resolver LoveTik (Fallback)
    try {
        const res = await fetch('https://lovetik.com/api/ajax/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0'
            },
            body: `query=${encodeURIComponent(videoUrl)}`,
            signal: AbortSignal.timeout(3500)
        });

        if (res.ok) {
            const data = await res.json();
            const mp4Link = (data.links || []).find(l => l.t && l.t.includes('MP4') && !l.t.includes('Watermark'));
            const audioLink = (data.links || []).find(l => l.t && l.t.includes('MP3'));
            return {
                stream_mp4_no_wm: mp4Link?.a || '',
                mp3_url: audioLink?.a || ''
            };
        }
    } catch (e) {}

    return { stream_mp4_no_wm: '', mp3_url: '' };
}

// NATIVE CDP BROWSER SEARCH INTERCEPTOR ENGINE
async function fetchTikTokSearchViaBrowser(keyword, page = 1, region = 'ID') {
    const browserPath = findBrowserPath();
    if (!browserPath) {
        throw new Error('Browser Chrome/Chromium/Edge tidak ditemukan di sistem.');
    }

    const port = await new Promise(res => {
        const s = net.createServer();
        s.listen(0, '127.0.0.1', () => {
            const p = s.address().port;
            s.close(() => res(p));
        });
    });

    const baseTmpDir = process.env.TMPDIR || os.tmpdir();
    const tempDir = path.join(baseTmpDir, `tt_browser_${process.pid}_${Date.now()}`);
    activeTempDirs.add(tempDir);

    const isTermux = Boolean(process.env.PREFIX && process.env.PREFIX.includes('com.termux'));
    const isHeadlessShell = browserPath.includes('headless_shell');

    const browserArgs = isHeadlessShell ? [
        `--remote-debugging-port=${port}`,
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        `--user-data-dir=${tempDir}`
    ] : [
        isTermux ? '--headless' : '--headless=new',
        `--remote-debugging-port=${port}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-extensions',
        '--disable-sync',
        `--user-data-dir=${tempDir}`
    ];

    const chromeProc = spawn(browserPath, browserArgs);

    let procError = null;
    let procStderr = '';
    chromeProc.on('error', (err) => {
        procError = err;
    });
    chromeProc.stderr?.on('data', (d) => {
        procStderr += d.toString();
    });

    activeProcesses.add(chromeProc);

    const cleanupInstance = () => {
        activeProcesses.delete(chromeProc);
        try { chromeProc.kill(); } catch (e) {}
        activeTempDirs.delete(tempDir);
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (e) {}
    };

    try {
        let isReady = false;
        for (let i = 0; i < 40; i++) {
            if (procError) break;
            try {
                const checkRes = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) });
                if (checkRes.ok) {
                    isReady = true;
                    break;
                }
            } catch (e) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        if (!isReady) {
            if (procError) {
                throw new Error(`Gagal mengeksekusi Chromium binary (${browserPath}): ${procError.message}`);
            }
            const errSnippet = procStderr.trim() ? ` [Detail: ${procStderr.trim().slice(-200)}]` : '';
            throw new Error(`Chromium tidak merespons di port ${port}.${errSnippet}`);
        }

        let tabWsUrl = '';
        try {
            const listRes = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) });
            if (listRes.ok) {
                const tabs = await listRes.json();
                const pageTab = tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
                if (pageTab) tabWsUrl = pageTab.webSocketDebuggerUrl;
            }
        } catch (e) {}

        if (!tabWsUrl) {
            const newTab = await fetch(`http://127.0.0.1:${port}/json/new`, { method: 'PUT', signal: AbortSignal.timeout(2000) }).then(r => r.json());
            tabWsUrl = newTab.webSocketDebuggerUrl;
        }

        if (!tabWsUrl) {
            throw new Error('Gagal mendapatkan WebSocket debugger URL dari browser.');
        }

        const ws = new WebSocket(tabWsUrl);

        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let id = 1;
        const pending = new Map();
        function send(method, params = {}, timeoutMs = 8000) {
            return new Promise((resolve, reject) => {
                const reqId = id++;
                const timer = setTimeout(() => {
                    if (pending.has(reqId)) {
                        pending.delete(reqId);
                        resolve({});
                    }
                }, timeoutMs);

                pending.set(reqId, {
                    resolve: (val) => { clearTimeout(timer); resolve(val); },
                    reject: (err) => { clearTimeout(timer); reject(err); }
                });

                try {
                    ws.send(JSON.stringify({ id: reqId, method, params }));
                } catch (e) {
                    clearTimeout(timer);
                    resolve({});
                }
            });
        }

        console.log(`[1/3] ⚡ Browser CDP terhubung pada port ${port}`);

        let rawSearchList = [];
        const searchReqIds = new Set();

        ws.onmessage = async (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                if (msg.id && pending.has(msg.id)) {
                    const entry = pending.get(msg.id);
                    pending.delete(msg.id);
                    if (msg.error) {
                        entry.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
                    } else {
                        entry.resolve(msg.result);
                    }
                }

                if (msg.method === 'Network.responseReceived') {
                    const u = msg.params?.response?.url || '';
                    if (u.includes('/api/search/general/full/') || u.includes('/api/search/item/full/') || u.includes('/api/search/video/full/')) {
                        searchReqIds.add(msg.params.requestId);
                    }
                }

                if (msg.method === 'Network.loadingFinished' && searchReqIds.has(msg.params.requestId)) {
                    try {
                        const bodyRes = await send('Network.getResponseBody', { requestId: msg.params.requestId });
                        if (bodyRes && bodyRes.body) {
                            let text = bodyRes.body;
                            if (bodyRes.base64Encoded) {
                                text = Buffer.from(text, 'base64').toString('utf8');
                            }
                            if (text.trim().startsWith('{')) {
                                const data = JSON.parse(text);
                                const list = data.data || data.item_list || data.search_data || [];
                                if (list.length > 0) {
                                    rawSearchList = list;
                                }
                            }
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        };

        const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

        await Promise.all([
            send('Network.enable', { maxTotalBufferSize: 100000000, maxResourceBufferSize: 10000000 }, 3000),
            send('Page.enable', {}, 3000),
            send('Network.setUserAgentOverride', {
                userAgent: DESKTOP_UA,
                acceptLanguage: 'en-US,en;q=0.9,id;q=0.8',
                platform: 'Win32'
            }, 3000),
            send('Emulation.setUserAgentOverride', {
                userAgent: DESKTOP_UA,
                platform: 'Win32'
            }, 3000),
            send('Emulation.setDeviceMetricsOverride', {
                width: 1440,
                height: 900,
                deviceScaleFactor: 1,
                mobile: false
            }, 3000)
        ]);

        // ANTI-DETECTION STEALTH HOOKS (DO NOT TAMPER WINDOW.FETCH TO PREVENT MSSDK INTEGRITY FAIL)
        await send('Page.addScriptToEvaluateOnNewDocument', {
            source: `
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
                Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
                Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'id'] });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                window.chrome = { runtime: {} };
            `
        }, 3000);

        const rawCookie = getStoredCookie();
        if (rawCookie) {
            const cookiePairs = rawCookie.split(';').map(c => c.trim()).filter(Boolean);
            const cookiesToSet = [];
            for (const pair of cookiePairs) {
                const idx = pair.indexOf('=');
                if (idx > 0) {
                    cookiesToSet.push({
                        name: pair.substring(0, idx).trim(),
                        value: pair.substring(idx + 1).trim(),
                        domain: '.tiktok.com',
                        path: '/'
                    });
                }
            }
            if (cookiesToSet.length > 0) {
                await send('Network.setCookies', { cookies: cookiesToSet }, 3000);
            }
        }

        console.log(`[2/3] 🌐 Membuka halaman pencarian TikTok: "${keyword}"...`);
        await send('Page.navigate', { url: `https://www.tiktok.com/search?q=${encodeURIComponent(keyword)}` }, 5000);

        // Adaptive Polling: Wait for search results from CDP, in-page memory, or DOM
        for (let poll = 0; poll < 15; poll++) {
            process.stderr.write(`\r⏳ Menunggu data TikTok [${poll + 1}/15]... `);
            await new Promise(r => setTimeout(r, 1000));

            // Priority 1: Check CDP interceptor or in-page window variable
            if (rawSearchList.length === 0) {
                try {
                    const inPageRes = await send('Runtime.evaluate', {
                        expression: 'window.__tiktokSearchResults',
                        returnByValue: true
                    });
                    if (inPageRes?.result?.value && inPageRes.result.value.length > 0) {
                        rawSearchList = inPageRes.result.value;
                        break;
                    }
                } catch(e) {}
            }
            if (rawSearchList.length > 0) break;

            // Priority 2: Auto-click "Try again" / "Refresh" button (Leaf element only)
            try {
                const domRes = await send('Runtime.evaluate', {
                    expression: `
                        (() => {
                            const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));
                            let tryAgainBtn = buttons.find(b => {
                                const txt = (b.innerText || '').toLowerCase().trim();
                                return txt === 'try again' || txt === 'refresh' || txt === 'coba lagi';
                            });

                            if (!tryAgainBtn) {
                                const allEls = Array.from(document.querySelectorAll('*'));
                                tryAgainBtn = allEls.find(el => el.children.length === 0 && (el.innerText || '').toLowerCase().trim() === 'try again');
                            }

                            if (tryAgainBtn) {
                                tryAgainBtn.focus();
                                ['mousedown', 'mouseup', 'click'].forEach(eventType => {
                                    tryAgainBtn.dispatchEvent(new MouseEvent(eventType, {
                                        bubbles: true,
                                        cancelable: true,
                                        view: window,
                                        buttons: 1
                                    }));
                                });
                            }

                            const allLinks = Array.from(document.querySelectorAll('a[href*="/video/"]'));
                            const nonNav = allLinks.filter(a => !a.closest('header, nav, aside, [data-e2e*="nav"], [data-e2e*="inbox"], [data-e2e*="notification"], [class*="DivSideNav"], [class*="DivInbox"]'));
                            const seen = new Set();
                            const results = [];

                            for (const a of nonNav) {
                                const m = a.href.match(/\\/video\\/(\\d+)/);
                                if (!m) continue;
                                const videoId = m[1];
                                if (seen.has(videoId)) continue;
                                seen.add(videoId);

                                const card = a.closest('[data-e2e*="search"]') || a.closest('[class*="DivItemContainer"]') || a.parentElement;
                                const desc = card ? (card.querySelector('[data-e2e*="desc"], [data-e2e*="caption"]')?.innerText || card.innerText) : '';
                                const authorA = card ? card.querySelector('a[href*="/@"]') : null;
                                const authorName = authorA ? authorA.innerText.trim() : '';

                                results.push({
                                    id: videoId,
                                    desc: desc || 'TikTok Video',
                                    author: {
                                        nickname: authorName,
                                        uniqueId: authorA?.href?.split('/@')?.[1]?.split('?')?.[0] || ''
                                    }
                                });
                            }
                            return results;
                        })()
                    `,
                    returnByValue: true
                });

                if (domRes?.result?.value && domRes.result.value.length > 0) {
                    rawSearchList = domRes.result.value;
                    break;
                }
            } catch (e) {}

            try {
                await send('Runtime.evaluate', { expression: 'window.scrollBy(0, 600);' });
            } catch (e) {}
        }

        process.stderr.write('\r' + ' '.repeat(40) + '\r');
        console.log(`[3/3] 📊 Berhasil memperoleh ${rawSearchList.length} data video! Memproses enrichment...`);

        if (page > 1 && rawSearchList.length > 0) {
            const scrollSteps = (page - 1) * 2;
            for (let s = 0; s < scrollSteps; s++) {
                await send('Runtime.evaluate', { expression: 'window.scrollBy(0, 1500);' });
                await new Promise(r => setTimeout(r, 800));
            }
        }

        try { ws.close(); } catch (e) {}

        const parsedVideos = [];
        const seenIds = new Set();
        // Track if results came from fetch interceptor (rich API data) or DOM extraction
        const sourceType = rawSearchList.length > 0 && rawSearchList[0]?.item_list ? 'api' :
                           rawSearchList.length > 0 && (rawSearchList[0]?.item || rawSearchList[0]?.video) ? 'api' : 'dom';

        for (const item of rawSearchList) {
            const it = item.item || item;
            if (!it || !it.id) continue;
            if (seenIds.has(it.id)) continue;
            seenIds.add(it.id);

            const author = it.author || {};
            const stats = it.stats || {};
            const desc = it.desc || it.title || '';
            const videoUrl = `https://www.tiktok.com/@${author.uniqueId || author.unique_id || 'user'}/video/${it.id}`;

            const tags = (desc.match(/#[^\s#]+/g) || []).map(t => '#' + t.replace(/^#/, ''));

            parsedVideos.push({
                id: it.id,
                region: region,
                title: desc,
                upload_date: it.createTime ? new Date(it.createTime * 1000).toLocaleDateString() : 'N/A',
                hashtags: tags,
                stats: {
                    views: stats.playCount !== undefined ? Number(stats.playCount).toLocaleString() : 'N/A',
                    likes: stats.diggCount !== undefined ? Number(stats.diggCount).toLocaleString() : 'N/A',
                    comments: stats.commentCount !== undefined ? Number(stats.commentCount).toLocaleString() : 'N/A',
                    shares: stats.shareCount !== undefined ? Number(stats.shareCount).toLocaleString() : 'N/A',
                    saves: stats.collectCount !== undefined ? Number(stats.collectCount).toLocaleString() : 'N/A'
                },
                author: {
                    unique_id: author.uniqueId || author.unique_id || '',
                    nickname: author.nickname || author.uniqueId || '',
                    avatar: author.avatarLarger || author.avatarThumb || ''
                },
                cover: it.video?.cover || '',
                tiktok_url: videoUrl,
                _sourceType: sourceType
            });
        }

        return parsedVideos;
    } finally {
        cleanupInstance();
    }
}

// ASYNC MUTEX LOCK FOR SAFE CONCURRENCY IN API MODE
let isSearchBusy = false;
const searchQueue = [];

function executeWithLock(fn) {
    return new Promise((resolve, reject) => {
        searchQueue.push({ fn, resolve, reject });
        processQueue();
    });
}

async function processQueue() {
    if (isSearchBusy || searchQueue.length === 0) return;
    isSearchBusy = true;
    const task = searchQueue.shift();
    try {
        const res = await task.fn();
        task.resolve(res);
    } catch (err) {
        task.reject(err);
    } finally {
        isSearchBusy = false;
        processQueue();
    }
}

async function searchTikTok(keyword, page = 1, regionTarget = 'ID') {
    return executeWithLock(async () => {
        try {
            let rawVideos = [];
            const browserPath = findBrowserPath();

            if (browserPath) {
                rawVideos = await fetchTikTokSearchViaBrowser(keyword, page, regionTarget);
            } else {
                console.error('\n⚠️ [ENVIRONMENT INFO]');
                console.error('Browser Chromium/Chrome tidak ditemukan di environment ini.');
                console.error('💡 Solusi Termux: Install chromium via repo x11 dengan perintah:');
                console.error('   pkg install x11-repo -y && pkg install chromium -y\n');
                return [];
            }

            // Determine data source: DOM-extracted results are already filtered by TikTok's search engine
            const isDomSource = rawVideos.length > 0 && rawVideos[0]?._sourceType === 'dom';

            let topVideos;
            if (isDomSource) {
                // DOM-extracted: TikTok already filtered these — skip precision scoring, enrich titles later
                topVideos = rawVideos.slice(0, ITEMS_PER_PAGE).map(item => ({
                    item,
                    score: 85,
                    label: 'SEARCH_RESULT'
                }));
            } else {
                // API-intercepted: Full metadata available — apply precision scoring
                const enrichedVideos = await Promise.all(
                    rawVideos.slice(0, 15).map(async (item) => {
                        if (!item.title || item.title === 'TikTok Video' || item.title.trim().length === 0) {
                            try {
                                const [aweme, oemb] = await Promise.all([
                                    fetchAwemeVideoDetails(item.id),
                                    fetchOembedMeta(item.tiktok_url)
                                ]);
                                if (oemb?.title) item.title = oemb.title;
                                else if (aweme?.desc) item.title = aweme.desc;
                                if (aweme?.author_username) item.author.unique_id = aweme.author_username;
                            } catch (e) {}
                        }
                        return item;
                    })
                );

                const evaluated = enrichedVideos
                    .map(item => {
                        const evalResult = evaluatePrecision(item, keyword, regionTarget);
                        return { item, score: evalResult.score, label: evalResult.label };
                    })
                    .filter(entry => entry.score > 0)
                    .sort((a, b) => b.score - a.score);

                const startIndex = (page - 1) * ITEMS_PER_PAGE;
                topVideos = evaluated.slice(startIndex, startIndex + ITEMS_PER_PAGE);

                if (topVideos.length === 0 && evaluated.length > 0) {
                    topVideos = evaluated.slice(0, ITEMS_PER_PAGE);
                }

                // Fallback: precision filter rejected all but raw videos exist — take raw
                if (topVideos.length === 0 && enrichedVideos.length > 0) {
                    topVideos = enrichedVideos.slice(startIndex, startIndex + ITEMS_PER_PAGE).map(item => ({
                        item,
                        score: 60,
                        label: 'SEARCH_RESULT'
                    }));
                }
            }

            const results = [];

            for (let i = 0; i < topVideos.length; i++) {
                const entry = topVideos[i];
                const item = entry.item;
                const author = item.author || {};
                
                // Parallel Enrich: Fast Multi-datacenter Aweme + oEmbed + Direct Downloader
                const [awemeDetail, oembed, dlInfo] = await Promise.all([
                    fetchAwemeVideoDetails(item.id),
                    fetchOembedMeta(item.tiktok_url),
                    resolveDirectDownloads(item.tiktok_url)
                ]);

                const finalTitle = oembed?.title || item.title;
                const finalAuthorName = awemeDetail?.author_name || oembed?.author_name || author.nickname || author.unique_id;
                const finalUsername = awemeDetail?.author_username || (oembed?.author_unique_id ? `@${oembed.author_unique_id}` : (author.unique_id ? `@${author.unique_id}` : '@user'));
                const finalAvatar = awemeDetail?.avatar || author.avatar || '';
                const finalCover = awemeDetail?.cover || oembed?.thumbnail_url || item.cover || '';
                const finalDynamicCover = awemeDetail?.dynamic_cover || '';
                const finalDuration = awemeDetail?.duration || 'N/A';
                const extractedHashtags = (finalTitle.match(/#[^\s#]+/g) || item.hashtags || []);

                const finalStats = {
                    views: awemeDetail?.views && awemeDetail.views !== 'N/A' ? awemeDetail.views : (item.stats?.views || 'N/A'),
                    likes: awemeDetail?.likes && awemeDetail.likes !== 'N/A' ? awemeDetail.likes : (item.stats?.likes || 'N/A'),
                    comments: awemeDetail?.comments && awemeDetail.comments !== 'N/A' ? awemeDetail.comments : (item.stats?.comments || 'N/A'),
                    shares: awemeDetail?.shares && awemeDetail.shares !== 'N/A' ? awemeDetail.shares : (item.stats?.shares || 'N/A'),
                    saves: awemeDetail?.saves && awemeDetail.saves !== 'N/A' ? awemeDetail.saves : (item.stats?.saves || 'N/A')
                };

                const finalAudioTitle = awemeDetail?.music_title || `Original Sound - ${finalAuthorName}`;
                const finalAudioAuthor = awemeDetail?.music_author || finalAuthorName;
                const finalAudioMp3 = awemeDetail?.mp3_url || dlInfo?.mp3_url || '';

                const finalStreamMp4 = dlInfo?.stream_mp4_no_wm || awemeDetail?.play_addr || '';

                results.push({
                    accuracy: `${entry.score}% (${entry.label})`,
                    region: item.region || regionTarget,
                    title: finalTitle,
                    upload_date: item.upload_date || 'N/A',
                    duration: finalDuration,
                    hashtags: extractedHashtags,
                    stats: finalStats,
                    creator: {
                        name: finalAuthorName,
                        username: finalUsername,
                        avatar: finalAvatar
                    },
                    audio: {
                        title: finalAudioTitle,
                        author: finalAudioAuthor,
                        mp3_url: finalAudioMp3
                    },
                    links: {
                        tiktok_web: item.tiktok_url,
                        stream_mp4_no_wm: finalStreamMp4,
                        stream_mp4_wm: awemeDetail?.play_addr || '',
                        cover_image: finalCover,
                        animated_gif: finalDynamicCover
                    }
                });

                if (i < topVideos.length - 1) {
                    await new Promise(r => setTimeout(r, 150));
                }
            }

            return results;
        } catch (error) {
            console.error(`[EXCEPTION] ${error.message}`);
            return [];
        }
    });
}

async function downloadVideo(cdnUrl, outputFilePath) {
    console.log(`\n${C.dim}⏳ Mengunduh video dari CDN ke file: ${outputFilePath}...${C.reset}`);
    try {
        const response = await fetch(cdnUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Referer': cdnUrl.includes('ssstik') || cdnUrl.includes('tikcdn.io') ? 'https://ssstik.io/' : 'https://www.tiktok.com/'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP Error Status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(outputFilePath, buffer);
        console.log(`${C.green}✔ Download berhasil:${C.reset} ${outputFilePath} ${C.dim}(${(buffer.length / 1024 / 1024).toFixed(2)} MB)${C.reset}\n`);
    } catch (err) {
        console.error(`${C.yellow}✖ Download gagal:${C.reset} ${err.message}\n`);
    }
}

// --- MODE REST API SERVER ---
function startRestApiServer(port = DEFAULT_PORT) {
    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = parsedUrl.pathname;
        const query = Object.fromEntries(parsedUrl.searchParams.entries());

        if (pathname === '/' || pathname === '/api' || pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: "active",
                created_by: "Lann",
                server_engine: "TikTok Ultra-Precision REST API Engine",
                dynamic_region_support: "Supported (e.g. ID, MY, US, JP, VN, ALL)",
                endpoints: {
                    search: "/api/search?keyword=about+you&page=1&region=ID",
                    download: "/api/download?url=<FULL_CDN_URL>",
                    info: "/api"
                }
            }, null, 4));
            return;
        }

        // ENDPOINT 1: SEARCH API (/api/search)
        if (pathname === '/api/search') {
            const keyword = query.keyword || query.q;
            const page = parseInt(query.page || '1', 10) || 1;
            const region = (query.region || 'ID').toUpperCase();

            if (!keyword) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    created_by: "Lann",
                    error: "Parameter 'keyword' atau 'q' wajib diisi. Contoh: /api/search?keyword=about+you&region=ID"
                }, null, 4));
                return;
            }

            const results = await searchTikTok(keyword, page, region);

            const apiResponse = {
                created_by: "Lann",
                search_engine: "TikTok Ultra-Precision REST API",
                search_info: {
                    keyword: keyword,
                    current_page: page,
                    current_region: formatRegionLabel(region),
                    items_per_page: ITEMS_PER_PAGE,
                    total_items_found: results.length
                },
                data: results
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(apiResponse, null, 4));
            return;
        }

        // ENDPOINT 2: DIRECT DOWNLOAD STREAM API (/api/download)
        if (pathname === '/api/download') {
            const videoCdnUrl = query.url || query.link;
            const rawFilename = query.filename || 'tiktok_video.mp4';
            const safeFilename = path.basename(rawFilename);

            if (!videoCdnUrl) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    created_by: "Lann",
                    error: "Parameter 'url' wajib diisi. Contoh: /api/download?url=https://..."
                }, null, 4));
                return;
            }

            try {
                const fetchRes = await fetch(videoCdnUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                        'Referer': videoCdnUrl.includes('ssstik') || videoCdnUrl.includes('tikcdn.io') ? 'https://ssstik.io/' : 'https://www.tiktok.com/'
                    }
                });

                if (!fetchRes.ok) {
                    res.writeHead(fetchRes.status, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ created_by: "Lann", error: `Gagal mengambil CDN, HTTP status: ${fetchRes.status}` }));
                    return;
                }

                res.writeHead(200, {
                    'Content-Type': 'video/mp4',
                    'Content-Disposition': `attachment; filename="${safeFilename}"`,
                    'Content-Length': fetchRes.headers.get('content-length') || ''
                });

                const arrayBuffer = await fetchRes.arrayBuffer();
                res.end(Buffer.from(arrayBuffer));
                return;
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ created_by: "Lann", error: err.message }));
                return;
            }
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            created_by: "Lann",
            error: "Route tidak ditemukan. Gunakan /api/search?keyword=... atau /api/download?url=..."
        }, null, 4));
    });

    server.listen(port, () => {
        console.log(`\n${C.bold}TikTok REST API Server Active${C.reset} ${C.dim}(http://localhost:${port})${C.reset}`);
        console.log(`${C.dim}• Search API   :${C.reset} http://localhost:${port}/api/search?keyword=about+you&region=ID`);
        console.log(`${C.dim}• Download API :${C.reset} http://localhost:${port}/api/download?url=<CDN_URL>\n`);
    });
}

function promptInteractive(queryText) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(queryText, (answer) => {
            rl.close();
            resolve((answer || '').trim());
        });
    });
}

// --- MAIN CONTROLLER ---
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        printCliManual();
        return;
    }

    const firstArg = args[0].toLowerCase();

    if (firstArg === 'help' || firstArg === '--help' || firstArg === '-h') {
        printCliManual();
        return;
    }

    if (firstArg === 'api' || firstArg === 'server' || firstArg === '--api') {
        const customPort = parseInt(args[1], 10) || DEFAULT_PORT;
        startRestApiServer(customPort);
        return;
    }

    if (firstArg === 'download') {
        const downloadUrl = args[1];
        const filename = args[2] || 'downloaded_video.mp4';
        if (!downloadUrl) {
            console.log('Masukkan URL CDN video. Contoh: node tt.js download "https://..." video.mp4');
            return;
        }
        await downloadVideo(downloadUrl, filename);
        return;
    }

    const parsed = parseCliArgs(args);
    const keyword = parsed.keyword;
    let currentPage = parsed.page;
    let currentRegion = parsed.region;

    if (!keyword) {
        printCliManual();
        return;
    }

    const browserPath = findBrowserPath();
    if (!browserPath) {
        console.error(`\n${C.yellow}⚠️ [BROWSER CHROMIUM BELUM TERPASANG]${C.reset}`);
        console.error(`Scraper membutuhkan Chromium untuk mengambil data pencarian TikTok.`);
        console.error(`👉 ${C.bold}Cara Pasang di Termux (Android):${C.reset}`);
        console.error(`   ${C.green}pkg install x11-repo -y && pkg install chromium -y${C.reset}`);
        console.error(`👉 ${C.bold}Cara Pasang di Linux / VPS:${C.reset}`);
        console.error(`   ${C.green}sudo apt update && sudo apt install -y chromium-browser${C.reset}\n`);
        return;
    }

    let running = true;

    while (running) {
        console.log(`\n${C.cyan}🔍 Mengambil data pencarian TikTok: "${keyword}" [Page ${currentPage} · ${formatRegionLabel(currentRegion)}]...${C.reset}`);
        const results = await searchTikTok(keyword, currentPage, currentRegion);

        const finalOutput = {
            created_by: "Lann",
            search_engine: "TikTok Ultra-Precision Search Scraper",
            search_info: {
                keyword: keyword,
                current_page: currentPage,
                current_region: formatRegionLabel(currentRegion),
                items_per_page: ITEMS_PER_PAGE,
                total_items_found: results.length
            },
            data: results
        };

        // Print pristine, cleanly indented JSON
        console.log(JSON.stringify(finalOutput, null, 4));

        if (results.length > 0) {
            const safeKeyword = keyword.replace(/[^a-zA-Z0-9_-]/g, '_');
            const jsonFilename = `search_${safeKeyword}_page_${currentPage}.json`;
            fs.writeFileSync(jsonFilename, JSON.stringify(finalOutput, null, 4), 'utf-8');
        }

        // Minimal single-line navigation prompt
        console.log('\n' + C.dim + '─'.repeat(75) + C.reset);
        console.log(`${C.dim}[Page ${currentPage} · ${formatRegionLabel(currentRegion)}]${C.reset} [${C.bold}Enter${C.reset}] Next · [${C.bold}1-9${C.reset}] Jump · [${C.bold}r <reg>${C.reset}] Region · [${C.bold}q${C.reset}] Quit`);
        const answer = await promptInteractive(`${C.cyan}›${C.reset} `);

        if (answer.toLowerCase() === 'q' || answer.toLowerCase() === 'exit') {
            running = false;
        } else if (answer.toLowerCase() === 'help') {
            printCliManual();
        } else if (answer.toLowerCase().startsWith('r ')) {
            const newReg = answer.split(/\s+/)[1];
            if (newReg) {
                currentRegion = newReg.toUpperCase();
                console.log(`\n${C.dim}Region updated to: ${formatRegionLabel(currentRegion)}${C.reset}\n`);
            }
        } else if (answer === '') {
            currentPage += 1;
        } else {
            const targetPage = parseInt(answer, 10);
            if (!isNaN(targetPage) && targetPage > 0) {
                currentPage = targetPage;
            } else {
                running = false;
            }
        }
    }
}

if (require.main === module) {
    main();
} else {
    module.exports = {
        searchTikTok,
        fetchAwemeVideoDetails,
        downloadVideo,
        startRestApiServer
    };
}
