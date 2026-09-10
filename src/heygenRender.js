import fetch from "node-fetch";
import fs from "fs";
import { pipeline } from "stream/promises";

const HEYGEN_BASE = "https://api.heygen.com";

/**
 * Submits a script to HeyGen's v2 video generation endpoint using a
 * pre-selected avatar + voice, then polls v1/video_status.get until the
 * render finishes, then downloads the resulting MP4.
 *
 * Verify field names against https://docs.heygen.com/reference/create-video
 * before relying on this in production — HeyGen's API has changed shape
 * before (v1 -> v2 -> "New AI Studio") and may again.
 */
export async function renderAvatarVideo(script, { outputPath }) {
  const apiKey = process.env.HEYGEN_API_KEY;
  const avatarId = process.env.HEYGEN_AVATAR_ID;
  const voiceId = process.env.HEYGEN_VOICE_ID;

  if (!apiKey || !avatarId || !voiceId) {
    throw new Error(
      "Missing HEYGEN_API_KEY / HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID env vars"
    );
  }

  // 1. Submit the render job
  const generateRes = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: avatarId,
            avatar_style: "normal",
          },
          voice: {
            type: "text",
            input_text: script,
            voice_id: voiceId,
            speed: 1,
          },
        },
      ],
      dimension: { width: 1080, height: 1920 }, // vertical, for Shorts
      aspect_ratio: "9:16",
      test: process.env.HEYGEN_TEST_MODE === "true",
    }),
  });

  const generateData = await generateRes.json();
  if (!generateRes.ok || !generateData?.data?.video_id) {
    throw new Error(
      `HeyGen generate request failed: ${JSON.stringify(generateData)}`
    );
  }
  const videoId = generateData.data.video_id;

  // 2. Poll for completion
  const videoUrl = await pollUntilComplete(videoId, apiKey);

  // 3. Download the finished MP4
  const downloadRes = await fetch(videoUrl);
  if (!downloadRes.ok || !downloadRes.body) {
    throw new Error(`Failed to download rendered video from ${videoUrl}`);
  }
  await pipeline(downloadRes.body, fs.createWriteStream(outputPath));

  return outputPath;
}

async function pollUntilComplete(
  videoId,
  apiKey,
  { intervalMs = 10_000, maxAttempts = 60 } = {}
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(
      `${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`,
      { headers: { "X-Api-Key": apiKey } }
    );
    const data = await res.json();
    const status = data?.data?.status;

    if (status === "completed") {
      return data.data.video_url;
    }
    if (status === "failed") {
      throw new Error(`HeyGen render failed: ${JSON.stringify(data)}`);
    }
    // pending / processing / waiting -> keep polling
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `HeyGen render did not complete after ${maxAttempts} polling attempts`
  );
}
