export interface ErrorMeta {
  label: string;
  hint: string;
  retryable: boolean;
}

/**
 * Klasifikasi status HTTP dari API ke label/hint berbahasa Indonesia,
 * khususnya kegagalan YouTube (403/429). Aman dipakai di client.
 */
export function getErrorMeta(status: number): ErrorMeta {
  switch (status) {
    case 400:
      return {
        label: "Input tidak valid",
        hint: "Periksa kembali isian: URL/videoId YouTube dan rentang waktu.",
        retryable: false,
      };
    case 403:
      return {
        label: "Akses ditolak YouTube",
        hint: "Video ini privat, dibatasi usia/VEVO, atau tidak tersedia untuk diunduh. Coba video lain.",
        retryable: false,
      };
    case 404:
      return {
        label: "Tidak ditemukan",
        hint: "Video tidak tersedia atau tidak memiliki transkrip/caption.",
        retryable: false,
      };
    case 429:
      return {
        label: "Terlalu banyak permintaan",
        hint: "YouTube membatasi permintaan dari server. Tunggu beberapa saat lalu coba lagi.",
        retryable: true,
      };
    case 500:
      return {
        label: "Kesalahan server",
        hint: "Terjadi masalah internal. Coba lagi beberapa saat lagi.",
        retryable: true,
      };
    case 502:
      return {
        label: "YouTube tidak merespons",
        hint: "Layanan YouTube sedang bermasalah atau memblokir permintaan. Coba lagi nanti.",
        retryable: true,
      };
    case 504:
      return {
        label: "Waktu habis",
        hint: "Klip terlalu panjang atau server sedang sibuk. Coba klip yang lebih pendek.",
        retryable: true,
      };
    default:
      return {
        label: "Terjadi kesalahan",
        hint: "Coba lagi, atau periksa koneksi internet Anda.",
        retryable: true,
      };
  }
}
