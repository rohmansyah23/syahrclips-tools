export { CLIP_RESOLUTIONS } from "./clip-formats";
export { LLM_PROMPT, LLM_PROMPT_TRANSCRIPT_PLACEHOLDER } from "./llm";

export const MAX_CLIP_SECONDS = 180;

export const DEFAULT_CLIP_RESOLUTION = 1080;

export const TIME_CONVERSIONS = [
  { format: "00:00:07", seconds: 7 },
  { format: "00:00:30", seconds: 30 },
  { format: "00:01:05", seconds: 65 },
  { format: "00:10:00", seconds: 600 },
  { format: "01:00:00", seconds: 3600 },
] as const;

