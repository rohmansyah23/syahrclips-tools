# PLAN.md — syahrclips-tools

Rencana eksekusi untuk port 3 fitur SyahrClips menjadi app mandiri berbasis
Next.js + TypeScript yang (nanti) di-hosting di **Vercel (Hobby / gratis)**.

> Dokumen ini dibaca oleh coding agent/sesi lain sebelum mengubah proyek.
> Bahasa percakapan: Bahasa Indonesia.

---

## 1. Latar Belakang

SyahrClips (repo terpisah, `~/a-project/syahrclips`) punya backend FastAPI
(Python) dengan job queue + media processing. Pengguna **hanya** membutuhkan
3 fitur dan ingin menjalankannya di Vercel tanpa backend Python:

1. **Download transcript** — transkrip YouTube ber-timestamp, format ramah LLM.
2. **Preview berdasarkan candidate import JSON LLM** — paste `{start, end}`,
   preview rentang video.
3. **Download video hasil preview** — unduh klip hasil potong.

Vercel = serverless + stateless → arsitektur berubah total dari backend
Python (job queue, file persist) menjadi **route handler sinkron** dalam satu
app Next.js. Ini **tulis ulang (rewrite) ke TypeScript**, bukan port kode.

**Status proyek (16 Agu 2026):** direktori hanya berisi `docs/` (PRD, DESIGN,
PLAN). **Belum ada kode, belum ada git repo, dan GitHub/Vercel BELUM dibuat
oleh user.** Konsekuensi:

- Semua pekerjaan dilakukan **lokal dulu** (scaffold, implementasi, verifikasi
  via `lint` + `build` + tes manual).
- **DILARANG** `git init`/`git remote`/`git push` dan **jangan** connect ke
  Vercel sampai user mengonfirmasi repo GitHub & akun Vercel sudah dibuat.
- Bagian Deploy (Bab 7) hanya dieksekusi setelah user siap.

## 2. Keputusan yang Sudah Dikunci (final)

| Aspek | Keputusan |
| --- | --- |
| Hosting | Vercel **Hobby (gratis)** — **ditunda**, tunggu user buat akun |
| Domain awal | URL `*.vercel.app` bawaan (mis. `syahrclips-tools.vercel.app`) — belum ganti DNS |
| Nama repo | **BELUM dibuat** — user akan membuat GitHub repo sendiri; jangan push/connect dulu |
| Lokasi | Direktori proyek ini (lokal, `~/a-project/syahrclips-tools`) |
| Akses GitHub | **Ditunda** — tidak ada `git remote`/push sampai repo dibuat user |
| Pemakaian | Pribadi, < 20x/hari |
| Keamanan API | Publik tanpa auth (repo & pemakaian pribadi) |
| Env var | Tidak ada — semua fitur bebas API key |
| Bahasa UI | Indonesia (konsisten dengan syahrclips) |

## 3. Stack

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 (CSS-first).
- Dependensi runtime:
  - `youtube-transcript` — fetch transkrip (0 deps, dirancang serverless).
  - `youtube-dl-exec` (yt-dlp) — resolusi format + streaming URL video.
  - `ffmpeg-static` — binary ffmpeg linux untuk potong klip (`-c copy`).

> **Catatan penting (16 Agu 2026):** rencana semula memakai `@distube/ytdl-core`,
> tapi package itu **di-archive 16 Agu 2025** dan gagal mem-parse player script
> YouTube terbaru (decipher/n-transform) sehingga streaming URL selalu 403.
> Digantikan `youtube-dl-exec` (membundel binary yt-dlp yang aktif dipelihara).
> youtubei.js sempat diuji tapi gagal dapat URL stream dari IP datacenter
> (butuh po_token); yt-dlp terbukti berfungsi.
- Desain: **light editorial** (mengikuti `docs/DESIGN.md`, sumber
  syahrworks-portfolio) — typography-led, hairline, tanpa gradient ungu /
  tanpa efek dekoratif AI-generik.

