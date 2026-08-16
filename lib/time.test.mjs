import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRangeToSeconds, parseTimeToSeconds } from "./time.ts";
import { buildPromptBundle, LLM_PROMPT_TRANSCRIPT_PLACEHOLDER } from "./llm.ts";

// ── parseTimeToSeconds ─────────────────────────────────────────
test("parseTimeToSeconds: angka & string angka", () => {
  assert.equal(parseTimeToSeconds(65), 65);
  assert.equal(parseTimeToSeconds("65"), 65);
  assert.equal(parseTimeToSeconds("7"), 7);
  assert.equal(parseTimeToSeconds(0), 0);
  assert.equal(parseTimeToSeconds("  90  "), 90);
});

test("parseTimeToSeconds: MM:SS → detik", () => {
  assert.equal(parseTimeToSeconds("01:05"), 65);
  assert.equal(parseTimeToSeconds("0:07"), 7);
  assert.equal(parseTimeToSeconds("07:00"), 420);
  assert.equal(parseTimeToSeconds("01:30"), 90);
});

test("parseTimeToSeconds: HH:MM:SS → detik", () => {
  assert.equal(parseTimeToSeconds("00:00:07"), 7);
  assert.equal(parseTimeToSeconds("00:01:05"), 65);
  assert.equal(parseTimeToSeconds("00:10:00"), 600);
  assert.equal(parseTimeToSeconds("01:00:00"), 3600);
  assert.equal(parseTimeToSeconds("1:02:03"), 3723);
});

test("parseTimeToSeconds: nilai tidak valid → null", () => {
  assert.equal(parseTimeToSeconds("abc"), null);
  assert.equal(parseTimeToSeconds(""), null);
  assert.equal(parseTimeToSeconds("  "), null);
  assert.equal(parseTimeToSeconds(-5), null);
  assert.equal(parseTimeToSeconds(undefined), null);
  assert.equal(parseTimeToSeconds(null), null);
  assert.equal(parseTimeToSeconds("1:99"), null);
  assert.equal(parseTimeToSeconds(true), null);
});

// ── parseRangeToSeconds ────────────────────────────────────────
test("parseRangeToSeconds: rentang hyphen & en-dash", () => {
  assert.deepEqual(parseRangeToSeconds("00:00:00 - 00:00:07"), { start: 0, end: 7 });
  assert.deepEqual(parseRangeToSeconds("00:00:00 – 00:00:07"), { start: 0, end: 7 });
  assert.deepEqual(parseRangeToSeconds("01:05 - 02:15"), { start: 65, end: 135 });
  assert.deepEqual(parseRangeToSeconds("0 - 7"), { start: 0, end: 7 });
});

test("parseRangeToSeconds: bukan rentang → null", () => {
  assert.equal(parseRangeToSeconds("00:00:07"), null);
  assert.equal(parseRangeToSeconds(7), null);
  assert.equal(parseRangeToSeconds("a - b"), null);
  assert.equal(parseRangeToSeconds(""), null);
});

// ── buildPromptBundle ──────────────────────────────────────────
test("buildPromptBundle: placeholder diganti transkrip", () => {
  const transcript = "[00:00:00] Today is the day\n[00:00:07] Teman-teman semua.";
  const bundle = buildPromptBundle(transcript);
  assert.ok(bundle.includes("FORMAT WAKTU"));
  assert.ok(bundle.includes(transcript));
  assert.ok(!bundle.includes(LLM_PROMPT_TRANSCRIPT_PLACEHOLDER));
});

test("buildPromptBundle: transkrip kosong → prompt tetap lengkap", () => {
  const bundle = buildPromptBundle("   ");
  assert.ok(bundle.includes(LLM_PROMPT_TRANSCRIPT_PLACEHOLDER));
});
