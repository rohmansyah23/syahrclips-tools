# syahrclips-tools

Tool untuk membantu workflow clipping YouTube: **Transcript → Preview → Clip**. Dirancang untuk kebutuhan personal content creator.

## Features

### 1. Transcript Download
- Ambil transkrip dari video YouTube (auto/manual captions)
- Salin prompt LLM + transkrip untuk diproses di ChatGPT/Claude
- Export ke file `.txt`

### 2. Preview Candidate Clips
- Parse JSON output dari LLM (kandidat clip)
- Preview timestamp dengan YouTube player
- Atur start/end time langsung dari modal

### 3. Clip Download
- Download clip YouTube dalam format MP4
- Pilih resolusi: 1080p, 720p, 480p, 360p, 240p, 144p
- Auto-degrade resolusi jika stream lambat
- Max duration: 180 detik (3 menit)

## Requirements

Untuk menjalankan fitur ini secara lokal, Anda memerlukan:

| Dependency | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20+ | Runtime |
| **ffmpeg** | - | Proses clipping video |
| **Python3** | 3.8+ | Menjalankan yt-dlp |
| **yt-dlp** | Latest | Resolve stream URLs dari YouTube |

### Install Dependencies (macOS)

```bash
# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20

# Install ffmpeg
brew install ffmpeg

# Install Python3
brew install python

# Install yt-dlp
pip3 install yt-dlp
```

### Install Dependencies (Ubuntu/Debian)

```bash
# Update package list
sudo apt update

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install ffmpeg
sudo apt install -y ffmpeg

# Install Python3 + yt-dlp
sudo apt install -y python3 python3-pip
pip3 install yt-dlp
```

## Installation

```bash
# Clone repository
git clone https://github.com/rohmansyah23/syahrclips-tools.git
cd syahrclips-tools

# Install dependencies
npm install
```

## Running Locally

```bash
# Development server
npm run dev

# Open browser
open http://localhost:3000
```

## Build for Production

```bash
# Build
npm run build

# Start production server
npm start
```

## ⚠️ Deployment Notes

Fitur **Clip Download** dan **Transcript** memerlukan dependencies sistem yang tidak tersedia di environment serverless.

### Kenapa Tidak Bisa di Vercel/Netlify?

| Issue | Penjelasan |
|-------|------------|
| **ffmpeg** | Vercel tidak punya system ffmpeg. `ffmpeg-static` package (80MB) bisa gagal di serverless |
| **Python3 + yt-dlp** | yt-dlp memerlukan Python3, yang mungkin tidak ada di runtime serverless |
| **Function Timeout** | Clip processing butuh waktu > 5 menit, melebihi batas serverless |
| **Response Size** | Transcript video panjang bisa melebihi 4.5MB body limit |

### Rekomendasi Deployment

| Platform | Status | Catatan |
|----------|--------|---------|
| **Local Development** | ✅ Full functionality | Rekomendasi untuk testing |
| **VPS (Self-hosted)** | ✅ Full functionality | Hetzner, DigitalOcean, Vultr, Oracle Cloud |
| **Vercel Free/Pro** | ⚠️ Clip mungkin gagal | Transcript mungkin works untuk video pendek |
| **Netlify** | ⚠️ Clip mungkin gagal | Sama seperti Vercel |
| **Railway/Render** | ⚠️ Perlu verifikasi | Bisa install ffmpeg di Docker |

### Deploy ke VPS (Rekomendasi)

```bash
# Contoh menggunakan Docker
docker compose up -d

# Atau install manual di VPS
npm install
npm run build
npm start
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **Language**: TypeScript
- **YouTube Integration**: yt-dlp, youtube-transcript

## License

MIT
