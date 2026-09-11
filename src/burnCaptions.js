import { execFileSync } from "child_process";

/**
 * Burns the given SRT file onto the video as hardcoded (visible-by-default)
 * captions, using ffmpeg's subtitles filter. Styled for a 1080x1920 vertical
 * Short: white text, black outline, bottom-center, positioned above the
 * area YouTube's UI (like/comment/share buttons, caption text) usually
 * covers.
 *
 * Requires ffmpeg to be installed on the runner (added as an explicit step
 * in the GitHub Actions workflow, even though ubuntu-latest usually ships
 * with it already, to not depend on that assumption holding forever).
 */
export function burnCaptions({ videoPath, srtPath, outputPath }) {
  // libass (used by ffmpeg's subtitles filter) wants forward slashes and
  // escaped colons in the filter graph, even on Linux, because the filter
  // string itself uses colons as separators.
  const escapedSrtPath = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

  const style = [
    "FontName=Arial",
    "FontSize=32",                 // tuned for a 1080x1920 canvas; adjust if it looks too big/small
    "PrimaryColour=&H00FFFFFF",   // white text
    "OutlineColour=&H00000000",   // black outline
    "BorderStyle=1",
    "Outline=2",
    "Shadow=0",
    "Alignment=2",                 // bottom-center
    "MarginV=220",                 // clear of YouTube's Shorts UI overlay
  ].join(",");

  // original_size tells libass to treat FontSize/MarginV as relative to
  // the video's real 1080x1920 canvas. Without it, libass falls back to a
  // small default script resolution and then scales everything up to fit
  // the actual frame — which was making the text render far too large and
  // overflow past the top of the video.
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i", videoPath,
      "-vf", `subtitles=${escapedSrtPath}:original_size=1080x1920:force_style='${style}'`,
      "-c:a", "copy",
      outputPath,
    ],
    { stdio: "inherit" }
  );

  return outputPath;
}
