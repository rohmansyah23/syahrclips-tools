export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptStats {
  segments: number;
  words: number;
  chars: number;
}

export interface TranscriptResult {
  videoId: string;
  title: string;
  author: string;
  segments: TranscriptSegment[];
  text: string;
  stats: TranscriptStats;
}

export interface ClipCandidate {
  start: number;
  end: number;
  reason?: string;
  score?: number;
  title?: string;
}
