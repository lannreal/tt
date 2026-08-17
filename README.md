# 🚀 TikTok Ultra-Precision Search Scraper & REST API Engine (v2.0)

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v18%2B-green?style=for-the-badge&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/Dependencies-Zero%20NPM-blue?style=for-the-badge" alt="Zero Dependencies" />
  <img src="https://img.shields.io/badge/Cookie-Pre--Configured%20%E2%9C%94%EF%B8%8F-brightgreen?style=for-the-badge" alt="Cookie Included" />
  <img src="https://img.shields.io/badge/Termux%20Android-Super%20Lightweight%20(128MB)-orange?style=for-the-badge&logo=android" alt="Termux Android" />
  <img src="https://img.shields.io/badge/WAF%20Protection-Smart%20Auto--Recovery-red?style=for-the-badge" alt="WAF Auto Recovery" />
  <img src="https://img.shields.io/badge/Creator-Lann-purple?style=for-the-badge" alt="Creator Lann" />
</p>

> **Created with ❤️ by Lann**  
> Engine pencarian TikTok presisi tinggi, metadata scraper (*Views, Likes, Comments, Shares, Saves, Duration, Audio MP3, Direct MP4 No Watermark*), serta server REST API bawaan dengan arsitektur **Zero External NPM Dependencies**.  
> **Siap Pakai (Out-of-the-Box)**: File `cookie.txt` sudah disertakan langsung di repository, siap di-run langsung di **PC** maupun **HP Android via Termux** tanpa setting rumit!

---

## 📑 Daftar Isi

