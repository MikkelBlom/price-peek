# Price Peek promo: sound plan

The cue sheet is timed to `promo-video.html` (seconds), and the music is planned at 120 BPM (one bar = 2 s). The craft rules behind it are in `~/.claude/skills/promo-sound-design/references/craft-research.md`.

## Music arc

| Time | Bars | Music |
|---|---|---|
| 0–3 | 1–1.5 | Sparse intro: a plucky synth motif, no drums. The hook question sits on it. |
| 3–13 | 2–7 | Build: drums enter on the badge cascade (3.5), steady groove through the reel. |
| 13–24 | 7–12 | Fullest section: the popup, cursor, dolly and typing. |
| 24.15–25.35 | 13 | Pull back to near-silence while the camera dives into the badge. |
| 25.35 | 13.7 | **Hero hit** as the dark fill takes the screen. |
| 25.5–30 | 13.7–15 | Resolve: a final chord, then the sonic logo rings out to the end. |

## Cue sheet

Pan follows the on-screen x position (`(x/1280*2-1)*0.5`); the logo and centre events stay centred.

| t (s) | Visual event | Sound | Layer | Notes |
|---|---|---|---|---|
| 0.15–0.5 | ₩1,500,000 digits rise in the close-up | 7 very soft ticks, one per character | UI | Quiet, almost texture |
| 0.95–2.45 | Camera pull-back | Airy medium whoosh, peak about 1.7 | Transition | The longest soft whoosh |
| 1.1–1.7 | 5 chips fly in on springs | Soft swish-pops, panned by chip x | UI | Round-robin variants, −4 dB under the badges |
| 3.5, 3.75, 4.0, 4.25, 4.5, 4.75 | Badges land on the six chips | **Signature pop**, rising pentatonic in the music's key | UI | The sound people remember; pan by chip x |
| 6.7–7.3 | Whip-pan right | Fast swish, peak about 7.0 | Transition | Short variant |
| 7.75, 9.75, 11.75, 13.75 | Badges land on the reel items | Signature pop (repeat notes 1, 3, 5, 6) | UI | Same family as the cascade |
| 9.0, 11.0, 13.0 | Reel steps down | Very short soft whoosh (3 variants) | Transition | Low, −6 dB |
| 13.55–14.5 | Popup swings in (3D) | Soft whoosh plus a light thud on settle | Transition / UI | |
| 15.1 | Click opens the dropdown | Mouse click plus a short menu "open" tick | UI | Dry |
| 15.65 | Highlight glides to EUR | Tiny tick | UI | |
| 16.3 | Click EUR | Mouse click | UI | |
| 16.35–16.85 | Badge flips to €241 | Card-flip "flick" | UI | |
| 19.0–19.75 | Dolly through the popup | Deep airy whoosh, swelling | Transition | |
| 20.45–21.45 | 6 keystrokes (500000) | Keyboard keys, round-robin | UI | Real keyboard samples, ±40 cents |
| 20.45 | First badge appears | Signature pop | UI | Value rolls silently after that |
| 22.3–22.96 | 4 keystrokes (1200) | Keyboard keys | UI | |
| 22.6–25.35 | (build) | Riser ending exactly at 25.35 | Riser | About 1.5 bars of pre-roll; the only riser |
| 24.15–25.35 | Zoom into the badge | Accelerating whoosh into the hit | Transition | |
| 25.35 | Dark fill takes the screen | **Impact / sub drop** | Impact | The only sub content in the piece |
| 25.5 | Logo springs in | **Sonic logo**: 2–3 note pluck or chime in key, about 3 s ring-out | Logo | Centre |
| 25.8–27 | Name and tagline rise | Nothing (let the logo ring) | | |
| 0–30 | | Room tone or air bed | Ambience | Optional, −30 dBFS, low-passed at 8 kHz |

Totals: about 32 UI events (many are quiet ticks and keys), 7 transitions, 1 riser, 1 impact, 1 logo. That's denser than the guide's "about 1 per second", but most are tiny UI ticks; check by ear and cut the chip swishes or reel whooshes first if it feels busy.

## Mix and master

- Music at about −17 LUFS short-term before mastering; SFX 3–6 dB under music peaks; the hero hit may poke out.
- High-pass UI sounds at 200 Hz and whooshes at 100 Hz; only the 25.35 impact keeps sub content.
- A short reverb on the SFX bus (0.5 s, 10 % wet); UI clicks nearly dry.
- When VO arrives: duck the music 8–12 dB on the VO segments with an envelope, dip 3 kHz by 3 dB.
- Master: −14 LUFS integrated, −1.5 dBTP, two-pass `loudnorm` with `linear=true`.
