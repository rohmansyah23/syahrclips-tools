# PRD.md — syahrclips-tools

Product Requirements Document untuk port 3 fitur SyahrClips menjadi app mandiri
berbasis Next.js + TypeScript yang di-hosting di **Vercel (Hobby / gratis)**.

> Repo: https://github.com/rohmansyah23/syahrclips-tools (sudah dibuat, public)
>
> Dokumen ini dibaca oleh coding agent/sesi lain. Baca juga:
> - `docs/PLAN.md` — rencana eksekusi & keputusan teknis
> - `docs/DESIGN.md` — design system (sumber: syahrworks-portfolio)

---

## 1. Ringkasan Produk

`syahrclips-tools` adalah kumpulan 3 utilitas mandiri untuk riset klip YouTube,
diambil dari SyahrClips tanpa backend Python (FastAPI/job queue/whisper):

1. **Download Transcript** — transkrip YouTube ber-timestamp format ramah LLM.
2. **Preview berdasarkan candidate import JSON LLM** — paste `{start, end}`,
   preview rentang video.
3. **Download video hasil preview** — unduh klip hasil potong.

Hosting: **Vercel Hobby (gratis)**. Arsitektur: satu app Next.js, stateless,
tanpa database, tanpa auth, tanpa environment variable.

## 2. User & Konteks

| Aspek | Nilai |
| --- | --- |
| User | Pribadi (Muhammad Rohman Syah) |
| Frekuensi pemakaian | < 20× per hari |
| Bahasa antarmuka | **Bahasa Indonesia** |
| Perangkat | Desktop & mobile |
| Tujuan | Riset klip: transkrip → analisis LLM → pilih candidate → unduh klip |

## 3. Fitur

### 3.1 F1 — Download Transcript

- **Input**: URL YouTube (`youtube.com/watch?v=…`, `youtu.be/…`).
- **Proses** (server, `POST /api/transcript`, sinkron):
  1. Validasi URL → ekstrak `videoId`.
  2. `youtube-transcript` → `fetchTranscript(videoId)` (caption manual/auto, tanpa key).
  3. Metadata judul/author via `https://www.youtube.com/oembed?url=…&format=json`.
  4. Format ulang menjadi segmen ber-timestamp.
- **Output** (JSON):
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
- **UI**: paste URL → tampil transkrip → tombol **Salin semua** & **↓ .txt**.
- **Error handling**:
  - URL tidak valid / bukan YouTube → pesan jelas.
  - Video tidak punya caption → pesan "Video tidak memiliki transkrip".
  - 403/429 YouTube → retry + pesan "Terlalu banyak permintaan, coba lagi".

### 3.2 F2 — Preview dari JSON LLM

- **Input**: JSON daftar candidate:
  ```json
  [
    { "start": 65, "end": 70, "reason": "momen paling menarik" },
    { "start": 120, "end": 135 }
  ]
  ```
  + `videoId` / URL video.
- **Proses** (client-side, tanpa API sendiri):
  - Setiap candidate dirender sebagai iframe:
    `https://www.youtube-nocookie.com/embed/{videoId}?start={s}&end={e}`
  - Fields opsional: `reason`, `score`, `title`.
- **Output**: daftar candidate, masing-masing dengan player + label range + opsi
  **Unduh klip** (menuju F3) dan **Salin format**.
- **Error handling**: JSON tidak valid → pesan + contoh format; `start >= end`
  atau negatif → baris ditandai invalid, yang valid tetap diproses.

### 3.3 F3 — Download video hasil preview

- **Input**: `videoId`, `start`, `end` (detik), `resolution` (opsional, default
  `1080`; pilihan 1080/720/480/360/240/144).
- **Batasan**: maks **3 menit** (180s) per klip.
- **Proses** (server, `POST /api/clip`, sinkron, streaming):
  1. `youtube-dl-exec` (yt-dlp) → metadata format + durasi (cache in-memory per
     videoId, TTL 10 menit).
  2. `pickFormats`: tinggi tertinggi ≤ target (tak pernah upscale); preferensi
     h264 → av1/vp9 (data 2,6× lebih kecil). Kalau yang tersedia hanya DASH
     (umum untuk 1080p/720p), ambil video-only + audio-only (~128kbps).
  3. `ffmpeg` stream langsung dari URL (range-seeking + moov ditangani sendiri):
     `-ss {start} -t {dur} -i {video} [-i {audio}] -map 0:v:0 [-map 1:a:0]
     -c copy -movflags faststart -f mp4`. Mux 2-input tanpa re-encode.
  4. **Auto-degrade** + ETA monitor: kalau stream lambat/ditolak (403/429
     transien dari YouTube), turun otomatis ke codec ringan lalu resolusi
     lebih rendah, selalu dalam budget 280s (di bawah `maxDuration` 300s).
  5. Balas mp4 via **streaming response** (batas 4,5MB Vercel tidak berlaku)
     + header `X-Clip-Resolution`, `X-Clip-Codec`, `X-Clip-Degraded`.

  > Catatan: `@distube/ytdl-core` (rencana awal) di-archive dan rusak terhadap
  > player script YouTube terbaru — diganti `youtube-dl-exec` (yt-dlp).
  > Pendekatan byte-range manual tidak dipakai (segmen tengah mp4 tanpa moov).
