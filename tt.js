const fs = require('fs');
const readline = require('readline');
const http = require('http');
const url = require('url');

const ITEMS_PER_PAGE = 5;
const DEFAULT_PORT = process.env.PORT || 3000;

// WHITELIST REGION CODE RESMI
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
        'ALL': 'ALL (Global / Semua Negara)',
        'ANY': 'ALL (Global / Semua Negara)'
    };
    return map[code] || `${code}`;
}

function printCliManual() {
    console.log(`
================================================================================
🚀 TIKTOK ULTRA-PRECISION SEARCH SCRAPER & REST API CLI (By Lann)
================================================================================

📌 PANDUAN PENGGUNAAN LENGKAP:

1. PENCARIAN SEARCH (CLI MODE):
   node tt.js <kata kunci multi-kata> [halaman] [region]

   Contoh:
   • node tt.js about you                   -> Search "about you" (Page 1, Region ID)
   • node tt.js dj goyang dayung            -> Search "dj goyang dayung" (Page 1, Region ID)
   • node tt.js street food 1 US            -> Search "street food" Region US
   • node tt.js sushi recipe JP             -> Search "sushi recipe" Region JP
   • node tt.js trending ALL                -> Search "trending" Global (Semua Region)

2. MENJALANKAN REST API SERVER:
   node tt.js api [port]

   Contoh:
   • node tt.js api                         -> Server aktif di port 3000
   • node tt.js api 8080                    -> Server aktif di port 8080

   Endpoints REST API:
   • GET /api/search?keyword=about+you&page=1&region=ID -> Rest API Search
   • GET /api/download?url=<FULL_CDN_URL>               -> Rest API Direct Downloader

3. DOWNLOAD VIDEO CDN MP4 (CLI):
   node tt.js download "<FULL_STREAM_URL>" [nama_file.mp4]

4. KODE REGION RESMI (WHITELIST):
   • ID (Indonesia), US (USA), MY (Malaysia), JP (Jepang), VN (Vietnam), 
   • SG (Singapura), PH (Filipina), KR (Korea), ALL (Global/Semua)

5. NAVIGASI INTERAKTIF TERMINAL:
   • Tekan [ENTER]           -> Lanjut ke Halaman Selanjutnya
   • Ketik nomor (misal '3') -> Melompat ke Halaman 3
   • Ketik 'r US'            -> Mengubah Region ke US
   • Ketik 'r ALL'           -> Mengubah Region ke Global
   • Ketik 'q'               -> Keluar dari script

================================================================================
    `);
}

