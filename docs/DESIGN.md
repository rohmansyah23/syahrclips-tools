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

## 5. Layout & Tema

- **Tema**: light-only. Satu source of truth token di `globals.css`.
  Dark-mode menyusul (token sudah siap); saat itu adopsi `ThemeProvider.tsx`
  dari syahrworks-portfolio (custom, tanpa library).
- **Header sticky**: `border-b border-border`, `bg-background/85 backdrop-blur-md`,
  tinggi `h-16`. Kiri: wordmark **SyahrClips** (`font-serif text-2xl tracking-tight`).
  Kanan: navigasi tools + (nantinya) theme toggle.
- **Section header** (tiap halaman tool):
  ```
  [micro-label text-accent]  01 / TRANSCRIPT
  [serif text-4xl sm:text-5xl tracking-tight]  Unduh Transkrip YouTube
  [text-base muted-foreground]  Deskripsi singkat …
  ```
- **Landing**: daftar 3 tool sebagai kartu hairline 1 kolom di mobile, grid di desktop
  — konten-first, tombol "Buka tool" mono kecil.

## 6. Mapping Halaman

### `/` — Landing
Header + section header `01 / TOOLS` + 3 kartu tool (nama, deskripsi, badge "Baru").

### `/tools/transcript` — F1
Section header `02 / TRANSCRIPT` → form URL (Input + Button) → hasil:
- Kartu metadata: badge YouTube + statistik (segmen/kata/karakter) + tombol **Salin semua** & **↓ .txt**.
- Daftar segmen: tabel hairline, kolom timestamp mono (`HH:MM:SS – HH:MM:SS`) + teks.

### `/tools/preview` — F2
Section header `03 / PREVIEW` → textarea JSON + tombol **Preview** → grid kartu candidate,
tiap kartu: iframe player, range mono, `reason`, tombol **Unduh klip**.

### `/tools/clip` — F3
Section header `04 / CLIP` → form (URL + start + end) → tombol **Download klip**
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
