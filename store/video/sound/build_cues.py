"""Price Peek promo: build cues.json from the video's event timeline (store/video/promo-video.html).

    uv run --project ~/.promo-audio/tools python build_cues.py <music.wav> [music_offset_s] > cues.json

Times are the animation's own timestamps. Pan follows on-screen x: (x/1280*2-1)*0.5.
The badge pops climb an F-major pentatonic; the source pop sits at G#6, so offsets are relative to it.
"""
import glob
import json
import sys
from pathlib import Path

LIB = Path.home() / ".promo-audio" / "libs"
GEN = Path(__file__).parent / "gen"


def lib(name):
    hits = glob.glob(str(LIB / "**" / name), recursive=True)
    if not hits:
        raise SystemExit(f"missing library file: {name}")
    return hits[0]


def g(name):
    return str(GEN / name)


def pan_x(x):
    return round((x / 1280 * 2 - 1) * 0.5, 3)


POP = lib("Interface Pop High Short.wav")
SWEEP = lib("Woosh Sweep Slide Infographics Basic.wav")
CARD = lib("PAPRHndl_Game Play Cards Dry Show Flip Toss Disgard Near 12_ESM_BG.wav")
BOOM = lib("EffectiveTrailer_Booms_Vol2_214.wav")
KALIMBA = lib("UIMisc_Kalimba 3 Up_CB Sounddesign_APPlicable Sounds.wav")
CLICK = str(LIB / "kenney-ui" / "Audio" / "mouseclick1.ogg")
TICK = str(LIB / "kenney-ui" / "Audio" / "click4.ogg")

# F-major pentatonic relative to the pop's G#6: C6 D6 F6 G6 A6 C7 D7
SCALE = {"C6": -8, "D6": -6, "F6": -3, "G6": -1, "A6": 1, "C7": 4, "D7": 6}

music = sys.argv[1]
music_offset = 0.0
vo_dir = Path(sys.argv[sys.argv.index("--vo") + 1]) if "--vo" in sys.argv else None
cues = []


def add(**c):
    cues.append(c)


# 0 · music bed, ducked into near-silence before the hero hit
add(t=music_offset, file=music, bus="music", gain_db=0, align="start", fade_out=1.5)

# A · Seoul digits roll in during the close-up: tiny ticks, one per character (7 glyphs)
for i in range(7):
    add(t=0.15 + i * 0.045 + 0.06, file=TICK, bus="ui", gain_db=-30, pitch=i * 0.5, hpf=1500, pan=0.1)
# pull-back reveal
add(t=1.7, file=g("whoosh_deep_s1002.wav"), bus="fx", gain_db=-16, align="peak", hpf=90, stretch_to=1.5)
# chips fly in (New York, Berlin, Tokyo, London, Bangkok): soft swish-pops, panned by chip x
chip_x = [1130, 750, 1100, 740, 1120]
for i, (t, x) in enumerate(zip([1.1, 1.25, 1.4, 1.55, 1.7], chip_x)):
    add(t=t + 0.12, file=SWEEP, bus="fx", gain_db=-26, align="peak", pitch=[2, -1, 1, -2, 0][i], hpf=300, pan=pan_x(x))

# B · signature: badges land on the six chips on quarter beats, climbing the scale
badge_x = [900, 1150, 780, 1120, 760, 1140]
for i, (note, x) in enumerate(zip(["C6", "D6", "F6", "G6", "A6", "C7"], badge_x)):
    add(t=3.5 + i * 0.25, file=POP, bus="ui", gain_db=-13, pitch=SCALE[note], hpf=250, pan=pan_x(x))

# whip-pan right
add(t=7.0, file=SWEEP, bus="fx", gain_db=-14, align="peak", pitch=-3, hpf=120, stretch_to=0.45, pan=0.15)
add(t=7.0, file=g("swish_whip_s1002.wav"), bus="fx", gain_db=-22, align="peak", hpf=200)

# C · reel: badges land on each item; the camera steps down between them
for t, note in [(7.75, "F6"), (9.75, "A6"), (11.75, "C7"), (13.75, "D7")]:
    add(t=t, file=POP, bus="ui", gain_db=-14, pitch=SCALE[note], hpf=250, pan=0.25)
for t, p in [(9.3, 0), (11.3, -1), (13.3, 1)]:
    add(t=t, file=SWEEP, bus="fx", gain_db=-24, align="peak", pitch=p - 4, hpf=150)