function parseCliArgs(args) {
    let region = 'ID';
    let page = 1;
    let remainingArgs = [...args];

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
        if (itemRegion !== desiredRegion) {
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

    if (wordPositions.some(posList => posList.length === 0)) {
        return { score: 0, label: 'REJECTED_MISSING_WORDS' };
    }

    let minSpan = Infinity;
    if (wordPositions.length === 1) {
        minSpan = 0;
    } else {
        for (let pos0 of wordPositions[0]) {
            for (let pos1 of wordPositions[1] || [pos0]) {
                const p2List = wordPositions[2] || [pos1];
                for (let pos2 of p2List) {
                    const p3List = wordPositions[3] || [pos2];
                    for (let pos3 of p3List) {
                        const maxP = Math.max(pos0, pos1, pos2, pos3);
                        const minP = Math.min(pos0, pos1, pos2, pos3);
                        const span = maxP - minP;
                        if (span < minSpan) minSpan = span;
                    }
                }
            }
        }
    }

    const maxAllowedSpan = queryWords.length + 3;

    if (minSpan <= maxAllowedSpan) {
        const proximityScore = 90 - (minSpan * 5);
        return { score: Math.max(proximityScore, 70), label: 'CLOSE_PROXIMITY' };
    }

    return { score: 0, label: 'REJECTED_SCATTERED_WORDS' };
}

async function searchTikTok(keyword, page = 1, regionTarget = 'ID') {
    const cursor = (page - 1) * ITEMS_PER_PAGE;
    const apiUrl = 'https://www.tikwm.com/api/feed/search';

    const params = new URLSearchParams({
        keywords: keyword,
        count: 100,
        cursor: cursor,
        sort_type: 0
    });

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: params.toString()
        });

        if (!response.ok) {
            console.error(`[ERROR] HTTP Error Status: ${response.status}`);
            return [];
        }

        const data = await response.json();
        if (data.code !== 0) {
            console.error(`[API ERROR] Code: ${data.code}, Message: ${data.msg}`);
            return [];
        }

        const rawVideos = data.data?.videos || [];

        const evaluated = rawVideos
            .map(item => {
                const evalResult = evaluatePrecision(item, keyword, regionTarget);
                return { item, score: evalResult.score, label: evalResult.label };
            })
            .filter(entry => entry.score > 0)
            .sort((a, b) => b.score - a.score);

        const topVideos = evaluated.slice(0, ITEMS_PER_PAGE);

        const results = topVideos.map(entry => {
            const item = entry.item;
            const createTimeUnix = item.create_time || 0;
            const uploadDate = createTimeUnix ? new Date(createTimeUnix * 1000).toISOString().replace('T', ' ').substring(0, 19) : 'N/A';
            
            const caption = item.title || '';
            const hashtags = caption.split(/\s+/).filter(word => word.startsWith('#'));

            let playUrl = item.play || '';
            if (playUrl && !playUrl.startsWith('http')) playUrl = `https://www.tikwm.com${playUrl}`;
            if (playUrl.startsWith('http://')) playUrl = playUrl.replace('http://', 'https://');

            let wmPlayUrl = item.wmplay || '';
            if (wmPlayUrl && !wmPlayUrl.startsWith('http')) wmPlayUrl = `https://www.tikwm.com${wmPlayUrl}`;
            if (wmPlayUrl.startsWith('http://')) wmPlayUrl = wmPlayUrl.replace('http://', 'https://');

            let musicUrl = item.music || '';
            if (musicUrl && !musicUrl.startsWith('http')) musicUrl = `https://www.tikwm.com${musicUrl}`;
            if (musicUrl.startsWith('http://')) musicUrl = musicUrl.replace('http://', 'https://');

            const author = item.author || {};
            const musicInfo = item.music_info || {};

            return {
                accuracy: `${entry.score}% (${entry.label})`,
                region: item.region || 'ID',
                title: caption,
                upload_date: uploadDate,
                duration: `${item.duration}s`,
                hashtags: hashtags,
                stats: {
                    views: item.play_count,
                    likes: item.digg_count,
                    comments: item.comment_count,
                    shares: item.share_count,
                    saves: item.collect_count
                },
                creator: {
                    name: author.nickname,
                    username: `@${author.unique_id}`,
                    avatar: author.avatar
                },
                audio: {
                    title: musicInfo.title,
                    author: musicInfo.author,
                    mp3_url: musicUrl
                },
                links: {
                    tiktok_web: `https://www.tiktok.com/@${author.unique_id}/video/${item.video_id}`,
                    stream_mp4_no_wm: playUrl,
                    stream_mp4_wm: wmPlayUrl,
                    cover_image: item.cover,
                    animated_gif: item.dynamic_cover
                }
            };
        });

        return results;
    } catch (error) {
        console.error(`[EXCEPTION] ${error.message}`);
        return [];
    }
}

