import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const REAL_VIDEO = "dQw4w9WgXcQ";
const SHOTS = "/tmp/e2e-shots";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

try {
  // Isi form SEKARANG, sebelum hammer — supaya klik bisa langsung dikirim
  // begitu throttle terdeteksi.
  await page.goto(`${BASE}/tools/clip`, { waitUntil: "networkidle0" });
  await page.type("#clip-video", REAL_VIDEO);
  await page.type("#clip-start", "30");
  await page.type("#clip-end", "45");
  await page.select("#clip-resolution", "360");
  console.log("Form terisi — mulai hammer API + klik browser serentak…");

  // ── Hammer API paralel (mendorong YouTube ke throttle) ───────
  let apiThrottled = false;
  const hammer = (async () => {
    for (let i = 1; i <= 12; i++) {
      const t0 = Date.now();
      try {
        const res = await fetch(`${BASE}/api/clip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: REAL_VIDEO, start: 20 + i * 5, end: 30 + i * 5, resolution: 360 }),
        });
        const body = await res.arrayBuffer();
        console.log(`   [api] #${i} status=${res.status} (${Date.now() - t0}ms) ${body.byteLength}B`);
        if (res.status === 429) {
          apiThrottled = true;
          return;
        }
      } catch {
        /* lanjut */
      }
      await sleep(400);
    }
  })();

  // ── Klik berulang di browser sampai RATE LIMIT muncul ────────
  let sawRateLimit = false;
  for (let attempt = 1; attempt <= 4 && !sawRateLimit; attempt++) {
    // Pastikan form masih kosong (reset state kalau perlu) sebelum klik.
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        b.textContent.includes("Download klip"),
      );
      btn?.click();
    });
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Klip selesai diunduh") ||
        document.body.innerText.includes("RATE LIMIT") ||
        document.body.innerText.includes("ERR 429"),
      { timeout: 120000 },
    );
    const text = await page.evaluate(() => document.body.innerText);
    if (text.includes("RATE LIMIT") || text.includes("ERR 429")) {
      sawRateLimit = true;
      console.log(`   [browser] RATE LIMIT muncul pada klik #${attempt}`);
      check("429: badge RATE LIMIT + HTTP 429 tampil", true);
      const has429 = await page.waitForFunction(
        () => document.body.innerText.includes("HTTP 429"),
        { timeout: 10000 },
      );
      check("429: label HTTP 429 tampil", !!has429);
      const state = await page.evaluate(() => document.body.innerText);
      check(
        "429: pesan + hint rate-limit tampil",
        state.includes("Terlalu banyak permintaan") &&
          state.includes("Tunggu beberapa saat lalu coba lagi"),
      );
      const countdownShown = await page.waitForFunction(
        () =>
          [...document.querySelectorAll("button")].some((b) =>
            /^Coba lagi \(\d+s\)$/.test(b.textContent.trim()),
          ),
        { timeout: 10000 },
      );
      check("429: countdown 'Coba lagi (Ns)' berjalan", !!countdownShown);
      await page.screenshot({ path: `${SHOTS}/error-429.png` });
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("button")].some(
            (b) => b.textContent.trim() === "Coba lagi" && !b.disabled,
          ),
        { timeout: 60000 },
      );
      check("429: tombol Coba lagi aktif setelah countdown", true);
    } else {
      console.log(`   [browser] klik #${attempt} sukses (belum throttle)`);
      // Bersihkan hasil agar form siap diklik lagi.
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) =>
          b.textContent.includes("Download klip"),
        );
        btn?.scrollIntoView();
      });
    }
  }

  await hammer;
  if (!sawRateLimit) {
    check(
      "429: UI tidak sempat terlihat (throttle terlewat)",
      false,
      apiThrottled
        ? "API sempat 429 tetapi jendela throttle tertutup sebelum klik browser"
        : "YouTube tidak memberi 429 selama pengujian ini",
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
    /* ditutup */
  }
  check(`Eksekusi terhenti: ${err.message}${state ? ` — state: ${state}` : ""}`, false);
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n=== ${results.length - failed}/${results.length} lulus ===`);
console.log(`Screenshot: ${SHOTS}/error-429.png`);
process.exit(failed > 0 ? 1 : 0);
