# DESIGN.md — syahrclips-tools

Design system untuk app tools, **adopsi penuh dari syahrworks-portfolio**
(repo `syahrworks-portfolio`). Sumber referensi:

- `app/globals.css` — token warna, font, radius, utilitas
- `components/ui/{button,badge,input}.tsx` — primitif komponen
- `components/Header.tsx` — pola header sticky + wordmark
- `components/home/SectionHeader.tsx` — pola section header `01 / LABEL`
- `components/ThemeProvider.tsx` — (cadangan dark-mode di masa depan)

> Yang diadopsi: **bahasa desain & token**. Struktur halaman tools TIDAK
> menyalin struktur halaman portfolio (konten berbeda).

---

## 1. Prinsip — "Editorial Anti-Slop"

- Typography-led: heading serif besar + tight, hierarki jelas.
- Palet terbatas (2–3 warna) + whitespace besar.
- Detail halus: hairline border, index number, micro-label uppercase + letter-spacing.
- Motion minimal & bertujuan (200–300ms) — bukan animasi dekoratif/loop.
- Konten-first: hasil transkrip/klip lebih menonjol daripada ikon dekoratif.

**Anti-Slop Checklist (WAJIB):**
- ❌ Tanpa gradient ungu/indigo, tanpa "blob" background, tanpa glassmorphism.
- ❌ Tanpa hero centered + floating icon circles / efek typewriter.
- ❌ Tanpa emoji sebagai label section; tanpa look default shadcn (rounded-xl + shadow).
- ❌ Tanpa grid 3 kolom identik tanpa hierarki.
- ✅ Typografi jadi hero · ✅ Palet dibatasi · ✅ Hairline + micro-label · ✅ Motion 200–300ms.

## 2. Palet

Tema aktif: **light only** (untuk sekarang). Token dark disiapkan di bawah sebagai
referensi untuk implementasi dark-mode berikutnya — **belum** diekspos ke UI
(tanpa toggle).

### Light (aktif)

| Token | Nilai |
| --- | --- |
| `--background` | `#FAFAF9` |
| `--foreground` | `#111111` |
| `--card` | `#FFFFFF` |
| `--border` | `#E5E5E5` |
| `--primary` | `#4F46E5` |
| `--primary-foreground` | `#FFFFFF` |
| `--muted` | `#F4F4F2` |
| `--muted-foreground` | `#6B7280` |
| `--accent` | `#6D28D9` |
| `--accent-foreground` | `#FAFAF9` |
| `--ring` | `#E5E5E5` |

### Dark (cadangan, belum aktif)

| Token | Nilai |
| --- | --- |
| `--background` | `#0A0A0A` |
| `--foreground` | `#E6E6E6` |
| `--card` | `#131313` |
| `--border` | `#262626` |
| `--primary` | `#8B8BF0` |
| `--primary-foreground` | `#0A0A0A` |
| `--muted` | `#161616` |
| `--muted-foreground` | `#B4B4BC` |
| `--accent` | `#A78BFA` |
| `--accent-foreground` | `#0A0A0A` |
| `--ring` | `#262626` |

### Radius

`--radius-sm: 2px` · `--radius-md: 4px` · `--radius-lg: 6px`

## 3. Tipografi

| Peran | Font | Penggunaan |
| --- | --- | --- |
| Display/heading | **Instrument Serif** (400) | Judul besar, tracking-tight, `leading` rapat |
| Body | **Inter** | Teks paragraf, tombol, form |
| Label/angka | **JetBrains Mono** | Micro-label, timestamp, statistik |

**Utilitas wajib (disalin dari portfolio):**

```css
.micro-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.container-editorial {
  margin-inline: auto;
  width: 100%;
  max-width: 72rem;
  padding-inline: 1.5rem;   /* 2rem di ≥640px */
}
```

**Skala heading:** section header serif `text-4xl sm:text-5xl`, leading `[1.1]`,
tracking-tight. Micro-label di atasnya: `text-accent`.

## 4. Komponen

Semua mengikuti `components/ui/*` di syahrworks-portfolio.

### Button (`cva`)
- `primary`: **solid ink** — `bg-foreground text-background` (BUKAN pill ungu),
  `hover:opacity-85`, `active:scale-[0.98]`.
- `secondary`: hairline — `border border-border bg-transparent`, `hover:border-foreground`.
- `ghost`: `hover:bg-muted`.
- Size: default `h-10 px-5`, sm `h-8 px-3.5 text-xs`, icon `h-10 w-10`.
- Radius default `rounded-sm`. Transisi `duration-200`.

### Input
- `rounded-sm border border-border bg-card px-3.5 py-2 text-sm`
- `focus-visible:border-foreground` (bukan ring ungu menyala).
- Placeholder `text-muted-foreground`.

