# Publishing to the Chrome Web Store

Step-by-step for putting this extension on the Chrome Web Store. Field names match the developer dashboard as of late 2026; Google moves things around now and then, so expect small differences.

## 1. Before you start

- **Name.** Set the final name in `extension/manifest.json` (`"name"`, max 75 characters). The store listing uses it.
- **Version.** Bump `"version"` in the manifest for every upload. The store rejects a version it has already seen.
- **Google account.** Use the account you want as the publisher. It needs 2-step verification turned on.

## 2. Register as a developer (once)

1. Go to the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole).
2. Accept the developer agreement and pay the one-time **$5** registration fee.
3. Fill in the publisher name shown on the listing, and verify the contact email.

## 3. Build the ZIP

The ZIP must have `manifest.json` at its root, so zip the *contents* of the `extension` folder, not the folder itself. From the repo root in PowerShell:

```powershell
Compress-Archive -Path extension\* -DestinationPath price-peek.zip -Force
```

## 4. Upload

In the dashboard: **Items** → **New item** → upload the ZIP. The item opens on its draft page with these tabs to fill in.

### Store listing

| Field | What to put |
|---|---|
| Description | What it does, which currencies, that it never changes page text. The README's "What it detects" section works as a base. |
| Category | Tools (or Shopping) |
| Language | English (add Danish later if you like) |
| Store icon | `extension/icons/icon128.png` |
| Screenshots | Upload `store/screenshot-1.png` … `screenshot-4.png` (1280×800), in that order. |
| Small promo tile | `store/promo-tile.png` (440×280). |
| Marquee promo tile | `store/marquee.png` (1400×560). |
| Global promo video | A YouTube link to `store/video/price-peek-promo.mp4`, see *Promo video* below. |

### Privacy

| Field | What to put |
|---|---|
| Single purpose | "Shows the converted value of prices found on web pages in the user's chosen currency." |
| `storage` justification | "Saves the user's settings and the cached exchange rates." |
| `activeTab` justification | "Reads the current tab's address so the popup can turn the extension off for that site." |
| Host permission justification | "Runs on all pages because prices can appear on any site. Fetches exchange rates from api.frankfurter.dev and open.er-api.com." |
| Remote code | No. All code ships in the package. |
| Data usage | Tick nothing. The extension collects no user data; only settings stay in local storage. Then tick the three certifications. |
| Privacy policy URL | Only required when collecting user data. If the form asks anyway, link to a short "Privacy" section in the GitHub README saying no data is collected. |

### Distribution

- **Visibility:** *Public* (anyone can find it), *Unlisted* (only people with the link) or *Private* (only listed testers). Unlisted is a good middle ground for a personal tool.
- **Regions:** all, unless you want otherwise.

## 5. Submit for review

Click **Submit for review**. Extensions that run on all sites get an in-depth review, which usually takes from a day to a week or two. You get an email when it's approved or rejected; rejections name the policy and the fix.

## 6. Updating later

1. Bump `"version"` in the manifest.
2. Rebuild the ZIP (step 3).
3. Dashboard → the item → **Package** → **Upload new package** → **Submit for review**.

Installed copies update automatically within a few hours of approval.

## Common rejection reasons for this kind of extension

- Permission justifications that are vague or missing.
- Screenshots that don't show the extension doing its job.
- A description that oversells or lists keywords instead of describing the extension.

## Regenerating the store images

The images in `store/` are drawn by `store/promo.html`. Serve the repo root (`python -m http.server 8765`) and export each frame with headless Chrome, where `#f1`–`#f4` are the screenshots and `#f5` is the promo tile:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --hide-scrollbars --window-size=1280,800 --screenshot=store\screenshot-1.png "http://localhost:8765/store/promo.html#f1"
```

Use `--window-size=440,280` for `#f5`.

## Promo video

`store/video/price-peek-promo.mp4` (1920×1080, 60 fps, 30 s) is drawn by `store/video/promo-video.html` (open it in Chrome to watch it live; space pauses, click scrubs) and recorded with:

```bash
node store/video/record.js
```

It steps the page in headless Chrome, averages 6 sub-frames per output frame for real motion blur and pipes them to ffmpeg. The soundtrack (AI music, sound effects, ElevenLabs voice-over) is built separately from `store/video/sound/` (cue sheet, voice lines, music plan) with the tools in `~/.promo-audio`, and muxed in with ffmpeg; see `store/video/sound-plan.md`. `--stills 2,10,16` writes single PNG frames instead, and `--audio file.mp3` muxes a finished soundtrack in. The voice-over script, music advice and the mix command are in `store/video/voiceover.md`.

The store's video field takes a YouTube link only:

1. Upload the MP4 on YouTube (studio.youtube.com → **Create** → **Upload videos**).
2. Title "Price Peek – any price, in your currency", visibility **Unlisted**, "No, it's not made for kids".
3. Copy the video link and paste it into the store listing's **Global promo video** field.
