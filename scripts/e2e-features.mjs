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

  // ══ 5. Auto-fill: konteks video bersama → Preview ────────────
  await page.goto(`${BASE}/tools/preview`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    sessionStorage.setItem(
      "syahrclips:video",
      JSON.stringify({
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoId: "dQw4w9WgXcQ",
        title: "T",
        author: "A",
      }),
    );
  });
  await page.reload({ waitUntil: "networkidle0" });
  const previewFilled = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="videoId"]');
    return input ? input.value : "";
  });
  check(
    "Auto-fill: Preview mengisi video dari transkrip",
    previewFilled === "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  const previewHint = await page.evaluate(() =>
    document.body.innerText.includes("Video otomatis terisi dari transkrip"),
  );
  check("Auto-fill: Preview menampilkan petunjuk video dari langkah 1", previewHint);
  const previewStepDone = await page.evaluate(
    () => document.querySelector('a[aria-label="Transkrip — selesai"]') !== null,
  );
  check("Auto-fill: FlowSteps menandai langkah 1 selesai di Preview", previewStepDone);

  // ══ 6. Auto-fill: konteks video bersama → Klip ───────────────
  await page.goto(`${BASE}/tools/clip`, { waitUntil: "networkidle0" });
  const klipFilled = await page.evaluate(() => {
    const input = document.querySelector("#clip-video");
    return input ? input.value : "";
  });
  check(
    "Auto-fill: Klip mengisi video dari transkrip",
    klipFilled === "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  const klipBanner = await page.evaluate(() =>
    document.body.innerText.toLowerCase().includes("video dari transkrip (langkah 1)"),
  );
  check("Auto-fill: Klip menampilkan banner video dari transkrip", klipBanner);

  // ══ 7. Auto-fill: Reset Preview membersihkan konteks bersama ──
  await page.goto(`${BASE}/tools/preview`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Reset",
    );
    btn?.click();
  });
  await page.reload({ waitUntil: "networkidle0" });
  const previewAfterReset = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder*="videoId"]');
    return input ? input.value : "";
  });
  check(
    "Auto-fill: Reset Preview membersihkan konteks video bersama",
    previewAfterReset === "",
  );

  // ══ 8. Mobile (375×667): tanpa overflow horizontal ───────────
  await page.setViewport({ width: 375, height: 667 });
  for (const path of ["/", "/tools/transcript", "/tools/preview", "/tools/clip"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(`Mobile: tanpa overflow horizontal @ ${path || "/"}`, overflow <= 0, `${overflow}px`);
  }

  // ══ 9. Mobile: hamburger menu ────────────────────────────────
  await page.goto(`${BASE}/tools/transcript`, { waitUntil: "networkidle0" });
  const hamburgerVisible = await page.evaluate(
    () => document.querySelector('button[aria-label="Buka menu"]') !== null,
  );
  check("Mobile: tombol hamburger tampil", hamburgerVisible);

  await page.evaluate(() => {
    document.querySelector('button[aria-label="Buka menu"]')?.click();
  });
  const menuItems = await page.evaluate(() => {
    const nav = document.querySelector("#mobile-menu");
    if (!nav) return [];
    return [...nav.querySelectorAll("a")].map((a) => (a.textContent || "").trim());
  });
  check(
    "Mobile: hamburger membuka menu dengan 3 link",
    menuItems.length === 3 && menuItems[0].includes("Transkrip"),
    menuItems.join(", "),
  );

  await page.evaluate(() => {
    const link = [...document.querySelectorAll("#mobile-menu a")].find((a) =>
      (a.textContent || "").includes("Preview"),
    );
    link?.click();
  });
  await page.waitForFunction(
    () => location.pathname.startsWith("/tools/preview"),
    { timeout: 10000 },
  );
  const menuClosed = await page.evaluate(() => document.querySelector("#mobile-menu") === null);
  check("Mobile: klik link menavigasi & menu tertutup", menuClosed);
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
