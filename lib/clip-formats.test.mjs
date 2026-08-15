import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttempts, codecName, pickFormats } from "./clip-formats.ts";

// ── Fixture format YouTube (mirip output yt-dlp) ──────────────
const fmt = (o = {}) => ({
  format_id: "test",
  url: "https://example.com/stream",
  height: 360,
  vcodec: "avc1.42001E",
  acodec: "mp4a.40.2",
  ext: "mp4",
  protocol: "https",
  has_drm: false,
  fragments: undefined,
  abr: undefined,
  ...o,
});
const videoOnly = (o = {}) => fmt({ acodec: undefined, ...o });
const audioOnly = (o = {}) => fmt({ vcodec: undefined, ...o });
const hls = (o = {}) => fmt({ protocol: "m3u8_native", fragments: [{}], ...o });

// ── codecName ─────────────────────────────────────────────────
test("codecName: avc1 → h264, av01 → av1, vp9 → vp9, lainnya → other", () => {
  assert.equal(codecName(fmt({ vcodec: "avc1.640028" })), "h264");
  assert.equal(codecName(fmt({ vcodec: "av01.0.08M" })), "av1");
  assert.equal(codecName(fmt({ vcodec: "vp9" })), "vp9");
  assert.equal(codecName(fmt({ vcodec: "hevc" })), "other");
  assert.equal(codecName(fmt({ vcodec: undefined })), "other");
});

// ── pickFormats: preferensi ───────────────────────────────────
test("pickFormats: progresif h264 (itag 18) menang atas video-only di tinggi sama", () => {
  const r = pickFormats(
    [videoOnly({ format_id: "134", vcodec: "avc1.4D401E" }), fmt({ format_id: "18" })],
    360,
    false,
  );
  assert.ok(r);
  assert.equal(r.picked.video.format_id, "18");
  assert.equal(r.picked.audio, undefined); // progresif — tak perlu audio terpisah
  assert.equal(r.codec, "h264");
});

test("pickFormats: preferLight=false pilih h264 (137) di atas av1/vp9", () => {
  const r = pickFormats(
    [
      videoOnly({ format_id: "248", height: 1080, vcodec: "vp9", ext: "webm" }),
      videoOnly({ format_id: "399", height: 1080, vcodec: "av01.0.08M" }),
      videoOnly({ format_id: "137", height: 1080, vcodec: "avc1.640028" }),
      audioOnly({ format_id: "140", abr: 128 }),
    ],
    1080,
    false,
  );
  assert.ok(r);
  assert.equal(r.picked.video.format_id, "137");
  assert.equal(r.picked.audio.format_id, "140");
  assert.equal(r.codec, "h264");
});

test("pickFormats: preferLight=true pilih av1 (399) + audio ~128kbps", () => {
  const r = pickFormats(
    [
      videoOnly({ format_id: "137", height: 1080, vcodec: "avc1.640028" }),
      videoOnly({ format_id: "399", height: 1080, vcodec: "av01.0.08M" }),
      audioOnly({ format_id: "139", abr: 48 }),
      audioOnly({ format_id: "140", abr: 128 }),
      audioOnly({ format_id: "141", abr: 256 }),
    ],
    1080,
    true,
  );
  assert.ok(r);
  assert.equal(r.picked.video.format_id, "399");
  assert.equal(r.picked.audio.format_id, "140"); // bitrate paling dekat 128kbps
  assert.equal(r.codec, "av1");
});

test("pickFormats: webm progresif dipakai kalau tidak ada mp4", () => {
  const r = pickFormats([fmt({ format_id: "43", height: 360, vcodec: "vp9", ext: "webm" })], 360, false);
  assert.ok(r);
  assert.equal(r.picked.video.format_id, "43");
  assert.equal(r.picked.audio, undefined);
  assert.equal(r.codec, "vp9");
});

// ── pickFormats: tinggi aktual / batas ────────────────────────
test("pickFormats: tinggi aktual bisa di bawah target (video 240p-max, minta 1080) — tidak upscale", () => {
  const r = pickFormats(
    [
      fmt({ format_id: "18", height: 240 }),
      videoOnly({ format_id: "133", height: 240, vcodec: "avc1.4D401E" }),
      videoOnly({ format_id: "395", height: 240, vcodec: "av01.0.05M" }),
    ],
    1080,
    false,
  );
  assert.ok(r);
  assert.equal(r.picked.video.height, 240);
  assert.equal(r.picked.video.format_id, "18");
});

test("pickFormats: tidak pernah upscale — hanya ada 480p, minta 360 → null", () => {
  assert.equal(pickFormats([fmt({ format_id: "18", height: 480 })], 360, false), null);
});

test("pickFormats: HLS/fragmented & DRM diabaikan", () => {
  const r = pickFormats(
    [
      hls({ format_id: "96", height: 1080 }),
      fmt({ format_id: "137", height: 1080, has_drm: true }),
      fmt({ format_id: "18" }),
    ],
    1080,
    false,
  );
  assert.ok(r);
  assert.equal(r.picked.video.format_id, "18");
});

test("pickFormats: hanya HLS/fragmented → null", () => {
  assert.equal(pickFormats([hls({ format_id: "96", height: 1080 })], 1080, false), null);
});

test("pickFormats: DASH tanpa audio-only → null", () => {
  assert.equal(
    pickFormats([videoOnly({ format_id: "137", height: 1080, vcodec: "avc1.640028" })], 1080, false),
    null,
  );
});

// ── buildAttempts: rantai auto-degrade ────────────────────────
test("buildAttempts: 1080 → h264 lalu light per tinggi, turun ke 144", () => {
  assert.deepEqual(buildAttempts(1080), [
    { height: 1080, light: false },
    { height: 1080, light: true },
    { height: 720, light: false },
    { height: 720, light: true },
    { height: 480, light: false },
    { height: 480, light: true },
    { height: 360, light: false },
    { height: 240, light: false },
    { height: 144, light: false },
  ]);
});

test("buildAttempts: 360 → tanpa varian light sama sekali (h ≤ 360 file sudah kecil)", () => {
  assert.deepEqual(buildAttempts(360), [
    { height: 360, light: false },
    { height: 240, light: false },
    { height: 144, light: false },
  ]);
});

test("buildAttempts: 144 → satu percobaan", () => {
  assert.deepEqual(buildAttempts(144), [{ height: 144, light: false }]);
});

test("buildAttempts: di bawah minimum → fallback ke 144", () => {
  assert.deepEqual(buildAttempts(100), [{ height: 144, light: false }]);
});

test("buildAttempts: percobaan pertama selalu h264 pada resolusi yang diminta", () => {
  const a = buildAttempts(720);
  assert.deepEqual(a[0], { height: 720, light: false });
  assert.equal(a[1].light, true);
});

// ── Integrasi: degrade nyata dari rantai percobaan ────────────
test("degrade nyata: video 240p-max, minta 1080 → percobaan pertama memberi 240p h264", () => {
  const formats = [
    fmt({ format_id: "18", height: 240 }),
    videoOnly({ format_id: "133", height: 240, vcodec: "avc1.4D401E" }),
  ];
  const [first] = buildAttempts(1080);
  const r = pickFormats(formats, first.height, first.light);
  assert.ok(r);
  assert.equal(r.picked.video.height, 240); // tinggi aktual < target percobaan
  assert.equal(r.codec, "h264");
});
