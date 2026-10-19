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

The rendered video is silent on purpose: synthesized sound effects sounded cheap, and good promo videos are carried by a real music bed plus the voice.

**Music:** pick a track around **120 BPM** (the animation's beats land on a 0.5 s grid: badges pop at 3.5, 3.75, 4.0 … and scene moves start on whole seconds). The YouTube Audio Library (YouTube Studio → Audio library, filter by "Attribution not required") is free for videos posted on YouTube, which is exactly where this one goes. Look for light, bright electronic or indie-pop; avoid anything with vocals.

Save the voice as `store/video/voiceover.mp3` and the music as `store/video/music.mp3` (both lined up to start at 0:00), then from the repo root:

```bash
ffmpeg -i store/video/price-peek-promo.mp4 -i store/video/music.mp3 -i store/video/voiceover.mp3 -filter_complex "[1:a]atrim=0:30,afade=t=out:st=28:d=2,volume=0.35[m];[2:a]volume=1.0[vo];[m][vo]amix=inputs=2:duration=first:normalize=0[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest store/video/price-peek-promo-final.mp4
```

Music at 0.35 sits under the voice; raise it if the voice is quiet.
