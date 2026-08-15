import { NextRequest, NextResponse } from "next/server";
import { getTranscript, TranscriptError, parseYouTubeUrl } from "@/lib/transcript";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Body harus JSON dengan field "url".' },
      { status: 400 },
    );
  }

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "URL YouTube wajib diisi." }, { status: 400 });
  }

  const videoId = parseYouTubeUrl(url);
  if (!videoId) {
    return NextResponse.json(
      { error: "URL tidak valid — gunakan youtube.com/watch?v=… atau youtu.be/…." },
      { status: 400 },
    );
  }

  try {
    const result = await getTranscript(videoId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TranscriptError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Gagal mengambil transkrip, coba lagi." },
      { status: 502 },
    );
  }
}