## 4. Struktur Repo

```
syahrclips-tools/
  app/
    layout.tsx            # root layout + token desain editorial
    globals.css
    page.tsx              # landing → tautan 3 tool
    tools/transcript/page.tsx   # paste URL → transkrip + salin/.txt
    tools/preview/page.tsx      # paste JSON LLM → candidate + iframe preview
    tools/clip/page.tsx         # pilih candidate → download klip mp4
    api/transcript/route.ts     # GET/POST → transkrip (sinkron)
    api/clip/route.ts           # POST → klip mp4 (binary response)
  components/
    ui.tsx                # primitif UI kecil (Button, Card, dll.)
    SiteNav.tsx           # nav + breadcrumb
  lib/
    transcript.ts         # logika format [HH:MM:SS] + metadata
    clip.ts               # logika byte-range + trim ffmpeg
    types.ts
  docs/
    PLAN.md               # dokumen ini
  package.json
  tsconfig.json
  next.config.ts
```

## 5. Implementasi per Fitur

### 5.1 Transcript — ✅ aman di Vercel

- `POST /api/transcript`:
  - Validasi URL YouTube → ambil `videoId`.
  - `fetchTranscript(videoId)` dari `youtube-transcript`.
  - Metadata judul/author via `https://www.youtube.com/oembed?url=…&format=json`
    (resmi, ringan, tanpa key).
  - Output JSON:
    ```json
    {
      "videoId": "…",
      "title": "…",
      "author": "…",
      "segments": [{ "start": 0.0, "end": 3.5, "text": "…" }],
      "text": "[00:00:00] …\n[00:00:03] …",
      "stats": { "segments": 0, "words": 0, "chars": 0 }
    }
    ```
- Halaman: paste URL → tampil transkrip → tombol **Salin semua** & **↓ .txt**.

### 5.2 Preview dari JSON LLM — ✅ tanpa backend

- Paste JSON daftar candidate, contoh:
  ```json
  [
    { "start": 65, "end": 70, "reason": "momen paling menarik" },
    { "start": 120, "end": 135 }
  ]
  ```
- Tiap candidate dipreview via iframe:
  `https://www.youtube-nocookie.com/embed/{videoId}?start={s}&end={e}`
- Tombol **Salin format** → output format JSON yang sama dengan fitur 1,
  supaya alur transcript → LLM → preview konsisten.
- Tidak ada pemanggilan API sendiri.

### 5.3 Download klip — ⚠️ desain untuk survive Hobby

Alur `POST /api/clip` (implementasi aktual):

1. `youtube-dl-exec` → `yt-dlp -J` → pilih format **progresif mp4** kualitas
   terendah (audio+video jadi satu, tanpa fragment/HLS agar ffmpeg bisa seek).
   Ambil `url`, `http_headers`, `duration`.
2. **ffmpeg melakukan semuanya dari URL stream langsung**:
   `ffmpeg -headers {UA} -ss {start} -t {dur} -i {streamUrl} -c copy -movflags +faststart -f mp4 out.mp4`
   — ffmpeg menangani range-seeking HTTP + pembacaan moov sendiri, sehingga
   hasilnya valid walau moov ada di akhir file (`-c copy` = tanpa re-encode).
3. Balas binary mp4 sebagai respons HTTP → browser langsung unduh.
   `Content-Disposition: attachment`.

> Pendekatan byte-range manual (estimasi `startByte` + unduh rentang + trim
> lokal) **tidak dipakai** — terbukti gagal: segmen tengah mp4 tidak punya
> moov atom sehingga ffmpeg tidak bisa parse. ffmpeg stream langsung lebih
> robust dan hanya mengunduh ±rentang klip (uji: klip 15 detik ≈ 1,3 MB,
> selesai ±9 detik).
>
> Binary ffmpeg: preferensi system ffmpeg (`/usr/bin/ffmpeg`) bila ada — build
> statis (ffmpeg-static) bisa segfault pada input https di sebagian lingkungan
> (mis. sandbox dengan TLS interception) — lalu fallback ke `ffmpeg-static`
> (dipakai di Vercel yang tanpa ffmpeg sistem).

