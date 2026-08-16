export const LLM_PROMPT_TRANSCRIPT_PLACEHOLDER = "<tempel transkrip di sini>";

export const LLM_PROMPT = `Kamu adalah editor video. Analisis transkrip YouTube di bawah ini dan pilih momen-momen paling menarik untuk dijadikan klip.

FORMAT WAKTU (PENTING, jangan salah hitung):
- Transkrip memakai timestamp [HH:MM:SS] dengan HH = jam, MM = menit, SS = detik. BUKAN menit:detik.
- Ubah SEMUA timestamp ke DETIK dengan rumus: detik = HH*3600 + MM*60 + SS.
- Contoh: [00:00:07] = 7 detik (bukan 7 menit). [00:00:30] = 30 detik. [00:01:05] = 65 detik. [00:10:00] = 600 detik. [01:00:00] = 3600 detik.
- Rentang [00:00:00 - 00:00:07] artinya dari detik 0 sampai detik 7.

TUGAS:
- Pilih 3 sampai 10 momen yang paling menarik untuk dijadikan klip.
- Untuk tiap momen, keluarkan SATU objek JSON: {"start": <detik>, "end": <detik>, "reason": "<alasan singkat>"}.
- start dan end HARUS bilangan detik (integer). end harus lebih besar dari start.
- JANGAN menulis teks selain JSON. Contoh jawaban:
[
  { "start": 0, "end": 7, "reason": "Pembukaan yang menegur penonton" },
  { "start": 65, "end": 70, "reason": "momen paling menarik" }
]

BERIKUT TRANSCRIPT:
${LLM_PROMPT_TRANSCRIPT_PLACEHOLDER}`;

export function buildPromptBundle(transcriptText: string): string {
  const transcript = transcriptText.trim();
  if (!transcript) return LLM_PROMPT;
  return LLM_PROMPT.replace(LLM_PROMPT_TRANSCRIPT_PLACEHOLDER, transcript);
}
