/**
 * Builds a simple SRT caption file from the script text, distributing
 * timing across the video's actual duration (from HeyGen) proportionally
 * to each sentence's word count. Not word-perfect lip-sync timing, but
 * close enough for readable captions without needing speech-to-text.
 */
export function buildSrt(script, durationSeconds) {
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return "";

  const wordCounts = sentences.map((s) => s.split(/\s+/).length);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);

  let cursor = 0;
  const lines = [];

  sentences.forEach((sentence, i) => {
    const share = wordCounts[i] / totalWords;
    const start = cursor;
    const end = i === sentences.length - 1 ? durationSeconds : cursor + share * durationSeconds;
    cursor = end;

    lines.push(String(i + 1));
    lines.push(`${formatTimestamp(start)} --> ${formatTimestamp(end)}`);
    lines.push(sentence);
    lines.push("");
  });

  return lines.join("\n");
}

function formatTimestamp(totalSeconds) {
  const ms = Math.round((totalSeconds % 1) * 1000);
  const totalWholeSeconds = Math.floor(totalSeconds);
  const s = totalWholeSeconds % 60;
  const m = Math.floor(totalWholeSeconds / 60) % 60;
  const h = Math.floor(totalWholeSeconds / 3600);
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}
