import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3000";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
// Izin baca clipboard untuk verifikasi hasil copy fallback (readText).
const cdp = await browser.target().createCDPSession();
await cdp.send("Browser.grantPermissions", {
  permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  origin: BASE,
});

try {
  // ══ 1. Transkrip: Reset — offline, tanpa fetch ───────────────
  await page.goto(`${BASE}/tools/transcript`, { waitUntil: "networkidle0" });
  const resetInitiallyDisabled = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Reset",
    );
    return btn ? btn.disabled : null;
  });
  check("Transkrip: tombol Reset nonaktif saat kosong", resetInitiallyDisabled === true);

  await page.type('input[placeholder*="youtube.com"]', "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const resetEnabled = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Reset",
    );
    return btn ? !btn.disabled : null;
  });
  check("Transkrip: tombol Reset aktif setelah mengetik URL", resetEnabled === true);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Reset",
    );
    btn?.click();
  });
  const transInput = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="youtube.com"]');
    return input ? input.value : "";
  });
  check("Transkrip: Reset mengosongkan input URL", transInput === "");

  // ══ 2. Preview: Reset dari form (state awal) ─────────────────
  await page.goto(`${BASE}/tools/preview`, { waitUntil: "networkidle0" });
  // JSON contoh terisi → Reset aktif sejak awal.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Reset",
    );
    btn?.click();
  });
  const previewReset = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="videoId"]');
    const ta = document.querySelector("textarea");
    return {
      videoEmpty: input ? input.value === "" : false,
      jsonEmpty: ta ? ta.value === "" : false,
    };
  });
  check(
    "Preview: Reset mengosongkan input video + textarea JSON",
    previewReset.videoEmpty && previewReset.jsonEmpty,
  );

  // ══ 3. Preview: clipboard fallback tanpa navigator.clipboard ─
  // Simulasikan non-secure context (http://IP:3000) dengan menonaktifkan
  // Clipboard API, lalu pastikan fallback execCommand tetap menyalin.
  await page.goto(`${BASE}/tools/preview`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    window.__origClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });
  // Buka <details> "Lihat prompt lengkap" → tombol "Salin prompt" muncul.
  await page.evaluate(() => {
    document.querySelector("details summary")?.click();
  });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some((b) =>
        b.textContent.trim().includes("Salin prompt"),
      ),
    { timeout: 10000 },
  );
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.trim().includes("Salin prompt"),
    );
    btn?.click();
  });
  // Pulihkan Clipboard API, lalu baca hasil salinan fallback dari clipboard.
  const copied = await page.evaluate(async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: window.__origClipboard,
      configurable: true,
    });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) return text;
      } catch {
        /* clipboard belum terisi — coba lagi */
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    return "";
  });
  check(
    "Preview: clipboard fallback menyalin LLM_PROMPT lengkap",
    copied.includes("BERIKUT TRANSCRIPT") && copied.includes("[HH:MM:SS]"),
    `${copied.length} karakter`,
  );

  // ══ 4. Klip: Reset form ──────────────────────────────────────
  await page.goto(`${BASE}/tools/clip`, { waitUntil: "networkidle0" });
  const clipResetInitialDisabled = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Reset",
    );
    return btn ? btn.disabled : null;
  });
  check("Klip: tombol Reset nonaktif saat form kosong", clipResetInitialDisabled === true);

  await page.type("#clip-video", "dQw4w9WgXcQ");
  await page.type("#clip-start", "00:01:05");
  await page.type("#clip-end", "65");
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Reset",
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
    };
  });
  check(
    "Klip: Reset mengosongkan videoId, start, dan end",
    clipReset.videoEmpty && clipReset.startEmpty && clipReset.endEmpty,
  );
} catch (err) {
  let state = "";
  try {
    state = (await page.evaluate(() => document.body.innerText))
      .split("\n")
      .filter((l) => l.trim())
      .slice(-6)
      .join(" | ");
  } catch {
    /* halaman ditutup */
  }
  check(`Eksekusi terhenti: ${err.message}${state ? ` — state: ${state}` : ""}`, false);
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n=== ${results.length - failed}/${results.length} lulus ===`);
process.exit(failed > 0 ? 1 : 0);
