# PayRecon Daily Avatar Video Pipeline

Daily automated pipeline: research a topic → write a script → render it as a
HeyGen avatar video → upload to YouTube. Also generates a companion LinkedIn
post from the same research (optional auto-post, or copy/paste manually).

```
pickTopic → research (Claude + web search) → generateScript / generateLinkedInPost
          → renderAvatarVideo (HeyGen)      → uploadToYouTube
                                             → postToLinkedIn (optional)
```

Same shape as your SEO article pipeline: Node.js + GitHub Actions, deterministic
day-of-year topic rotation, credentials as GitHub Secrets.

## 1. Install

```bash
npm install
cp .env.example .env
```

## 2. Get your credentials

**Anthropic** — you already have this for the SEO pipeline; reuse the same key.

**HeyGen**
1. Sign up / log in at heygen.com, go to Settings → API to get `HEYGEN_API_KEY`.
2. Call `GET https://api.heygen.com/v2/avatars` (with your API key in the
   `X-Api-Key` header) to list your avatars and find your `avatar_id`.
3. Call `GET https://api.heygen.com/v2/voices` to find a `voice_id` — pick one
   that matches your avatar's language/accent.
4. Note: free/lower HeyGen plans cap resolution and daily credits — check your
   plan covers 720p+ vertical video at daily volume before going live.

**YouTube (Data API v3)**
1. In [Google Cloud Console](https://console.cloud.google.com), create a
   project, enable the "YouTube Data API v3".
2. Create OAuth 2.0 credentials (type: Desktop app) → gives you
   `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`.
3. Run through the OAuth consent flow **once** for the channel you're
   publishing to, requesting **both** of these scopes (captions need a
   broader scope than just uploading):
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.force-ssl`

   The simplest way is Google's [OAuth Playground](https://developers.google.com/oauthplayground):
   set your own client ID/secret in its settings, authorize both scopes above,
   exchange for tokens, and copy the **refresh token** — that's
   `YOUTUBE_REFRESH_TOKEN`. It doesn't expire unless revoked.
   
   If you already generated a refresh token before adding captions support,
   you'll need to redo this step with the extra scope included — the old
   token won't have permission to upload captions and that step will fail
   (non-fatally — the video itself still uploads fine either way).
4. Your app will be in "Testing" mode in Google's console at first, which
   works fine for your own channel; publishing to other people's channels
   would need Google's verification review.

**LinkedIn (optional)**
1. Create an app at [LinkedIn Developers](https://www.linkedin.com/developers/apps),
   request the "Share on LinkedIn" product.
2. Run the OAuth flow to get an access token and your author URN
   (`urn:li:person:...` for your personal profile, or
   `urn:li:organization:...` for a Company Page).
3. **Caveat:** LinkedIn tokens expire roughly every 60 days and refreshing
   them programmatically needs a LinkedIn product approval most solo devs
   won't have. Practically: re-run the OAuth flow every couple of months and
   update the GitHub secret. If you'd rather skip this hassle, leave
   `LINKEDIN_ACCESS_TOKEN` unset — the pipeline still writes the post text to
   `output/<date>/linkedin-post.txt` for you to paste in manually.

## 3. Test locally before automating

```bash
# Cheap test: just generates script + LinkedIn post text, no render/upload
DRY_RUN=true npm start

# Full run including HeyGen render + YouTube upload (uses credits/quota)
npm start
```

Videos upload as **private** by default (`YOUTUBE_PUBLISH_STATUS=private`) so
you can review in YouTube Studio before anyone sees them. Once you trust the
output quality, flip it to `public` in the workflow file.

## 4. Automate with GitHub Actions

1. Push this repo to GitHub.
2. Add each variable from `.env.example` as a repository secret
   (Settings → Secrets and variables → Actions).
3. The workflow (`.github/workflows/daily-video.yml`) runs daily at 9 AM SGT.
   Trigger it manually first via the "Run workflow" button to confirm it works
   end to end before trusting the schedule.

## Notes / things worth deciding before going fully public

- **Review cadence**: even with everything automated, spot-checking the first
  2-3 weeks of videos before flipping to `public` is worth the 5 minutes —
  avatar lip-sync and phrasing quality vary by script.
- **Rate limits / cost**: HeyGen charges per rendered minute; YouTube's daily
  upload quota is generous for 1 video/day but check your Google Cloud
  quota if you ever batch-upload.
- **Distinct topics**: `pickTopic.js` uses the same day-of-year modulo pattern
  as your SEO pipeline. If you want the video topic to never match the same
  day's blog topic, offset the index (e.g. `dayOfYear + 7`).
- **LinkedIn video**: this version posts LinkedIn as text only. Native video
  upload to LinkedIn is possible via their Video API but needs additional
  product approval — worth adding later if text-only underperforms.