# D · popup swings in from the right, cursor clicks, highlight glides, badge flips
add(t=13.9, file=g("whoosh_short_s1003.wav"), bus="fx", gain_db=-22, align="peak", hpf=150, pan=0.35)
add(t=14.35, file=g("thud_soft_s1002.wav"), bus="ui", gain_db=-24, hpf=120, pan=0.35)
add(t=15.1, file=CLICK, bus="ui", gain_db=-16, pan=0.4)
add(t=15.14, file=TICK, bus="ui", gain_db=-26, pitch=3, hpf=1500, pan=0.4)
add(t=15.72, file=TICK, bus="ui", gain_db=-28, pitch=5, hpf=1500, pan=0.4)
add(t=16.3, file=CLICK, bus="ui", gain_db=-16, pan=0.4)
add(t=16.4, file=CARD, bus="ui", gain_db=-18, hpf=400, pan=-0.3)

# dolly through the popup
add(t=19.4, file=g("whoosh_deep_s1004.wav"), bus="fx", gain_db=-15, align="peak", hpf=80)

# E · typing: round-robin key presses with small pitch/gain variation
keys = sorted(glob.glob(g("key_press_s*.wav")))
for i in range(6):
    add(t=20.45 + i * 0.2, file=keys[i % len(keys)], bus="ui", gain_db=-20 + [0, -1, .5, -1.5, 0, -.5][i],
        pitch=[0, .3, -.2, .4, -.3, .1][i], hpf=300, pan=0.2)
for i in range(4):
    add(t=22.3 + i * 0.22, file=keys[(i + 3) % len(keys)], bus="ui", gain_db=-20 + [-.5, 0, -1, .5][i],
        pitch=[.2, -.3, .1, -.1][i], hpf=300, pan=0.2)
add(t=20.45, file=POP, bus="ui", gain_db=-15, pitch=SCALE["F6"], hpf=250, pan=0.25)
add(t=22.3, file=POP, bus="ui", gain_db=-15, pitch=SCALE["A6"], hpf=250, pan=0.25)

# the build: riser and rush both end exactly on the hit
add(t=25.5, file=g("riser_s1001.wav"), bus="fx", gain_db=-17, align="end", hpf=150)
add(t=25.5, file=g("zoom_rush_s1000.wav"), bus="fx", gain_db=-16, align="end", hpf=100)
# hero hit: sub boom + trailer boom, trimmed
add(t=25.5, file=g("impact_s1005.wav"), bus="hit", gain_db=-8)
add(t=25.5, file=BOOM, bus="hit", gain_db=-12, trim=[0, 3.2], fade_out=1.2)
# sonic logo as the logo springs in
add(t=25.7, file=KALIMBA, bus="logo", gain_db=-10)
add(t=25.7, file=KALIMBA, bus="logo", gain_db=-20, pitch=12, offset=0.11)

# voice-over: one clip per line at its timecode; the music ducks under each line
duck = [{"bus": "music", "start": 24.9, "end": 25.48, "db": -20, "ramp": 0.45},
        {"bus": "music", "start": 25.51, "end": 30, "db": -5, "ramp": 0.3}]
if vo_dir:
    lines = json.loads((Path(__file__).parent / "vo-lines.json").read_text(encoding="utf-8"))["lines"]
    import librosa
    for ln in lines:
        f = vo_dir / f"{ln['id']}.wav"
        add(t=ln["t"] - 0.05, file=str(f), bus="vo", gain_db=0, align="start", hpf=80, fade_in=0.005, fade_out=0.03)
        end = ln["t"] + librosa.get_duration(path=str(f))
        if ln["t"] < 24:
            duck.append({"bus": "music", "start": ln["t"] - 0.05, "end": end, "db": -8, "ramp": 0.25})

spec = {
    "duration": 30, "sr": 48000,
    "master": {"lufs": -14, "true_peak": -1.5},
    "buses": {"fx": {"reverb": 0.12, "decay": 0.6}, "ui": {"reverb": 0.05, "decay": 0.4},
              "logo": {"reverb": 0.35, "decay": 2.2}, "hit": {"reverb": 0.1, "decay": 1.2}},
    "cues": cues,
    "bus_lufs": {"music": -19, "vo": -15},
    "duck": duck,
}
print(json.dumps(spec, indent=1))