### Badge
- Mono uppercase kecil: `font-mono text-[0.7rem] uppercase tracking-wider`,
  `rounded-sm border px-2.5 py-0.5`.
- Variants: `default` (hairline muted) · `accent` (border-accent/40 bg-accent/10 text-accent) · `solid` (ink).

### Card
- Flat: `border border-border bg-card`, radius kecil, **tanpa shadow tebal**.
- Interaktif: `hover:bg-muted`, transisi 200ms.
- Pemisah dalam kartu: `border-t/b order-border`.

### FlowSteps (`components/FlowSteps.tsx`)
- Penanda alur 3 langkah di tiap halaman tool: `1 Transkrip → 2 Preview → 3 Klip`.
- Gaya `font-mono text-xs tracking-wider text-muted-foreground`; separator `→` warna `--border`.
- Langkah aktif: `text-foreground` + underline hairline; lainnya link (`hover:text-foreground`).
- Prop `current` (1|2|3); dipasang di bawah SectionHeader.

## 5. Layout & Tema

- **Tema**: light-only. Satu source of truth token di `globals.css`.
  Dark-mode menyusul (token sudah siap); saat itu adopsi `ThemeProvider.tsx`
  dari syahrworks-portfolio (custom, tanpa library).
- **Header sticky**: `border-b border-border`, `bg-background/85 backdrop-blur-md`,
  tinggi `h-16`. Kiri: wordmark **SyahrClips** (`font-serif text-2xl tracking-tight`).
  Kanan: navigasi tools + (nantinya) theme toggle.
- **Section header** (tiap halaman tool):
  ```
  [breadcrumb mono text-xs muted]  Home / Transkrip
  [micro-label text-accent]  01 / TRANSCRIPT
  [serif text-4xl sm:text-5xl tracking-tight]  Unduh Transkrip YouTube
  [text-base muted-foreground]  Deskripsi singkat …
  ```
- **Breadcrumb**: baris paling atas tiap halaman tool — `Home / <Label>`, "Home" adalah
  link ke `/`, label halaman aktif teks biasa (non-link). Gaya `font-mono text-xs
  tracking-wider text-muted-foreground`, pemisah `/` warna `--border`.
  (disediakan `SectionHeader` via prop `breadcrumb`).
- **Landing**: tampilan **alur berurutan** — blok "Bagaimana alur lengkapnya?"
  (kartu hairline, 4 poin termasuk langkah LLM eksternal) + 3 baris langkah
  bernomor 01/02/03 (serif besar di kiri, penghubung `↓` di mobile), tiap baris:
  label mono accent, judul serif, deskripsi, CTA "Mulai langkah N →".
- **Handoff antar langkah**: tiap halaman tool memberi tahu "lanjut ke mana" —
  Transkrip → hint "Langkah berikutnya" ke Preview (setelah hasil); Preview →
  tombol **Muat contoh** (isi JSON + videoId contoh, langsung jalankan preview)
  + microcopy asal JSON (link ke langkah 1); Klip → note "Klip dari candidate
  preview" + "← Kembali ke Preview" saat dibuka lewat param dari Preview.
- **Prompt guide (anti salah kalkulasi LLM)**: transkrip memakai `[HH:MM:SS – HH:MM:SS]`
  (jam:menit:detik), rawan dibaca LLM sebagai menit:detik.
  - **Transkrip**: tombol **"Salin prompt + transkrip"** di kartu hasil — satu klik
    menyiapkan `LLM_PROMPT` + teks transkrip (lihat `buildPromptBundle` di `lib/llm.ts`).
  - **Preview**: kartu "Prompt untuk LLM" (tabel konversi mono `TIME_CONVERSIONS` +
    `<details>` prompt lengkap + tombol **Salin prompt**).
- **Auto-konversi waktu (`lib/time.ts`)**: `start`/`end` di JSON Preview otomatis
  dikonversi ke detik — menerima angka, string angka (`"65"`), `MM:SS` (`"01:05"`),
  `HH:MM:SS` (`"00:01:05"`), dan rentang `"00:00:00 – 00:00:07"` (dipecah jadi
  start/end). Kartu menampilkan catatan mono `auto-konversi: …` / `rentang dipecah: …`.
- **Persistensi session (`sessionStorage`)**: transkrip terakhir (`syahrclips:transcript`)
  dan isian Preview (`syahrclips:preview`) dipulihkan saat mount — pindah halaman/
  refresh tidak menghilangkan data. Muat via `useEffect` agar aman dari hydration mismatch.

## 6. Mapping Halaman

