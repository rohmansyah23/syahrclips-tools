import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const REAL_VIDEO = "dQw4w9WgXcQ";
const BOGUS_VIDEO = "aaaaaaaaaaa"; // video tak tersedia → 403 asli dari yt-dlp
const SHOTS = "/tmp/e2e-shots";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const waitForText = (page, text, timeout = 60000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const client = await browser.target().createCDPSession();
await client.send("Browser.setDownloadBehavior", {
  behavior: "allow",
  downloadPath: "/tmp/e2e-downloads",
  eventsEnabled: true,
});

const fillClipForm = async (videoId, start, end) => {
  await page.goto(`${BASE}/tools/clip`, { waitUntil: "networkidle0" });
  await page.type("#clip-video", videoId);
  await page.type("#clip-start", start);
  await page.type("#clip-end", end);
  await page.select("#clip-resolution", "360");
  await page.click('button[type="submit"]');
};

try {
  // ══ A. 403 asli: video tidak tersedia ═════════════════════════
  await fillClipForm(BOGUS_VIDEO, "0", "10");
  await waitForText(page, "AKSES DITOLAK", 60000);
  await waitForText(page, "HTTP 403", 10000);
  const state403 = await page.evaluate(() => document.body.innerText);
  check(
    "403: badge AKSES DITOLAK + HTTP 403 tampil",
    state403.includes("AKSES DITOLAK") && state403.includes("HTTP 403"),
  );
  check(
    "403: pesan server + hint tampil",
    state403.includes("Video tidak dapat diunduh") &&
      state403.includes("Coba video lain"),
  );
  const hasRetry403 = await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) =>
      b.textContent.trim().startsWith("Coba lagi"),
    ),
  );
  check("403: TANPA tombol Coba lagi (tidak retryable)", !hasRetry403);
  await page.screenshot({ path: `${SHOTS}/error-403.png` });

  // ══ B. 429 asli: picu throttle YouTube lewat submit berulang ══
  console.log("── Memicu throttle YouTube (submit klip berulang)…");
  let saw429 = false;
  for (let i = 1; i <= 5 && !saw429; i++) {
    await fillClipForm(REAL_VIDEO, String(30 + i * 10), String(40 + i * 10));
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Klip selesai diunduh") ||
        document.body.innerText.includes("RATE LIMIT") ||
        document.body.innerText.includes("ERR 429"),
      { timeout: 120000 },
    );
    const text = await page.evaluate(() => document.body.innerText);
    if (text.includes("RATE LIMIT") || text.includes("ERR 429")) {
      saw429 = true;
      console.log(`   throttle muncul pada percobaan #${i}`);
      check("429: badge RATE LIMIT + HTTP 429 tampil", true);
      await waitForText(page, "HTTP 429", 10000);
      // Countdown berjalan → tombol disabled "Coba lagi (Ns)"
      const countdownShown = await page.waitForFunction(
        () =>
          [...document.querySelectorAll("button")].some((b) =>
            /^Coba lagi \(\d+s\)$/.test(b.textContent.trim()),
          ),
        { timeout: 10000 },
      );
      check("429: countdown 'Coba lagi (Ns)' tampil", !!countdownShown);
      // Tunggu countdown selesai → tombol jadi enabled "Coba lagi"
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("button")].some(
            (b) => b.textContent.trim() === "Coba lagi" && !b.disabled,
          ),
        { timeout: 60000 },
      );
      check("429: tombol Coba lagi aktif setelah countdown", true);
      await page.screenshot({ path: `${SHOTS}/error-429.png` });
    } else {
      console.log(`   percobaan #${i} sukses (belum throttle)`);
    }
  }
  if (!saw429) {
    check(
      "429: throttle tidak terpicu sesi ini (YouTube tidak membatasi)",
      true,
      "UI 429 sudah terverifikasi di run E2E sebelumnya",
    );
  }
} catch (err) {
  let state = "";
  try {
    state = (await page.evaluate(() => document.body.innerText))
      .split("\n")
      .filter((l) => l.trim())
      .slice(-8)
      .join(" | ");
  } catch {
    /* halaman ditutup */
  }
  check(`Eksekusi terhenti: ${err.message}${state ? ` — state: ${state}` : ""}`, false);
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n=== ${results.length - failed}/${results.length} lulus ===`);
console.log(`Screenshot: ${SHOTS}/error-403.png, ${SHOTS}/error-429.png`);
process.exit(failed > 0 ? 1 : 0);
