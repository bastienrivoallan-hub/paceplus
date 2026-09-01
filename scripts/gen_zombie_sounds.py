"""Generate royalty-free procedural sound effects for the Zombie Run mode."""
import numpy as np
import wave
import os

SR = 22050
OUT = "/app/frontend/assets/audio"
os.makedirs(OUT, exist_ok=True)


def save(name, sig):
    sig = np.clip(sig, -1, 1)
    data = (sig * 32767 * 0.9).astype(np.int16)
    with wave.open(f"{OUT}/{name}.wav", "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(name, len(sig) / SR, "s", os.path.getsize(f"{OUT}/{name}.wav") // 1024, "KB")


def t(dur):
    return np.linspace(0, dur, int(SR * dur), endpoint=False)


def env(sig, a=0.02, r=0.1):
    n = len(sig)
    e = np.ones(n)
    na, nr = int(SR * a), int(SR * r)
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] = np.linspace(1, 0, nr)
    return sig * e


rng = np.random.default_rng(42)

# --- 1. sprint_alert: radio static + urgent beeps (zombies detected) ---
dur = 2.6
x = t(dur)
static = rng.normal(0, 0.25, len(x))
# band-limit the static with a simple moving average
static = np.convolve(static, np.ones(6) / 6, mode="same")
gate = (np.sin(2 * np.pi * 7 * x) > 0.3).astype(float)
sig = static * gate * 0.5
for i, f in enumerate([880, 880, 1180]):
    s0 = int(SR * (0.5 + i * 0.55))
    beep = 0.55 * np.sin(2 * np.pi * f * t(0.28))
    beep = env(beep, 0.01, 0.05)
    sig[s0:s0 + len(beep)] += beep
save("sprint_alert", env(sig, 0.01, 0.2))

# --- 2. zombie_growl: distant low growl ---
dur = 2.0
x = t(dur)
f0 = 70 + 25 * np.sin(2 * np.pi * 1.3 * x) + 10 * np.sin(2 * np.pi * 4.7 * x)
phase = 2 * np.pi * np.cumsum(f0) / SR
saw = 2 * ((phase / (2 * np.pi)) % 1) - 1
noise = np.convolve(rng.normal(0, 0.3, len(x)), np.ones(20) / 20, mode="same")
growl = 0.6 * saw * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * x)) + noise
amp = 0.4 + 0.6 * np.sin(np.pi * x / dur)
save("zombie_growl", env(growl * amp * 0.6, 0.15, 0.4))

# --- 3. zombie_close: aggressive layered snarl ---
dur = 2.4
x = t(dur)
f0 = 95 + 40 * np.sin(2 * np.pi * 2.1 * x) + 20 * np.sin(2 * np.pi * 11 * x)
phase = 2 * np.pi * np.cumsum(f0) / SR
saw = 2 * ((phase / (2 * np.pi)) % 1) - 1
sq = np.sign(np.sin(phase * 0.5))
noise = np.convolve(rng.normal(0, 0.5, len(x)), np.ones(8) / 8, mode="same")
snarl_gate = (np.sin(2 * np.pi * 3.5 * x + 1) > -0.4).astype(float)
sig = (0.5 * saw + 0.25 * sq + 0.5 * noise * snarl_gate) * (0.7 + 0.3 * np.sin(2 * np.pi * 6 * x))
save("zombie_close", env(sig * 0.65, 0.05, 0.25))

# --- 4. safe_zone: calm major arpeggio chime ---
dur = 2.2
sig = np.zeros(int(SR * dur))
for i, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
    s0 = int(SR * i * 0.28)
    tone = np.sin(2 * np.pi * f * t(1.1)) * np.exp(-3 * t(1.1))
    tone += 0.3 * np.sin(2 * np.pi * f * 2 * t(1.1)) * np.exp(-5 * t(1.1))
    sig[s0:s0 + len(tone)] += tone * 0.4
save("safe_zone", env(sig, 0.01, 0.3))

# --- 5. recovery_breath: two calm breath cycles ---
dur = 3.2
x = t(dur)
noise = np.convolve(rng.normal(0, 0.5, len(x)), np.ones(40) / 40, mode="same")
breath = np.abs(np.sin(2 * np.pi * 0.625 * x)) ** 1.5
save("recovery_breath", env(noise * breath * 0.8, 0.1, 0.3))

# --- 6. run_complete: victory fanfare ---
dur = 2.4
sig = np.zeros(int(SR * dur))
for i, f in enumerate([523.25, 659.25, 783.99]):
    s0 = int(SR * i * 0.18)
    tone = np.sin(2 * np.pi * f * t(0.5)) * np.exp(-2.5 * t(0.5))
    sig[s0:s0 + len(tone)] += tone * 0.45
big = np.sin(2 * np.pi * 1046.5 * t(1.3)) * np.exp(-1.8 * t(1.3))
big += 0.4 * np.sin(2 * np.pi * 1318.5 * t(1.3)) * np.exp(-2.2 * t(1.3))
s0 = int(SR * 0.54)
sig[s0:s0 + len(big)] += big * 0.5
save("run_complete", env(sig, 0.01, 0.3))
