import { ClipTool } from "./clip-tool";

export default async function ClipPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  return (
    <ClipTool
      initialVideoId={str(sp.videoId)}
      initialStart={str(sp.start)}
      initialEnd={str(sp.end)}
    />
  );
}