- **UI**: paste videoId/URL, pilih **Resolusi maksimal**, tombol **Download klip**.
  Bila auto-degrade terjadi, UI menampilkan keterangan (mis. "diturunkan ke 720p").
- **Error handling**:
  - 403 (video dibatasi/VEVO) → pesan spesifik.
  - Input tidak valid (videoId, rentang, >3 menit, resolusi) → 400 + pesan jelas.
  - Stream lambat → 504 dengan saran "coba resolusi lebih rendah" (ErrorNotice
    RATE LIMIT/countdown untuk 429).

## 4. Persyaratan Teknis

- **Runtime**: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4.
- **Dependensi**: `youtube-transcript`, `youtube-dl-exec` (yt-dlp), `ffmpeg-static`.
- **Stateless**: tidak ada file persist, cache, atau job queue.
- **`maxDuration`**: `export const maxDuration = 300` di `/api/clip` — dengan
  **Fluid Compute** (default proyek Vercel baru) Hobby = 300s maks (bukan 60s
  lagi, perubahan Jun 2026). Bundle 250MB & memori 2GB di Hobby muat untuk
  ffmpeg-static + yt-dlp.
- **Streaming response** untuk `/api/clip` (batas body 4,5MB tidak berlaku
  untuk streaming function).
- **Tanpa** environment variable / API key.
- **Repo & Vercel**: satu repo [`rohmansyah23/syahrclips-tools`](https://github.com/rohmansyah23/syahrclips-tools) (sudah ada, public) → import ke Vercel Hobby sebagai project baru.
- **SEO**: `robots.txt`/metadata dasar (pribadi; tidak wajib terindeks).

## 5. Kriteria Penerimaan

- [ ] F1: video ber-caption → `[HH:MM:SS]` keluar; tanpa caption → error jelas.
- [ ] F2: contoh JSON → semua candidate tampil; `start`/`end` diterapkan di iframe.
- [ ] F3: klip 15–30 detik terunduh, durasi sesuai, bisa diputar.
- [ ] `npm run lint` tanpa error; `npm run build` LOLOS (perhatikan ukuran bundle ffmpeg-static).
- [ ] Responsif mobile; semua teks UI Bahasa Indonesia.

## 6. Non-Functional Requirements

- **Performa**: klip pendek (<60s) selesai dalam hitungan detik (copy, tanpa re-encode).
- **Reliability**: error jelas & dapat diulang user (retry manual).
- **Keamanan**: API publik tanpa auth (keputusan disepakati) — input divalidasi di server.
- **Maintainability**: satu folder `lib/` berisi logika (format, parse, clip) terpisah dari route.

## 7. Non-Goals

- **Tidak** mem-port backend Python syahrclips (FastAPI/job queue/whisper).
- **Tidak** menyentuh repo `syahrworks-portfolio` dan repo `syahrclips`.
- **Tidak** menambah auth, database, CMS, rate-limit server, atau fitur lain
  di luar F1–F3.
- **Tidak** menambah multi-bahasa (UI Indonesia saja; struktur dark-mode disiapkan di DESIGN.md).

## 8. Batasan & Risiko

| Risiko | Dampak | Mitigasi / Fallback |
| --- | --- | --- |
| 403/429 YouTube dari IP Vercel | Transkrip/streaming gagal sesekali | Retry + backoff, pesan error jelas. |
| Bundle ffmpeg-static melebihi batas fungsi Hobby | Deploy/runtime clip gagal | Pindahkan hanya `/api/clip` ke Fly.io (~$2/bln) atau Render free; F1 & F2 tetap di Vercel. |
| ~~60s~~ 300s Hobby (Fluid Compute) | Klip 3 menit butuh ≤ ~5 menit | Budget internal 280s + auto-degrade; Pro/800s bila perlu. |
| Respons >4,5MB (batas body Vercel) | Klip gagal 500 | Streaming function (tanpa batas itu). |
| 1080p DASH butuh mux | Video-only + audio terpisah | Mux `-c copy` dua input; h264 → av1/vp9 bila lambat. |
| YouTube throttle stream besar dari IP datacenter | 1080p lambat/ditolak | Auto-degrade + ETA monitor; header `X-Clip-*`; verifikasi penuh saat deploy. |
| Tanpa cache | Video sama diunduh ulang | Cache stream URL in-memory per videoId (TTL 10 mnt). |