async function downloadVideo(cdnUrl, outputFilePath) {
    console.log(`\n⏳ Mengunduh video dari CDN ke file: ${outputFilePath}...`);
    try {
        const response = await fetch(cdnUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://www.tiktok.com/'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP Error Status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(outputFilePath, buffer);
        console.log(`✅ [DOWNLOAD BERHASIL] File tersimpan: ${outputFilePath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)\n`);
    } catch (err) {
        console.error(`❌ [DOWNLOAD GAGAL] ${err.message}\n`);
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

        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const query = parsedUrl.query;

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
            const customFilename = query.filename || 'tiktok_video.mp4';

            if (!videoCdnUrl) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    created_by: "Lann",
                    error: "Parameter 'url' wajib diisi. Contoh: /api/download?url=https://v45.tiktokcdn-us.com/..."
                }, null, 4));
                return;
            }

            try {
                const fetchRes = await fetch(videoCdnUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Referer': 'https://www.tiktok.com/'
                    }
                });

                if (!fetchRes.ok) {
                    res.writeHead(fetchRes.status, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ created_by: "Lann", error: `Gagal mengambil CDN, HTTP status: ${fetchRes.status}` }));
                    return;
                }

                res.writeHead(200, {
                    'Content-Type': 'video/mp4',
                    'Content-Disposition': `attachment; filename="${customFilename}"`,
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
        console.log('\n' + '='.repeat(80));
        console.log(`🚀 TIKTOK REST API SERVER AKTIF! (Created by Lann)`);
        console.log(`📍 Host: http://localhost:${port}`);
        console.log(`🔍 Search API   : http://localhost:${port}/api/search?keyword=about+you&region=ID`);
        console.log(`📥 Download API : http://localhost:${port}/api/download?url=<FULL_CDN_URL>`);
        console.log('='.repeat(80) + '\n');
    });
}

function promptInteractive(rl, queryText) {
    return new Promise((resolve) => {
        if (!rl || rl.closed) {
            return resolve('q');
        }
        try {
            rl.question(queryText, (answer) => {
                resolve((answer || '').trim());
            });
        } catch (e) {
            resolve('q');
        }
    });
}

// --- MAIN CONTROLLER (CLI vs REST API MODE) ---
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

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let running = true;

    while (running) {
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

        console.log(JSON.stringify(finalOutput, null, 4));

        const safeKeyword = keyword.replace(/[^a-zA-Z0-9_-]/g, '_');
        const jsonFilename = `search_${safeKeyword}_page_${currentPage}.json`;
        fs.writeFileSync(jsonFilename, JSON.stringify(finalOutput, null, 4), 'utf-8');

        console.log('\n' + '='.repeat(80));
        console.log(`📌 NAVIGASI CLI [REGION: ${formatRegionLabel(currentRegion)}] (Kreator: Lann):`);
        console.log(` ➔ Tekan [ENTER]           : Lanjut Halaman ${currentPage + 1}`);
        console.log(` ➔ Ketik nomor             : Lompat Halaman (misal '3')`);
        console.log(` ➔ Ketik 'r <kode_region>' : Ubah Region (misal 'r US', 'r MY', 'r ALL')`);
        console.log(` ➔ Ketik 'help'            : Tampilkan Panduan Manual Lengkap`);
        console.log(` ➔ Ketik 'q'               : Keluar`);
        console.log('='.repeat(80));

        const answer = await promptInteractive(rl, `▶ [PAGE ${currentPage} | REGION: ${currentRegion}] Opsi (atau 'help'): `);

        if (answer.toLowerCase() === 'q' || answer.toLowerCase() === 'exit') {
            console.log('\n👋 Terima kasih telah menggunakan TikTok Search Scraper by Lann!\n');
            running = false;
        } else if (answer.toLowerCase() === 'help') {
            printCliManual();
        } else if (answer.toLowerCase().startsWith('r ')) {
            const newReg = answer.split(/\s+/)[1];
            if (newReg) {
                currentRegion = newReg.toUpperCase();
                console.log(`\n🔄 Region diubah menjadi: ${formatRegionLabel(currentRegion)}\n`);
            }
        } else if (answer === '') {
            currentPage += 1;
        } else {
            const targetPage = parseInt(answer, 10);
            if (!isNaN(targetPage) && targetPage > 0) {
                currentPage = targetPage;
            } else {
                console.log('⚠️ Input tidak valid. Keluar dari navigator...');
                running = false;
            }
        }
    }

    rl.close();
}

main();
