// ─────────────────────────────────────────────────────────────
// UNO FRENZY — Web Audio arcade sound engine (fully synthesized,
// zero external assets). Singleton `sound` is safe to import on
// the server — the AudioContext is only created on first play().
// ─────────────────────────────────────────────────────────────
import { SoundName } from './types'

class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false

  setMuted(m: boolean): void {
    this.muted = m
  }

  private ensure(): boolean {
    if (typeof window === 'undefined') return false
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return false
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.28
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return true
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    dur: number,
    type: OscillatorType = 'square',
    vol = 1,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return
    const t0 = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(30, freqStart), t0)
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur)
    }
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.03)
  }

  private noise(dur: number, vol = 0.6, delay = 0, cutoff = 1200): void {
    if (!this.ctx || !this.master) return
    const t0 = this.ctx.currentTime + delay
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * dur))
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    const gain = this.ctx.createGain()
    gain.gain.value = vol
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start(t0)
  }

  private seq(
    notes: Array<[freq: number, dur: number]>,
    type: OscillatorType = 'square',
    vol = 1,
    gap = 0,
  ): void {
    let d = 0
    for (const [freq, dur] of notes) {
      this.tone(freq, freq, dur, type, vol, d)
      d += dur + gap
    }
  }

  play(name: SoundName): void {
    if (this.muted) return
    if (!this.ensure()) return
    switch (name) {
      case 'card':
        this.tone(320, 520, 0.07)
        break
      case 'draw':
        this.tone(260, 170, 0.09)
        break
      case 'click':
        this.tone(400, 400, 0.035, 'square', 0.6)
        break
      case 'skip':
        this.tone(560, 560, 0.05)
        this.tone(380, 380, 0.06, 'square', 1, 0.06)
        break
      case 'reverse':
        this.tone(220, 700, 0.16, 'sawtooth', 0.8)
        break
      case 'penalty':
        this.tone(170, 70, 0.22, 'sawtooth', 0.9)
        this.noise(0.12, 0.3, 0.02)
        break
      case 'shield':
        this.tone(880, 880, 0.09, 'triangle')
        this.tone(1320, 1320, 0.16, 'triangle', 0.8, 0.07)
        break
      case 'swap':
        this.tone(420, 760, 0.07)
        this.tone(760, 420, 0.07, 'square', 1, 0.09)
        break
      case 'wildfire':
        this.noise(0.28, 0.7, 0, 900)
        this.tone(200, 90, 0.25, 'sawtooth', 0.5)
        break
      case 'battle':
        this.seq([[523, 0.08], [659, 0.08], [784, 0.08], [1046, 0.14]])
        break
      case 'mash':
        this.tone(760, 900, 0.025, 'square', 0.5)
        break
      case 'tick':
        this.tone(1000, 1000, 0.02, 'square', 0.4)
        break
      case 'countdown':
        this.tone(880, 880, 0.07, 'square', 0.8)
        break
      case 'go':
        this.tone(1320, 1320, 0.16, 'square', 1)
        break
      case 'chaos':
        for (let i = 0; i < 4; i++) {
          this.tone(i % 2 ? 620 : 880, i % 2 ? 620 : 880, 0.1, 'square', 0.9, i * 0.11)
        }
        this.noise(0.3, 0.4, 0.1)
        break
      case 'uno':
        this.seq([[784, 0.07], [988, 0.07], [1175, 0.12]])
        break
      case 'win':
        this.seq([[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.16], [1318, 0.22]])
        break
      case 'lose':
        this.seq([[440, 0.12], [370, 0.12], [311, 0.12], [233, 0.24]], 'sawtooth', 0.8)
        break
    }
  }
}

export const sound = new SoundEngine()
