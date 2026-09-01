"""Generate improved royalty-free Zombie Run sounds (loops + stingers)."""
import numpy as np, wave, os

SR = 22050
OUT = "/app/frontend/assets/audio"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def save(name, sig):
    sig = np.clip(sig, -1, 1)
    with wave.open(f"{OUT}/{name}.wav", "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((sig * 32767 * 0.9).astype(np.int16).tobytes())
    print(name, round(len(sig) / SR, 1), "s", os.path.getsize(f"{OUT}/{name}.wav") // 1024, "KB")


def t(d):
    return np.linspace(0, d, int(SR * d), endpoint=False)


def env(sig, a=0.05, r=0.15):
    n = len(sig); e = np.ones(n)
    na, nr = max(1, int(SR * a)), max(1, int(SR * r))
    e[:na] = np.linspace(0, 1, na); e[-nr:] = np.linspace(1, 0, nr)
    return sig * e


def lp(sig, k):
    return np.convolve(sig, np.ones(k) / k, mode="same")


def moan(f0=110, dur=3.0, breath=0.25):
    """Voice-like zombie moan: harmonic stack, downward glide, vibrato, tremolo."""
    x = t(dur)
    glide = np.linspace(1.18, 0.82, len(x))
    vib = 1 + 0.05 * np.sin(2 * np.pi * 5.2 * x)
    f = f0 * glide * vib
    ph = 2 * np.pi * np.cumsum(f) / SR
    voice = 0.55 * np.sin(ph) + 0.30 * np.sin(2 * ph + 0.3) + 0.18 * np.sin(3 * ph) + 0.08 * np.sin(4.02 * ph)
    voice *= 1 + 0.30 * np.sin(2 * np.pi * 3.1 * x)  # tremolo (throaty)
    br = lp(rng.normal(0, 1, len(x)), 5) * 0.5 * breath
    amp = np.sin(np.pi * np.clip(x / dur, 0, 1)) ** 0.7  # swell in/out
    return env((voice + br) * amp, 0.15, 0.4)


def growl(dur=2.5, f0=68):
    x = t(dur)
    f = f0 * (1 + 0.18 * np.sin(2 * np.pi * 1.7 * x))
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
    gr = saw * (0.65 + 0.35 * np.sin(2 * np.pi * 22 * x))  # 22Hz roughness
    gr += lp(rng.normal(0, 0.6, len(x)), 12)
    return env(gr * 0.5, 0.1, 0.3)


def heartbeat(dur, bpm, vol=0.5):
    sig = np.zeros(int(SR * dur))
    period = 60.0 / bpm
    beat = np.sin(2 * np.pi * 52 * t(0.11)) * np.exp(-28 * t(0.11))
    for i in range(int(dur / period) + 1):
        for off, g in ((0.0, 1.0), (0.16, 0.6)):  # lub-dub
            s0 = int((i * period + off) * SR)
            if s0 + len(beat) < len(sig):
                sig[s0:s0 + len(beat)] += beat * g
    return sig * vol


def mix_at(base, clip, at_s, vol=1.0):
    s0 = int(at_s * SR)
    n = min(len(clip), len(base) - s0)
    if n > 0:
        base[s0:s0 + n] += clip[:n] * vol
    return base


# --- chase_loop (10s, seamless-ish loop): drums + rumble + horde ---
D = 10.0
loop = heartbeat(D, 150, 0.62)
loop += lp(rng.normal(0, 1, int(SR * D)), 60) * 0.16  # rumble
for at, f in ((0.8, 95), (3.6, 120), (6.4, 85)):
    loop = mix_at(loop, moan(f, 2.8, 0.35), at, 0.55)
loop = mix_at(loop, growl(2.2, 62), 5.1, 0.5)
loop = mix_at(loop, growl(1.8, 78), 8.2, 0.45)
n_x = int(SR * 0.35)  # crossfade edges for smooth looping
loop[:n_x] = loop[:n_x] * np.linspace(0.4, 1, n_x) + loop[-n_x:] * np.linspace(0.6, 0, n_x)
save("chase_loop", loop * 0.9)

# --- calm_loop (10s): wind + slow heart + faint distant moan ---
D = 10.0
wind = lp(rng.normal(0, 1, int(SR * D)), 90)
wind *= 0.35 + 0.25 * np.sin(2 * np.pi * 0.12 * t(D) + 1.2)
calm = wind * 0.8 + heartbeat(D, 62, 0.3)
calm = mix_at(calm, moan(90, 3.5, 0.2), 6.2, 0.12)  # very distant
n_x = int(SR * 0.35)
calm[:n_x] = calm[:n_x] * np.linspace(0.4, 1, n_x) + calm[-n_x:] * np.linspace(0.6, 0, n_x)
save("calm_loop", calm)

# --- sprint_alert (3s): radio static + beeps + rising alarm ---
x = t(3.0)
static = lp(rng.normal(0, 0.3, len(x)), 4) * (np.sin(2 * np.pi * 9 * x) > 0.2) * 0.55
sig = static.copy()
for i in range(3):
    b = env(0.5 * np.sin(2 * np.pi * 950 * t(0.16)), 0.01, 0.04)
    sig = mix_at(sig, b, 0.25 + i * 0.3)
sweep_f = np.linspace(420, 980, int(SR * 1.4))
sweep = 0.45 * np.sin(2 * np.pi * np.cumsum(sweep_f) / SR)
sig = mix_at(sig, env(sweep, 0.02, 0.2), 1.4)
save("sprint_alert", env(sig, 0.01, 0.25))

# --- zombie_moan (3.5s): close, aggressive layered moan + growl ---
m = moan(135, 3.5, 0.4) * 0.85 + np.concatenate([growl(3.5, 72) * 0.5])
save("zombie_moan", m)

# --- safe_zone (3s): chime + warm pad ---
sig = np.zeros(int(SR * 3.0))
for i, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
    tone = np.sin(2 * np.pi * f * t(1.3)) * np.exp(-2.6 * t(1.3))
    tone += 0.3 * np.sin(2 * np.pi * f * 2 * t(1.3)) * np.exp(-4 * t(1.3))
    sig = mix_at(sig, tone * 0.35, i * 0.26)
pad = (np.sin(2 * np.pi * 261.6 * t(2.6)) + np.sin(2 * np.pi * 329.6 * t(2.6))) * 0.12
sig = mix_at(sig, env(pad, 0.4, 0.9), 0.3)
save("safe_zone", env(sig, 0.01, 0.4))

# --- run_complete: fanfare (unchanged style) ---
sig = np.zeros(int(SR * 2.4))
for i, f in enumerate([523.25, 659.25, 783.99]):
    sig = mix_at(sig, np.sin(2 * np.pi * f * t(0.5)) * np.exp(-2.5 * t(0.5)) * 0.45, i * 0.18)
big = np.sin(2 * np.pi * 1046.5 * t(1.3)) * np.exp(-1.8 * t(1.3)) + 0.4 * np.sin(2 * np.pi * 1318.5 * t(1.3)) * np.exp(-2.2 * t(1.3))
sig = mix_at(sig, big * 0.5, 0.54)
save("run_complete", env(sig, 0.01, 0.3))

# cleanup old one-shots no longer used
for old in ("zombie_growl", "zombie_close", "recovery_breath"):
    p = f"{OUT}/{old}.wav"
    if os.path.exists(p):
        os.remove(p)
        print("removed", old)