- [🆕 Apa yang Baru di v2.0?](#-apa-yang-baru-di-v20)
- [✨ Fitur Unggulan](#-fitur-unggulan)
- [🪶 Mengapa Headless Browser Buatan Kita Sangat Ringan?](#-mengapa-headless-browser-buatan-kita-sangat-ringan)
- [📱 Panduan Lengkap Termux (Android)](#-panduan-lengkap-termux-android)
- [💻 Panduan di PC (Windows / Linux / macOS)](#-panduan-di-pc-windows--linux--macos)
- [⚙️ Mekanisme Smart WAF Auto-Recovery & Arsitektur](#️-mekanisme-smart-waf-auto-recovery--arsitektur)
- [🔑 Panduan Lengkap Konfigurasi Cookie](#-panduan-lengkap-konfigurasi-cookie)
- [🖥️ Panduan CLI Interaktif](#️-panduan-cli-interaktif)
- [🌐 Panduan REST API Server](#-panduan-rest-api-server)
- [📥 Direct Video Downloader](#-direct-video-downloader)
- [📄 Spesifikasi Skema Data JSON](#-spesifikasi-skema-data-json)
- [🛡️ Fitur Keamanan, Memory & Stabilitas Jangka Panjang](#️-fitur-keamanan-memory--stabilitas-jangka-panjang)

---

## 🆕 Apa yang Baru di v2.0?

* 🛡️ **Smart WAF Auto-Recovery Engine**: Otomatis mendeteksi dan melewati layar proteksi robot *"Something went wrong"* dengan menstimulasi event *Try again* yang memicu kalkulasi token *WebAssembly (`X-Bogus`/`X-Gnarly`)* secara instan.
* 📱 **Termux Low-RAM Optimization**: Dibatasi maksimal **128 MB V8 Heap** (`--max-old-space-size=128`) dengan flag `--disable-dev-shm-usage` dan `--no-sandbox`. Sangat adem, tidak membuat HP lag, dan RAM langsung bersih kembali 100% setelah 2–4 detik scraping.
* 🎯 **Universal Video Permalink Selector**: Menggunakan ekstraksi regex permalink inti `/\/video\/(\d+)/` yang independen dari perubahan nama class CSS React TikTok.
* ⚡ **Pre-Enriched Metadata**: Video hasil pencarian langsung diperkaya secara paralel dengan data views, likes, shares, direct MP4 no watermark, audio MP3, avatar kreator, dan cover HD.
* 🔒 **Async Mutex Concurrency Lock**: Mencegah tabrakan port CDP dan CPU thrashing saat banyak request masuk bersamaan pada mode REST API Server.

---

## ✨ Fitur Unggulan

- ⚡ **Zero NPM Dependencies**: 100% modul native Node.js (`http`, `net`, `child_process`, `fs`, `readline`). Tidak butuh *Puppeteer*, *Playwright*, atau library eksternal lainnya.
- 🪶 **Engine Headless Super Ringan (Custom Native CDP)**: Menggunakan driver CDP native buatan sendiri tanpa beban runtime Puppeteer/Playwright (hemat RAM hingga 85%, hanya ~40–60MB RAM selama 2–3 detik).
- 🍪 **Pre-Configured Cookie**: Sudah dilengkapi file `cookie.txt` aktif bawaan di repo. Tinggal clone dan langsung jalankan!
- 📊 **Statistik 100% Real**: Views, Likes, Comments, Shares, Saves, dan Durasi Video presisi tinggi.
- 🎬 **Direct HD Stream**: Link stream MP4 No Watermark (`stream_mp4_no_wm`) & Watermark langsung dari CDN ByteDance.
- 🎵 **Direct Audio MP3**: Link download audio resmi `.mp3` langsung dari CDN TikTok.
- 🖼️ **HD Cover & Dynamic Animated GIF**: Thumbnail original resolusi penuh serta animasi dinamis GIF preview video.
- 🌍 **Multi-Region Filter**: Mendukung filter region spesifik (`ID`, `US`, `MY`, `JP`, `VN`, `TH`, `GB`, `KR`, dll.) serta mode Global (`ALL`).
- 🚀 **Built-in REST API Server**: Endpoint siap pakai untuk bot WhatsApp, Telegram, Discord, atau Web Dashboard.

---

## 🪶 Mengapa Headless Browser Buatan Kita Sangat Ringan?

Banyak orang mengira menjalankan browser di HP (Termux) atau VPS spek rendah akan membuat sistem lag dan kehabisan memori (OOM). **Tidak dengan engine ini!** Berikut alasannya:

1. 🚫 **Bukan Puppeteer / Playwright (Zero Overhead)**:
   - Library seperti Puppeteer membawa puluhan dependency berat dan memakan RAM **300 MB s/d 500 MB+**.
   - Scraper ini menggunakan **Native CDP Socket Client** buatan sendiri yang berkomunikasi langsung ke port debugging browser via modul native Node.js (`net` & `WebSocket`).
2. ⏱️ **Siklus Hidup Hit-and-Kill (Ephemeral Lifecycle)**:
   - Browser **TIDAK** berjalan terus-menerus di background. Browser hanya di-spawn saat request pencarian datang, mengambil data selama **2–3 detik**, lalu prosesnya **langsung di-kill secara paksa (`SIGKILL`)** dan seluruh memori RAM langsung dilepas kembali 100%!
3. 🔒 **Kunci Memori V8 128 MB (`--max-old-space-size=128`)**:
   - Alokasi memori JavaScript Chrome dibatasi keras maksimal **128 MB**, sehingga tidak mungkin terjadi kebocoran memori (memory leak).
4. ⚡ **Bypass GPU & Render Berat**:
   - Dijalankan dengan flag `--disable-gpu`, `--disable-software-rasterizer`, dan `--disable-dev-shm-usage` yang mematikan render visual tidak perlu, menjaga CPU dan suhu perangkat tetap adem.

---

## 📱 Panduan Lengkap Termux (Android)

Scraper ini dirancang khusus agar **sangat ringan dan ramah baterai** di HP Android via Termux.

### 1. Update Package & Install Environment
Di Termux, paket `chromium` berada di repositori **`x11-repo`** atau **`tur-repo`**. Jalankan perintah berikut:
```bash
# Update & install Node.js, Git, serta Chromium via x11-repo:
pkg update -y && pkg install nodejs git x11-repo -y && pkg install chromium -y
```
*(Alternatif jika x11-repo tidak tersedia di devicemu):*
```bash
pkg install tur-repo -y && pkg install chromium -y
```

### 2. Clone Repository
```bash
git clone https://github.com/lannreal/aemprem.git
cd aemprem
```

### 3. Jalankan Pencarian
```bash
# Pencarian Standar (Region Default: ID)
node tt.js search "about you"

# Pencarian Global / Seluruh Dunia
node tt.js search "about you" 1 ALL

# Pencarian Region Khusus (Contoh: Jepang / US)
node tt.js search "anime edit" 1 JP
node tt.js search "cyberpunk edit" 1 US

# Menjalankan REST API Server di HP
node tt.js api 3000
```

> 💡 **Mengapa Sangat Ringan di Termux?**
> Browser Chromium hanya menyala di background selama **2–3 detik** untuk mengambil data, menggunakan memori RAM maksimal **128 MB**, lalu instance browser **langsung dimatikan total** sehingga RAM HP langsung kembali 0 MB!

---

## 💻 Panduan di PC (Windows / Linux / macOS)

### 1. Prasyarat
* **Node.js (v18+)**
* Browser **Google Chrome**, **Microsoft Edge**, atau **Chromium** terpasang di sistem.

### 2. Clone & Eksekusi
```bash
# 1. Clone repository
git clone https://github.com/lannreal/tt.git
cd tt

# 2. Jalankan pencarian langsung
node tt.js search "shape of my heart" 1 ALL

# 3. Jalankan REST API Server
node tt.js api 3000
```

---

## ⚙️ Mekanisme Smart WAF Auto-Recovery & Arsitektur

Scraper ini menggabungkan sistem **Hybrid 2-Tier Architecture**:

```
[User Request] 
      │
      ▼
[Tier 1: Native Headless CDP Browser] 
      ├─ Direct Navigation to /search?q=<keyword>
      ├─ WAF Screen Detection ("Something went wrong")
      ├─ Auto-Click "Try again" ➜ Generates WASM X-Bogus/X-Gnarly Tokens
      └─ Universal Regex Scraper Extracts Video IDs & Permalinks
      │
      ▼
[Tier 2: Multi-Datacenter Fast-Race & Enrichment Engine]
      ├─ Aweme Multi-Datacenter API (useast2a, alisg, useast1a, va)
      ├─ Official Public TikTok oEmbed API (High Reliability Meta)
      └─ Direct Downloader CDN Resolvers (ssstik + lovetik)
      │
      ▼
[JSON Clean Output / REST API Response]
```

---

## 🔑 Panduan Lengkap Konfigurasi Cookie

Repository ini **sudah menyertakan `cookie.txt` aktif bawaan** yang siap digunakan out-of-the-box. Jika kamu ingin memperbarui atau menggunakan akun TikTok milikmu sendiri, gunakan panduan berikut:

### 📋 Tabel 12 Parameter Cookie TikTok Resmi

| Nama Parameter Cookie | Kategori | Deskripsi & Peran Teknis |
| :--- | :--- | :--- |
| `sessionid` | **Wajib (Utama)** | Kunci otentikasi sesi login utama akun TikTok. |
| `sessionid_ss` | **Wajib** | Token *Secure Session* untuk enkripsi jalur HTTPS. |
| `sid_tt` | **Wajib** | Identifier sesi web internal TikTok. |
| `sid_guard` | **Wajib** | Token pengaman dan verifikasi masa berlaku sesi login. |
| `ttwid` | **Wajib** | Token identitas perangkat/browser unik dari ByteDance WAF. |
| `s_v_web_id` | **Wajib** | Token verifikasi deteksi bot dan bypass captcha (*Web Security ID*). |
| `msToken` | **Wajib** | Token tanda tangan dinamis request API TikTok. |
| `tt_csrf_token` | Pendukung | Token proteksi keamanan *Cross-Site Request Forgery*. |
| `tt_chain_token` | Pendukung | Token validasi aliran request berantai ByteDance. |
| `uid_tt` / `uid_tt_ss` | Pendukung | Identifier unik User ID akun TikTok. |
| `store-country-code` | Regional | Kode negara preferensi akun (contoh: `id`, `us`, `my`). |
| `tt-target-idc` | Routing | Identifier routing data center TikTok (contoh: `alisg`, `useast2a`). |

---

### 🛠️ 2 Cara Termudah Menyalin Seluruh Cookie Sekaligus:

#### Cara 1: Menggunakan DevTools Network (Paling Direkomendasikan)
1. Buka [tiktok.com](https://www.tiktok.com) di browser dan pastikan sudah login.
2. Tekan **`F12`** (atau `Ctrl + Shift + I`) untuk membuka **Developer Tools**.
3. Buka tab **Network**, lalu refresh halaman (`F5`).
4. Klik pada request pertama paling atas (bernama `www.tiktok.com` atau `search`).
5. Di panel kanan, lihat bagian **Headers** > **Request Headers**.
6. Cari baris **`Cookie:`**, klik kanan pada baris tersebut, lalu pilih **Copy value**.
7. Buka file `cookie.txt` di folder project dan tempelkan (*paste*) isinya.

#### Cara 2: Menggunakan Console DevTools (1 Baris Perintah)
1. Buka [tiktok.com](https://www.tiktok.com) di browser.
2. Buka tab **Console** di Developer Tools (`F12`).
3. Ketik perintah berikut lalu tekan **Enter**:
   ```javascript
   copy(document.cookie)
   ```
4. Seluruh cookie yang aktif otomatis tersalin ke clipboard. Buka file `cookie.txt` dan tempelkan isinya.

> 💡 **Masa Aktif Cookie**: Cookie TikTok biasanya bertahan **2 hingga 3 bulan**. Jangan klik tombol *"Log Out"* di browser agar sesi cookie tetap aktif.

---

## 🖥️ Panduan CLI Interaktif

Saat menjalankan pencarian di terminal, output disajikan dalam format JSON yang bersih dengan menu navigasi minimalis 1 baris di bawah:

```text
───────────────────────────────────────────────────────────────────────────
[Page 1 · ALL (Global / Worldwide)] [Enter] Next · [1-9] Jump · [r <reg>] Region · [q] Quit
› 
```

### Tombol / Perintah Navigasi:
| Input | Fungsi |
| :--- | :--- |
| **`[ENTER]`** | Lanjut ke Halaman Berikutnya (Page 2, 3, dst.) |
| **`1-9`** | Langsung melompat ke nomor halaman tertentu (misal ketik `3` lalu Enter) |
| **`r <kode_region>`** | Mengganti filter region secara instan (misal `r US`, `r JP`, `r ID`, `r ALL`) |
| **`help`** | Menampilkan panduan manual CLI |
| **`q`** atau **`exit`** | Keluar dari program |

---

## 🌐 Panduan REST API Server

Jalankan scraper sebagai service background REST API:

```bash
node tt.js api 3000
```
*Output:*
```text
TikTok REST API Server Active (http://localhost:3000)
• Search API   : http://localhost:3000/api/search?keyword=about+you&region=ALL
• Download API : http://localhost:3000/api/download?url=<CDN_URL>
```

### 1. Endpoint Search (`GET /api/search`)
**Query Parameters:**
| Parameter | Tipe | Wajib | Keterangan |
| :--- | :--- | :--- | :--- |
| `keyword` atau `q` | String | **Ya** | Kata kunci pencarian video |
| `page` | Number | Tidak | Nomor halaman (default: `1`) |
| `region` | String | Tidak | Kode negara (`ID`, `US`, `JP`, `ALL`, default: `ID`) |

**Contoh Request:**
```http
GET http://localhost:3000/api/search?keyword=about+you&page=1&region=ALL
```

---

### 2. Endpoint Download Stream (`GET /api/download`)
Mengalirkan (*streaming*) video langsung dari CDN TikTok sebagai file attachment:

**Query Parameters:**
| Parameter | Tipe | Wajib | Keterangan |
| :--- | :--- | :--- | :--- |
| `url` atau `link` | String | **Ya** | URL CDN video dari `stream_mp4_no_wm` atau `stream_mp4_wm` |
| `filename` | String | Tidak | Nama file output (default: `tiktok_video.mp4`) |

**Contoh Request:**
```http
GET http://localhost:3000/api/download?url=https://tikcdn.io/ssstik/7619336725319453972&filename=about_you.mp4
```

---

## 📥 Direct Video Downloader

Unduh video CDN langsung ke penyimpanan lokal via CLI:

```bash
node tt.js download "<URL_STREAM_MP4>" nama_video.mp4
```

---

## 📄 Spesifikasi Skema Data JSON

```json
{
    "created_by": "Lann",
    "search_engine": "TikTok Ultra-Precision Search Scraper",
    "search_info": {
        "keyword": "about you",
        "current_page": 1,
        "current_region": "ALL (Global / Worldwide)",
        "items_per_page": 5,
        "total_items_found": 3
    },
    "data": [
        {
            "accuracy": "100% (EXACT_MATCH)",
            "region": "ALL",
            "title": "The 1975 - About You (Full Lyrics) | #the1975 #aboutyou #applemusic #fyp #lyric #lyrics #musicvibe #musicvibes ",
            "upload_date": "3/20/2026",
            "duration": "326.2s",
            "hashtags": [
                "#the1975",
                "#aboutyou",
                "#applemusic",
                "#fyp",
                "#lyric",
                "#lyrics",
                "#musicvibe",
                "#musicvibes"
            ],
            "stats": {
                "views": "2,124,016",
                "likes": "82,656",
                "comments": "616",
                "shares": "9,515",
                "saves": "14,951"
            },
            "creator": {
                "name": "Music Vibes",
                "username": "@music.vibes_32",
                "avatar": "https://p16-common-sign.tiktokcdn-eu.com/tos-alisg-avt-0068/..."
            },
            "audio": {
                "title": "About You",
                "author": "The 1975",
                "mp3_url": "https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-ve-2774/..."
            },
            "links": {
                "tiktok_web": "https://www.tiktok.com/@music.vibes_32/video/7619336725319453972",
                "stream_mp4_no_wm": "https://v16m-default.tiktokcdn-eu.com/...",
                "stream_mp4_wm": "https://v16m-default.tiktokcdn-eu.com/...",
                "cover_image": "https://p16-common-sign.tiktokcdn-eu.com/tos-alisg-p-0037/...",
                "animated_gif": "https://p16-common-sign.tiktokcdn-eu.com/tos-alisg-p-0037/..."
            }
        }
    ]
}
```

---

## 🛡️ Fitur Keamanan, Memory & Stabilitas Jangka Panjang

1. **Zero Disk Leaks (`fs.rmSync`)**: Folder temporary user data browser otomatis dihapus dari memori penyimpanan setiap kali request selesai.
2. **Zombie Process Prevention**: Handler sinyal OS (`SIGINT`, `SIGTERM`, `uncaughtException`) memastikan tidak ada proses Chromium yang tertinggal jika aplikasi dihentikan paksa.
3. **Async Mutex Concurrency Lock**: Menangani request simultan pada mode REST API secara antrean teratur agar RAM perangkat tidak overload.
4. **V8 Memory Capping**: Membatasi penggunaan memori V8 heap Chrome pada 128 MB sehingga sangat bersahabat untuk perangkat smartphone.
5. **Multi-Datacenter Fallback**: Jika salah satu gateway datacenter TikTok mengalami rate limit, request otomatis dialihkan ke gateway datacenter lain secara instan.

---

## 👨‍💻 Kontributor & Lisensi

- **Lead Developer**: Lann
- **License**: MIT
- **Issues & Pull Requests**: [GitHub Repository Issues](https://github.com/lannreal/tt/issues)