Batasan yang dimonitor:
- `export const maxDuration = 60` (batas Hobby; naikkan bila Vercel mengizinkan
  300s di Hobby saat ini).
- Ukuran bundle fungsi: ffmpeg-static ~30–40MB compressed — **ini titik paling
  berisiko** terhadap batas ukuran fungsi Hobby. Verifikasi pertama saat deploy.

## 6. Rencana Eksekusi Bertahap

Urutan kerja **lokal dulu**; Fase 6 hanya jalan setelah user membuat
GitHub/Vercel.

| Fase | Isi | Output / Verifikasi |
| --- | --- | --- |
| **F0 — Scaffold lokal** | `create-next-app` (App Router, TS, Tailwind 4) di direktori ini; install `youtube-transcript`, `@distube/ytdl-core`, `ffmpeg-static`; token desain + font (Instrument Serif / Inter / JetBrains Mono) dari DESIGN.md | `npm run dev` jalan; halaman kosong tampil |
| **F1 — Transcript** | `lib/transcript.ts` (parse URL, format timestamp, stats) → `app/api/transcript/route.ts` → halaman `/tools/transcript` | Video ber-caption → `[HH:MM:SS]`; tanpa caption → pesan jelas |
| **F2 — Preview** | Halaman `/tools/preview`: textarea JSON + validasi + grid iframe `youtube-nocookie`; tombol salin format | Contoh JSON → semua candidate tampil dengan range benar |
| **F3 — Clip** | `lib/clip.ts` (byte-range + trim ffmpeg) → `app/api/clip/route.ts` (binary mp4) → halaman `/tools/clip` | Klip 15–30s terunduh, durasi sesuai, bisa diputar |
| **F4 — Landing & polish** | `app/page.tsx` (3 kartu tool), `SiteNav`, responsive mobile, semua teks Indonesia | `npm run lint` tanpa error |
| **F5 — Verifikasi lokal** | `npm run build` LOLOS; tes manual F1–F3 di `localhost` | Build lolos (perhatikan ukuran bundle ffmpeg-static) |
| **F6 — Deploy ⏸** | Hanya setelah user buat repo GitHub + akun Vercel: `git init` → remote → push → import Vercel (project BARU) → tes di produksi | Log Vercel wajar, tidak 504; lihat Bab 7 |

**Gate:** F6 **tidak** dimulai tanpa konfirmasi user bahwa repo GitHub & akun
Vercel sudah dibuat. Semua fase F0–F5 bisa jalan sekarang, sepenuhnya lokal.

## 7. Deploy — ⏸ DITUNDA (menunggu user)

> **Jangan** `git init`/`git remote`/`git push`, dan **jangan** import Vercel,
> sampai user mengonfirmasi repo GitHub & akun Vercel sudah dibuat.

Saat user siap (setelah F5 lolos), langkahnya:

