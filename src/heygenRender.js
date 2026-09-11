import fetch from "node-fetch";
import fs from "fs";
import { pipeline } from "stream/promises";

const HEYGEN_BASE = "https://api.heygen.com";

/**
 * Submits a script to HeyGen's v3 video generation endpoint (POST /v3/videos)
 * using a pre-selected avatar + voice, then polls GET /v3/videos/{id} until
 * the render finishes, then downloads the resulting MP4.
 *
 * v1/v2 are legacy and scheduled for removal 2026-10-31 — this uses the
 * current v3 "CreateVideoFromAvatar" schema. See
 * https://developers.heygen.com/endpoint-version-comparison for reference.
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
  const generateRes = await fetch(`${HEYGEN_BASE}/v3/videos`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "avatar",
      avatar_id: avatarId,
      script,
      voice_id: voiceId,
      resolution: "1080p",
      aspect_ratio: "9:16", // vertical, for Shorts
      // Note: unlike the legacy v1/v2 API, v3 rejects an unrecognized "test"
      // field outright ("Extra inputs are not permitted") — there's no
      // built-in free test mode here. See createPlaceholderVideo.js for
      // how testing without spending credits is handled instead.
    }),
  });

  const generateData = await generateRes.json();
  // Note: HeyGen's actual response uses "video_id" here, not "id" as some
  // docs suggest — confirmed against a real API response.
  if (!generateRes.ok || !generateData?.data?.video_id) {
    throw new Error(
      `HeyGen generate request failed: ${JSON.stringify(generateData)}`
    );
  }
  const videoId = generateData.data.video_id;

  // 2. Poll for completion
  const { videoUrl, duration } = await pollUntilComplete(videoId, apiKey);

  // 3. Download the finished MP4
  const downloadRes = await fetch(videoUrl);
  if (!downloadRes.ok || !downloadRes.body) {
    throw new Error(`Failed to download rendered video from ${videoUrl}`);
  }
  await pipeline(downloadRes.body, fs.createWriteStream(outputPath));

  return { outputPath, duration };
}

async function pollUntilComplete(
  videoId,
  apiKey,
  { intervalMs = 10_000, maxAttempts = 120 } = {}
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${HEYGEN_BASE}/v3/videos/${videoId}`, {
      headers: { "X-Api-Key": apiKey },
    });
    const data = await res.json();
    const status = data?.data?.status;

    if (status === "completed") {
      return { videoUrl: data.data.video_url, duration: data.data.duration };
    }
    if (status === "failed") {
      throw new Error(
        `HeyGen render failed: ${data?.data?.failure_message || JSON.stringify(data)}`
      );
    }
    // waiting / pending / processing -> keep polling
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `HeyGen render did not complete after ${maxAttempts} polling attempts`
  );
}
