import "dotenv/config";
import fs from "fs";
import path from "path";
import { pickTopic } from "./pickTopic.js";
import { research } from "./research.js";
import { generateScript, generateLinkedInPost } from "./generateScript.js";
import { renderAvatarVideo } from "./heygenRender.js";
import { createPlaceholderVideo } from "./createPlaceholderVideo.js";
import { uploadToYouTube } from "./youtubeUpload.js";
import { postToLinkedIn } from "./linkedinPost.js";
import { buildSrt } from "./buildSrt.js";
import { burnCaptions } from "./burnCaptions.js";

const DRY_RUN = process.env.DRY_RUN === "true";

async function main() {
  const topic = pickTopic();
  console.log(`[1/7] Topic: ${topic}`);

  const points = await research(topic);
  console.log(`[2/7] Research points:\n${points.map((p) => `  - ${p}`).join("\n")}`);

  const [script, linkedinPost] = await Promise.all([
    generateScript(topic, points),
    generateLinkedInPost(topic, points),
  ]);
  console.log(`[3/7] Script (${script.split(/\s+/).length} words):\n${script}`);

  // Always save outputs locally so a failed later step doesn't lose the work
  const outDir = path.join(process.cwd(), "output", new Date().toISOString().slice(0, 10));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "script.txt"), script);
  fs.writeFileSync(path.join(outDir, "linkedin-post.txt"), linkedinPost);

  if (DRY_RUN) {
    console.log("DRY_RUN=true — stopping before render/upload. Check the output/ folder.");
    return;
  }

  const videoPath = path.join(outDir, "video.mp4");
  const testMode = (process.env.HEYGEN_TEST_MODE || "").trim().toLowerCase() === "true";
  console.log(`      (debug) HEYGEN_TEST_MODE raw value: "${process.env.HEYGEN_TEST_MODE}" -> testMode=${testMode}`);
  let duration;
  if (testMode) {
    console.log("[4/7] HEYGEN_TEST_MODE=true — skipping HeyGen entirely, using a placeholder video instead...");
    ({ duration } = createPlaceholderVideo(script, { outputPath: videoPath }));
    console.log(`      Placeholder saved to ${videoPath} (duration: ${duration}s)`);
  } else {
    console.log("[4/7] Rendering avatar video with HeyGen (this can take a few minutes)...");
    ({ duration } = await renderAvatarVideo(script, { outputPath: videoPath }));
    console.log(`      Saved to ${videoPath} (duration: ${duration}s)`);
  }

  console.log("[5/7] Burning English captions onto the video...");
  const srt = buildSrt(script, duration);
  const srtPath = path.join(outDir, "captions.srt");
  fs.writeFileSync(srtPath, srt);
  const captionedPath = path.join(outDir, "video-captioned.mp4");
  let uploadPath = videoPath;
  try {
    burnCaptions({ videoPath, srtPath, outputPath: captionedPath });
    uploadPath = captionedPath;
    console.log("      Captions burned in.");
  } catch (err) {
    // Don't fail the whole run over captions — upload the plain video instead
    console.error("      Caption burn-in failed (non-fatal), uploading without captions:", err.message);
  }

  console.log("[6/7] Uploading to YouTube...");
  const ytResult = await uploadToYouTube({
    filePath: uploadPath,
    title: topic.slice(0, 95), // YouTube title limit is 100 chars
    description: `${script}\n\nPayRecon — Warehouse Management System for Singapore e-commerce sellers.`,
    tags: ["ecommerce", "singapore", "shopee", "lazada", "tiktokshop", "wms"],
  });
  console.log(`      Uploaded: https://youtube.com/watch?v=${ytResult.id} (status: ${process.env.YOUTUBE_PUBLISH_STATUS || "private"})`);

  console.log("[7/7] Posting to LinkedIn...");
  if (process.env.LINKEDIN_ACCESS_TOKEN) {
    await postToLinkedIn(linkedinPost);
    console.log("      Posted.");
  } else {
    console.log("      Skipped (no LINKEDIN_ACCESS_TOKEN set) — see output/.../linkedin-post.txt to post manually.");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
