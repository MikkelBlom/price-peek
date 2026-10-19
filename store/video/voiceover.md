# Price Peek promo video: voice-over script

About 30 seconds, about 75 words. Timecodes match `price-peek-promo.mp4` (scene changes are fixed, so read each line inside its window; a little air at the end of a window is fine).

Tone: warm, upbeat, a little playful, never shouty. Think "friend showing you a neat trick", not "TV ad". Medium pace (about 150 words per minute).

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 – 0:03 | Price chips pop up: ₩1,500,000, $249, 19,99 €, ¥42,800, £219, ฿8,490 | Shopping from Seoul, New York or Tokyo? |
| 0:03 – 0:07 | Dark badges land on each price with the amount in kroner | Price Peek shows every price in your own currency, right on the price. |
| 0:07 – 0:13 | 3억 5,000만원, 3万円 and 19,99 € get their badges | It reads prices the local way, too: Korean won, Japanese yen, European commas. |
| 0:13 – 0:19.5 | The popup: pick Euro, the badge switches to €241 | Think in euros instead? Pick from eleven currencies in one click. |
| 0:19.5 – 0:25.5 | Typing 500000 and 1200 into a price filter; the badge updates per keystroke | Typing a budget or a price filter? You see what it means as you type. |
| 0:25.5 – 0:30 | End card: icon, Price Peek, "Any price, in your currency." | Price Peek. Any price, in your currency. |

## Plain text (paste into the voice tool)

```
Shopping from Seoul, New York or Tokyo?
Price Peek shows every price in your own currency, right on the price.
It reads prices the local way, too: Korean won, Japanese yen, European commas.
Think in euros instead? Pick from eleven currencies in one click.
Typing a budget or a price filter? You see what it means as you type.
Price Peek. Any price, in your currency.
```

## Making the voice

Recommended: **ElevenLabs** (elevenlabs.io). The best-sounding English voices right now, and the free tier (about 10 minutes of audio a month, needs an account) is enough for this script. On the free plan ElevenLabs asks for attribution and limits commercial use, so for a store video either credit them in the YouTube description or use the cheapest paid plan, which includes a commercial licence. Check their current terms before publishing.

Good free alternatives:
- **Microsoft Edge "Read aloud"** or the `edge-tts` Python package: natural neural voices (try `en-US-AndrewNeural` or `en-GB-SoniaNeural`), no account. Licensing for commercial use is unclear.
- **Your own voice** recorded on a phone in a quiet room often beats synthetic voices for a small product video.

Generate each line as its own clip if the tool allows it, so you can place them at the timecodes above.

## Adding it to the video

Save the voice as `store/video/voiceover.mp3` (one file, lined up to start at 0:00), then from the repo root:

```bash
ffmpeg -i store/video/price-peek-promo.mp4 -i store/video/voiceover.mp3 -filter_complex "[0:a]volume=0.6[sfx];[1:a]volume=1.0[vo];[sfx][vo]amix=inputs=2:duration=first:normalize=0[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k store/video/price-peek-promo-vo.mp4
```

The video's own track has only quiet pops and key clicks, so it works under a voice or on its own.
