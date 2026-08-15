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
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error" && !msg.text().includes("Failed to load resource")) {
    consoleErrors.push(msg.text());
  }
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

  // ── 4. Preview: iframe per candidate ─────────────────────────
  await page.goto(`${BASE}/tools/preview`, { waitUntil: "networkidle0" });
  await page.type('input[placeholder*="videoId"]', VIDEO);
  await page.click('button:not([disabled])');
  await page.waitForSelector("iframe[src*='youtube-nocookie.com/embed/']", { timeout: 15000 });
  const iframeCount = await page.$$eval("iframe[src*='youtube-nocookie.com/embed/']", (els) => els.length);
  const rangeText = await page.evaluate(() => document.body.innerText.includes("[00:01:05 – 00:01:10]"));
  check("Preview: 2 iframe candidate (contoh JSON)", iframeCount === 2, `iframe=${iframeCount}`);
  check("Preview: range mono tampil", rangeText);

  // ── 5. Clip: error validasi (start ≥ end) ────────────────────
  await page.goto(`${BASE}/tools/clip`, { waitUntil: "networkidle0" });
  await page.type("#clip-video", VIDEO);
  await page.type("#clip-start", "50");
  await page.type("#clip-end", "40");
  await page.click('button[type="submit"]');
  await waitForText(page, "Rentang tidak valid", 15000);
  const clipErr = await page.evaluate(() => document.body.innerText);
  check("Clip: ErrorNotice validasi tampil", clipErr.includes("Rentang tidak valid"));

  // ── 6. Clip: sukses unduh (dengan fallback rate-limit) ───────
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
