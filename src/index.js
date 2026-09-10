import "dotenv/config";
import fs from "fs";
import path from "path";
import { pickTopic } from "./pickTopic.js";
import { research } from "./research.js";
import { generateScript, generateLinkedInPost } from "./generateScript.js";
import { renderAvatarVideo } from "./heygenRender.js";
import { uploadToYouTube } from "./youtubeUpload.js";
import { postToLinkedIn } from "./linkedinPost.js";

const DRY_RUN = process.env.DRY_RUN === "true";

async function main() {
  const topic = pickTopic();
  console.log(`[1/6] Topic: ${topic}`);

  const points = await research(topic);
  console.log(`[2/6] Research points:\n${points.map((p) => `  - ${p}`).join("\n")}`);

  const [script, linkedinPost] = await Promise.all([
    generateScript(topic, points),
    generateLinkedInPost(topic, points),
  ]);
  console.log(`[3/6] Script (${script.split(/\s+/).length} words):\n${script}`);

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
  console.log("[4/6] Rendering avatar video with HeyGen (this can take a few minutes)...");
  await renderAvatarVideo(script, { outputPath: videoPath });
  console.log(`      Saved to ${videoPath}`);

  console.log("[5/6] Uploading to YouTube...");
  const ytResult = await uploadToYouTube({
    filePath: videoPath,
    title: topic.slice(0, 95), // YouTube title limit is 100 chars
    description: `${script}\n\nPayRecon — Warehouse Management System for Singapore e-commerce sellers.`,
    tags: ["ecommerce", "singapore", "shopee", "lazada", "tiktokshop", "wms"],
  });
  console.log(`      Uploaded: https://youtube.com/watch?v=${ytResult.id} (status: ${process.env.YOUTUBE_PUBLISH_STATUS || "private"})`);

  console.log("[6/6] Posting to LinkedIn...");
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
