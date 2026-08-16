import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const VIDEO = "dQw4w9WgXcQ"; // Rick Astley — punya caption & bisa diklip

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const waitForText = (page, text, timeout = 60000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);

const DL_DIR = "/tmp/e2e-downloads";
mkdirSync(DL_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
// Download blob butuh behavior level browser (Page.setDownloadBehavior deprecated).
const browserClient = await browser.target().createCDPSession();
await browserClient.send("Browser.setDownloadBehavior", {
  behavior: "allow",
  downloadPath: DL_DIR,
  eventsEnabled: true,
});

// "Failed to load resource" = respons 4xx/5xx dari tes error yang disengaja.
// Error console dari iframe YouTube/Google dibuang — bukan bagian dari app kita.
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const url = msg.location()?.url || "";
  if (/youtube\.com|googlevideo\.com|google(apis)?\.com|ytimg\.com|ggpht\.com/i.test(url))
    return;
  if (msg.text().includes("Failed to load resource")) return;
  consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(`PAGEERROR: ${err.message}`));

try {
  // ── 1. Landing ───────────────────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  const toolCards = await page.$$eval("a[class*='group']", (els) => els.length);
  check("Landing: 3 kartu tool", toolCards === 3, `ditemukan ${toolCards}`);

  // ── 2. Transcript: sukses ────────────────────────────────────
  await page.goto(`${BASE}/tools/transcript`, { waitUntil: "networkidle0" });
  await page.type('input[placeholder*="youtube.com"]', `https://www.youtube.com/watch?v=${VIDEO}`);
  await page.click('button[type="submit"]');
  await waitForText(page, "Salin semua", 60000);
  const stats = await page.evaluate(() => document.body.innerText);
  check(
    "Transcript: hasil muncul (stats)",
    /SEGMEN/i.test(stats) && /KATA/i.test(stats) && /KARAKTER/i.test(stats),
  );
  const tsOk = await page.evaluate(() =>
    [...document.querySelectorAll("span.font-mono")].some((el) =>
      /\[\d{2}:\d{2}:\d{2} – \d{2}:\d{2}:\d{2}\]/.test(el.textContent || ""),
    ),
  );
  check("Transcript: format [HH:MM:SS – HH:MM:SS]", tsOk);

  // ── 2b. Transcript: batasan 10 segmen + "Lihat semua transkrip" ──
  const segRowSel = "[class*='sm:grid-cols-[190px_1fr]']";
  const initialRows = await page.$$eval(segRowSel, (els) => els.length);
  check("Transcript: hanya 10 segmen awal tampil", initialRows === 10, `baris=${initialRows}`);
  const hasMoreBtn = await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) =>
      b.textContent.trim().startsWith("Lihat semua transkrip"),
    ),
  );
  check("Transcript: tombol 'Lihat semua transkrip' tampil", hasMoreBtn);
  const segTotal = await page.evaluate(() => {
    const stat = [...document.querySelectorAll("div")].find(
      (d) => d.querySelector("p.micro-label")?.textContent?.trim().toUpperCase() === "SEGMEN",
    );
    const num = stat?.querySelector("p.font-mono")?.textContent;
    return num ? Number(num) : NaN;
  });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith("Lihat semua transkrip"),
    );
    btn?.click();
  });
  const afterMore = await page.$$eval(segRowSel, (els) => els.length);
  check("Transcript: view more menampilkan semua segmen", afterMore === segTotal, `${afterMore}/${segTotal}`);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.trim() === "Tampilkan lebih sedikit",
    );
    btn?.click();
  });
  const backRows = await page.$$eval(segRowSel, (els) => els.length);
  check("Transcript: view more tutup kembali ke 10", backRows === 10, `baris=${backRows}`);

  // ── 2c. Transcript: tombol Reset ─────────────────────────────
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.trim() === "Reset",
    );
    btn?.click();
  });
  const transReset = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="youtube.com"]');
    return {
      inputEmpty: input ? input.value === "" : false,
      resultGone: !document.body.innerText.includes("Salin semua"),
    };
  });
  check(
    "Transcript: Reset membersihkan hasil & input",
    transReset.inputEmpty && transReset.resultGone,
  );

  // ── 3. Transcript: error 400 → ErrorNotice ──────────────────
  await page.goto(`${BASE}/tools/transcript`, { waitUntil: "networkidle0" });
  await page.type('input[placeholder*="youtube.com"]', "https://example.com/bukan-youtube");
  await page.click('button[type="submit"]');
  await waitForText(page, "INPUT INVALID", 15000);
  const err400 = await page.evaluate(() => document.body.innerText);
  check(
    "Transcript: ErrorNotice 400 (badge + HTTP 400)",
    err400.includes("INPUT INVALID") && err400.includes("HTTP 400"),
  );

  // ── 4. Preview: grid candidate + modal player YT.Player ─────
  await page.goto(`${BASE}/tools/preview`, { waitUntil: "networkidle0" });
  await page.type('input[placeholder*="videoId"]', VIDEO);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Preview",
    );
    btn?.click();
  });
  await waitForText(page, "candidate valid", 15000);
  const candidateCount = await page.$$eval("[class*='lg:grid-cols-2'] > div", (els) => els.length);
  check("Preview: 2 kartu candidate (contoh JSON)", candidateCount === 2, `kartu=${candidateCount}`);
  const rangeText = await page.evaluate(() =>
    document.body.innerText.includes("[00:01:05 – 00:01:10]"),
  );
  check("Preview: range mono tampil", rangeText);

  // Buka modal "Lihat Video" kandidat pertama → YT.Player + iframe embed.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Lihat Video",
    );
    btn?.click();
  });
  await page.waitForSelector('iframe[src*="youtube.com/embed/"]', { timeout: 30000 });
  const modalSrc = await page.evaluate(() => {
    const f = document.querySelector('iframe[src*="youtube.com/embed/"]');
    return f ? f.getAttribute("src") || "" : "";
  });
  check(
    "Preview: modal memuat iframe embed + start=65",
    modalSrc.includes("/embed/") && modalSrc.includes("start=65"),
    modalSrc.slice(0, 80),
  );
  // Tutup modal supaya reset tidak terhalang.
  await page.keyboard.press("Escape");

  // Persistensi: reload harus memulihkan input & hasil dari sessionStorage.
  await page.reload({ waitUntil: "networkidle0" });
  const restoredVideo = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="videoId"]');
    return input ? input.value : "";
  });
  check("Preview: sessionStorage memulihkan input setelah reload", restoredVideo === VIDEO, restoredVideo);

  // ── 5. Preview: tombol Reset (header hasil) ──────────────────
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Reset",
    );
    btn?.click();
  });
  await waitForText(page, "Muat contoh", 10000);
  const prevReset = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="videoId"]');
    const ta = document.querySelector("textarea");
    return {
      videoEmpty: input ? input.value === "" : false,
      jsonEmpty: ta ? ta.value === "" : false,
      gridGone: document.querySelector("[class*='lg:grid-cols-2']") === null,
    };
  });
  check(
    "Preview: Reset mengosongkan input + textarea + hasil",
    prevReset.videoEmpty && prevReset.jsonEmpty && prevReset.gridGone,
  );

  // Reset juga menghapus sessionStorage → reload tidak memulihkan data lama.
  await page.reload({ waitUntil: "networkidle0" });
  const afterResetVideo = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="videoId"]');
    return input ? input.value : "";
  });
  check("Preview: Reset menghapus sessionStorage (reload tetap kosong)", afterResetVideo === "");

  // ── 6. Clip: error validasi (start ≥ end) ────────────────────
  await page.goto(`${BASE}/tools/clip`, { waitUntil: "networkidle0" });
  await page.type("#clip-video", VIDEO);
  await page.type("#clip-start", "50");
  await page.type("#clip-end", "40");
  await page.click('button[type="submit"]');
  await waitForText(page, "Rentang tidak valid", 15000);
  const clipErr = await page.evaluate(() => document.body.innerText);
  check("Clip: ErrorNotice validasi tampil", clipErr.includes("Rentang tidak valid"));

  // ── 7. Clip: tombol Reset ────────────────────────────────────
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.trim() === "Reset",
    );
    btn?.click();
  });
  const clipReset = await page.evaluate(() => {
    const get = (sel) => document.querySelector(sel);
    const video = get("#clip-video");
    const start = get("#clip-start");
    const end = get("#clip-end");
    return {
      videoEmpty: video ? video.value === "" : false,
      startEmpty: start ? start.value === "" : false,
      endEmpty: end ? end.value === "" : false,
      errGone: !document.body.innerText.includes("Rentang tidak valid"),
    };
  });
  check(
    "Clip: Reset mengosongkan form & error",
    clipReset.videoEmpty && clipReset.startEmpty && clipReset.endEmpty && clipReset.errGone,
  );

  // ── 8. Clip: sukses unduh (dengan fallback rate-limit) ───────
  // Jeda lebih lama supaya YouTube tidak rate-limit dari tes sebelumnya.
  await new Promise((r) => setTimeout(r, 30000));
  await page.goto(`${BASE}/tools/clip`, { waitUntil: "networkidle0" });
  await page.type("#clip-video", VIDEO);
  await page.type("#clip-start", "60");
  await page.type("#clip-end", "75");
  // Resolusi rendah supaya tes cepat & tidak rentan rate-limit.
  await page.select("#clip-resolution", "360");
  await page.click('button[type="submit"]');

  const waitClipResult = async () => {
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Klip selesai diunduh") ||
        document.body.innerText.includes("RATE LIMIT"),
      { timeout: 150000 },
    );
    return page.evaluate(() => document.body.innerText);
  };

  let clipState = await waitClipResult();
  if (clipState.includes("RATE LIMIT")) {
    // Kena rate-limit YouTube: tunggu countdown selesai lalu klik "Coba lagi".
    check("Clip: ErrorNotice RATE LIMIT muncul", true);
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Coba lagi"),
      { timeout: 60000 },
    );
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "Coba lagi",
      );
      btn?.click();
    });
    clipState = await waitClipResult();
  }
  check("Clip: status selesai tampil", clipState.includes("Klip selesai diunduh"));
  // Write ke disk selesai sesaat setelah status — polling hingga 15 detik.
  let files = [];
  for (let i = 0; i < 15; i++) {
    files = readdirSync(DL_DIR).filter((f) => f.endsWith(".mp4"));
    if (files.length > 0) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  check("Clip: mp4 terunduh ke disk", files.length > 0, files.join(", "));
} catch (err) {
  // Diagnosa: apa yang tampil di halaman saat timeout?
  let state = "";
  try {
    state = (await page.evaluate(() => document.body.innerText))
      .split("\n")
      .filter((l) => l.trim())
      .slice(-8)
      .join(" | ");
  } catch {
    /* page sudah ditutup */
  }
  check(`Eksekusi terhenti: ${err.message}${state ? ` — state: ${state}` : ""}`, false);
}

check("Tidak ada error console/pageerror", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

await browser.close();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n=== ${results.length - failed}/${results.length} lulus ===`);
process.exit(failed > 0 ? 1 : 0);