1. User membuat repo GitHub (mis. `rohmansyah23/syahrclips-tools`, public) —
   lalu baru:
   ```sh
   cd ~/a-project/syahrclips-tools
   git init -b main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. Vercel dashboard → **Add New Project** → pilih repo → Deploy.
   - **Project baru** — jangan diarahkan ke project `syahrworks`.
3. URL produksi: `syahrclips-tools.vercel.app`.
4. **Tanpa environment variable.**
5. Nanti (opsional): tambah A record `tools` → `76.76.21.21` di Dewabiz untuk
   `tools.syahrworks.com`. Tidak mengganggu record `@`/`www` yang menunjuk VPS.

## 8. Checklist Verifikasi

Status per 16 Agu 2026 — **F0–F5 selesai, terverifikasi lokal** (belum deploy):

- [x] `npm run lint` tanpa error (setelah menambah `node_modules/**` ke ignore
      eslint — config scaffold menimpa default ignore).
- [x] **Unit test** `npm test` (node:test bawaan Node, tanpa framework baru):
      **16/16** untuk logika murni yang dipindah ke `lib/clip-formats.ts`
      (`pickFormats`, `buildAttempts`, `codecName`) — preferensi h264/light,
      progresif vs DASH + audio ~128kbps, tinggi aktual (tidak upscale),
      HLS/DRM dibuang, rantai degrade, fallback di bawah minimum. Refactor
      aman: `constants.ts` re-export `CLIP_RESOLUTIONS`; lint/build hijau;
      smoke test klip via API tetap 200 + mp4 valid.
- [x] `npm run build` LOLOS (Next.js 16.3.1, Turbopack).
- [x] Transcript: Rick Astley & Me-at-the-zoo → `[HH:MM:SS]` keluar (konversi
      ms→s sudah benar); URL invalid/tanpa URL → 400; video tak tersedia → 404.
- [x] Preview: halaman render + iframe `youtube-nocookie` dengan `start`/`end`
      (validasi client-side: JSON invalid, `start>=end` ditandai).
- [x] Clip: klip 15s (30–45) → mp4 valid 640×360, durasi 15,04s, ±1,3 MB,
      selesai ±9 detik; error input → 400 (videoId invalid, rentang, >120s).
- [x] **F3 diperluas (16 Agu, malam)**: maks 3 menit (180s) + hingga 1080p +
      selector resolusi (1080/720/480/360/240/144, default 1080). 1080p diambil
      via **DASH mux** (video-only itag 137/399 + audio 140, ffmpeg `-c copy`)
      karena hampir tidak ada 1080p progresif. Terverifikasi lokal: klip 15s
      **1080p h264 penuh** (1920×1080, degraded=0, audio 128kbps) dan klip 3
      menit valid (durasi persis 3:00). Auto-degrade terbukti saat YouTube
      throttle IP (403/429/lambat → turun otomatis; header `X-Clip-*`
      melaporkan resolusi/codec aktual + flag degraded). Bug ketemu & diperbaiki:
      resolusi yang dilaporkan kini tinggi AKTUAL format, bukan target.
- [x] Respons streaming `/api/clip` (`Readable.toWeb` → NextResponse) —
      integritas terverifikasi: Content-Length = byte file (17.996.970 = MATCH).
      Penting untuk Vercel: batas body 4,5 MB tidak berlaku untuk streaming.
- [x] **Uji ulang 1080p penuh (16 Agu malam, IP sandbox masih di-throttle
      YouTube untuk unduhan besar)** — jalur 1080p h264 penuh (`degraded: 0`)
      terbukti bekerja end-to-end, hasil nyata dari sesi ini:
      - 15s (≈5,5 MB) → **1080p h264** ✅ (1920×1080, 15,08s)
      - 60s (≈22 MB) → **1080p h264** ✅
      - 120s (≈43 MB) → **1080p h264** ✅ (2:00.04, 51,4 MB, audio AAC 128kbps)
      - 150s (≈54 MB) → 720p (ditahan throttle)
      - 180s (≈65 MB) → 480p av1 (ditahan throttle; konsisten setelah jeda 5–8
        menit tenang & retry berjarak)
      → Ambang throttle IP ini hari ini ≈ 43–54 MB/permintaan. Bukan bug app:
      kode yang sama mengantar 120s 1080p penuh; 180s cuma kena pembatasan
      byte dari googlevideo. **Verifikasi final 3-menit-1080p tetap perlu IP
      non-throttle (Vercel saat deploy / IP rumahan).**
- [x] Headless Chrome: ketiga halaman tool render tanpa error JS.
- [x] E2E browser (puppeteer-core, `scripts/e2e.mjs`): 10/10 — landing, transkrip
      sukses & error 400, preview iframe, clip validasi & unduh mp4 ke disk
      (durasi klip sesuai ±15s), tanpa error console. Catatan: YouTube kadang
      rate-limit IP saat pengujian bertubi-tubi → app menampilkan ErrorNotice
      RATE LIMIT + countdown + tombol Coba lagi (terverifikasi di E2E).
- [ ] Log Vercel → Functions: durasi & memori `/api/clip` wajar, tidak 504
      (perlu deploy — ditunda sampai repo GitHub & Vercel dibuat user).
- [x] Responsif mobile + light only (dark menyusul — lihat `docs/DESIGN.md`).

## 9. Risiko & Fallback

| Risiko | Dampak | Fallback |
| --- | --- | --- |
| 403/429 YouTube dari IP Vercel | Transkrip/streaming gagal sesekali | Retry + backoff, pesan error jelas. Paling mulus dari IP rumahan. |
| Bundle ffmpeg-static melebihi batas fungsi Hobby | Deploy / runtime clip gagal | Pindahkan **hanya** `/api/clip` ke Fly.io (~$2/bln) atau Render free; transcript & preview tetap di Vercel. |
| ~~60s~~ **300s** (Fluid Compute, Hobby — perubahan Vercel Jun 2026) | Dulu batas 60s; sekarang Hobby = 300s, bundle 250MB, memori 2GB | `/api/clip` sudah `maxDuration = 300` + budget internal 280s (auto-degrade jauh sebelum 504). Pro = 800s bila perlu. |
| Respons >4,5 MB (batas body Vercel) | Klip >4,5MB gagal 500 kalau body biasa | `/api/clip` memakai **streaming function** (tidak ada batas itu) — terverifikasi Content-Length = byte. |
| 1080p = DASH video-only (jarang ada progresif) | Perlu mux video+audio | `pickFormats`: h264 dulu → av1/vp9 (data 2,6× lebih kecil) → audio ~128kbps; mux `-c copy` tanpa re-encode. |
| YouTube throttle stream besar dari IP datacenter | 1080p lambat/ditolak (terbukti saat tes: 403/429 transien) | **Auto-degrade** + ETA monitor: percobaan berantai 1080h264 → 1080av1 → 720 → … → selalu ada hasil dalam budget; header `X-Clip-Degraded` memberitahu UI. Verifikasi 1080p penuh perlu deploy (IP Vercel ≠ IP sandbox ini). |
| Tanpa cache | Video yang sama diunduh ulang | Sudah ada cache stream URL in-memory per videoId (TTL 10 menit, `STREAM_CACHE_TTL_SECONDS` bisa ditimpa) — klip berulang video sama skip panggilan yt-dlp (8,5s → 0,5s saat tes). Entri kadaluwarsa/stream ditolak di-invalidate agar retry ambil URL segar. |
| yt-dlp butuh binary ~3 MB + ffmpeg-static ~75 MB di fungsi clip | Ukuran fungsi besar; batas Vercel Hobby | Sudah diarahkan via `outputFileTracingIncludes` + `serverExternalPackages`; monitor ukuran saat deploy pertama. |
| YouTube ubah anti-bot → yt-dlp kedaluwarsa | F3 gagal sementara | `youtube-dl-exec` versi baru membundel yt-dlp terbaru; upgrade berkala. |
| ffmpeg-static segfault pada https di lingkungan tertentu | Klip gagal lokal | Preferensi system ffmpeg dulu; di Vercel pakai ffmpeg-static (belum diverifikasi — cek saat deploy). |

## 10. Non-Goals

- **Tidak** mem-port backend Python syahrclips (FastAPI/job queue/whisper/ffmpeg penuh).
- **Tidak** menyentuh repo `syahrworks-portfolio` dan repo `syahrclips`.
- **Tidak** menambah autentikasi, database, CMS, atau rate-limit server.
- **Tidak** menambah fitur lain di luar 3 fitur yang disepakati.
- **Tidak** connect ke GitHub/Vercel sebelum user membuat repo & akun Vercel.