### `/` — Landing
Header + section header `TOOLS` (tanpa angka) + blok "Bagaimana alur lengkapnya?"
+ 3 baris langkah bernomor 01/02/03 (alur berurutan), tiap baris link ke halaman tool.

### `/tools/transcript` — F1
Section header `01 / TRANSCRIPT` (breadcrumb `Home / Transkrip`) + FlowSteps
`current={1}` → form URL (Input + Button) → hasil:
- Kartu metadata: badge YouTube + statistik (segmen/kata/karakter) + tombol
  **Salin prompt + transkrip** (primary) / **Salin semua** / **↓ .txt**.
- Daftar segmen: tabel hairline, kolom timestamp mono (`HH:MM:SS – HH:MM:SS`) + teks.
- Kartu hint **"Langkah berikutnya"** → link "Buka Preview" (setelah hasil tampil).
- Persistensi session: hasil disimpan & dipulihkan.

### `/tools/preview` — F2
Section header `02 / PREVIEW` (breadcrumb `Home / Preview`) + FlowSteps
`current={2}` → input videoId/URL + tombol **Preview** & **Muat contoh** →
textarea JSON + microcopy asal JSON (link ke langkah 1) → kartu **"Prompt untuk LLM"**
(tabel konversi + `<details>` prompt + **Salin prompt**) → grid kartu candidate,
tiap kartu: range mono, `reason`, catatan `auto-konversi` bila perlu, tombol
**Lihat Video** (buka modal) · **Salin format** · **Unduh klip**.
`start`/`end` otomatis dikonversi dari format waktu ke detik (`lib/time.ts`).
Isian dipersistenkan di sessionStorage.

- **Form collapsible**: saat hasil preview muncul, blok form (videoId + textarea
  JSON + microcopy) otomatis tersembunyi — bar compact hasil menampilkan badge
  YouTube · videoId · jumlah valid + tombol **Edit JSON** (toggle, jadi **Tutup
  form** saat terbuka). JSON error → form tetap terbuka.
- **Kartu "Prompt untuk LLM"** dirender di **paling bawah** (setelah grid hasil)
  bila hasil tampil; bila belum ada hasil tetap mengikuti form.

- **Playback lewat modal (`components/CandidateModal.tsx`)**: tidak memakai
  iframe `?start&end` langsung (native YouTube bisa loncat balik ke 0 saat end).
  Modal memakai **YouTube IFrame Player API** tanpa param `end`; polling `currentTime`
  menghentikan video tepat di akhir rentang → muncul tombol **Putar ulang**
  (`seekTo(start)` + play). Tidak ada loncatan ke 0.
- **Modal**: kartu overlay `bg-black/70`, area player `aspect-video`, tutup via
  tombol **X**, klik backdrop, dan **ESC**; scroll body terkunci saat terbuka;
  `player.destroy()` saat tutup. Tombol **Unduh klip** tersedia di dalam modal.
- **Tuning (icon pensil, di dalam modal)**: toggle area edit start/end — menerima
  detik (`65`), `MM:SS` (`01:05`), `HH:MM:SS` (`00:01:05`). **Simpan & putar ulang**
  memperbarui kartu + menulis balik item ke textarea JSON secara lossless
  (terpersistensi via sessionStorage), lalu `seekTo` + play dengan rentang baru.

### `/tools/clip` — F3
Section header `03 / CLIP` (breadcrumb `Home / Klip`) + FlowSteps `current={3}`
→ (bila dibuka dari Preview) note "Klip dari candidate preview" + "← Kembali ke Preview"
→ form (URL + start + end) — start/end menerima detik (`65`), `MM:SS` (`01:05`),
  atau `HH:MM:SS` (`00:01:05`), otomatis dikonversi ke detik saat request
  (`lib/time.ts`, konsisten dengan Preview); badge mono **Rentang aktif**
  `[HH:MM:SS – HH:MM:SS]` tampil live bila rentang valid — format sama persis
  dengan kartu candidate di Preview
→ tombol **Download klip**
→ status (mempersiapkan… / selesai / error) → link unduh mp4.

## 7. Motion

- Transisi elemen: `duration-200` (hover/focus/state).
- Loading state: progress bar tipis hairline atau teks mono status — tanpa spinner loop dekoratif.
- Tidak ada animasi masuk (fade-up dsb.) pada load awal — konten langsung tampil.

## 8. Verifikasi Visual

- [ ] Token palet cocok dengan `globals.css` syahrworks-portfolio.
- [ ] Tombol primary solid ink (bukan ungu/glass).
- [ ] Micro-label uppercase + tracking di semua section.
- [ ] Kartu flat hairline, radius kecil, tanpa shadow abu.
- [ ] Font: Instrument Serif (heading) · Inter (body) · JetBrains Mono (label/angka).
