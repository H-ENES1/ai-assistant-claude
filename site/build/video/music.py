# Videoların müziği: tamamen kodla sentezlenir (örnek ses, hazır döngü ya da telifli malzeme yok).
#   pip install numpy
#   python site/build/video/music.py <saniye> <çıktı.wav>
# La minör, 100 vuruş/dk, Am – F – C – G döngüsü: yumuşak ped + piksel bota yakışan kısa "bip" arpej + hafif bas ve vuruş.
# Aynı süre her zaman aynı dosyayı üretir (rastlantı tohumu sabit).
import sys
import wave
import numpy as np

SR = 44100
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


CHORDS = [  # (bas notası, akor notaları) MIDI
    (45, [57, 60, 64, 67]),  # Am7
    (41, [57, 60, 65, 69]),  # Fmaj7
    (48, [55, 60, 64, 67]),  # C
    (43, [55, 59, 62, 67]),  # G
]
ARP = [0, 2, 1, 3, 2, 3, 1, 2]  # sekizlik notalar, akorun kaçıncı sesi (bir oktav yukarıda çalınır)


def add(buf, start, sig, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= buf.shape[0]:
        return
    sig = sig[: buf.shape[0] - i]
    buf[i:i + len(sig), 0] += sig * gain * (1 - max(0.0, pan))
    buf[i:i + len(sig), 1] += sig * gain * (1 + min(0.0, pan))


def env(n, a, r):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na) ** 1.5
    e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


def pad(f, dur):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t + 0.3) + 0.5 * np.sin(2 * np.pi * f * 1.004 * t)
    return s * env(len(t), 0.5, 0.7)


def blip(f, dur=0.34):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f * t) + 0.33 * np.sin(2 * np.pi * 3 * f * t) + 0.12 * np.sin(2 * np.pi * 5 * f * t)
    return s * np.exp(-t * 11) * env(len(t), 0.004, 0.03)


def bass(f, dur):
    t = np.arange(int(dur * SR)) / SR
    tri = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * t))
    return (tri + 0.4 * np.sin(2 * np.pi * f * t)) * np.exp(-t * 3.2) * env(len(t), 0.006, 0.05)


def kick():
    t = np.arange(int(0.22 * SR)) / SR
    f = 45 + 90 * np.exp(-t * 38)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 16)


def hat(rng):
    n = int(0.045 * SR)
    x = rng.standard_normal(n)
    x = np.diff(x, prepend=0.0)  # kaba yüksek geçiren
    return x * np.exp(-np.arange(n) / SR * 90)


def make(dur):
    rng = np.random.default_rng(13)
    n = int(dur * SR)
    buf = np.zeros((n, 2))
    bars = int(np.ceil(dur / BAR)) + 1
    last = max(0, int((dur - 2.6) / BAR))  # son ölçü: akor çınlar, vuruş susar
    for b in range(bars):
        t0 = b * BAR
        root, notes = CHORDS[b % 4] if b < last else CHORDS[0]
        ending = b >= last
        for k, m in enumerate(notes):
            add(buf, t0, pad(hz(m), BAR + 0.6 if not ending else 3.2), pan=(-0.4, 0.4, -0.2, 0.2)[k], gain=0.055)
        if ending:
            if b == last:
                add(buf, t0, bass(hz(root), 2.4), gain=0.3)
                for k, m in enumerate([69, 72, 76, 81]):
                    add(buf, t0 + k * 0.11, blip(hz(m), 0.9), pan=(-0.5, 0.5)[k % 2], gain=0.11)
            continue
        for k, step in enumerate(ARP):
            if b == 0 and k < 2:
                continue
            m = notes[step] + 12
            add(buf, t0 + k * BEAT / 2, blip(hz(m)), pan=(-0.55, 0.55)[k % 2], gain=0.12 if k % 2 == 0 else 0.085)
            add(buf, t0 + k * BEAT / 2 + 0.225, blip(hz(m)), pan=(0.55, -0.55)[k % 2], gain=0.03)  # yankı
        if b >= 1:
            add(buf, t0, bass(hz(root), BEAT * 1.4), gain=0.3)
            add(buf, t0 + 2.5 * BEAT, bass(hz(root), BEAT), gain=0.22)
        if b >= 2:
            for q in (0, 2):
                add(buf, t0 + q * BEAT, kick(), gain=0.42)
            for q in range(4):
                add(buf, t0 + (q + 0.5) * BEAT, hat(rng), pan=0.25, gain=0.035)
    buf = np.tanh(buf * 1.4)
    buf *= 0.8 / np.max(np.abs(buf))
    fi, fo = int(0.25 * SR), int(min(2.2, dur / 3) * SR)
    buf[:fi] *= np.linspace(0, 1, fi)[:, None]
    buf[-fo:] *= (np.linspace(1, 0, fo) ** 1.6)[:, None]
    return buf


if __name__ == '__main__':
    dur, out = float(sys.argv[1]), sys.argv[2]
    pcm = (make(dur) * 32767).astype('<i2')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print('ok', out, f'{dur:g} sn')
