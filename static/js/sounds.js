/* ============================================
   Sound Engine - Web Audio API
   Synthesized sounds without external files
   ============================================ */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    _ensureCtx() {
        if (!this.ctx) {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) { this.enabled = false; }
        }
        return this.ctx;
    }

    _tone(freq, duration, type = 'sine', vol = 0.15, delay = 0) {
        if (!this.enabled) return;
        const ctx = this._ensureCtx();
        if (!ctx) return;
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
            gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + duration);
        } catch (e) {}
    }

    tick() {
        this._tone(1200, 0.03, 'sine', 0.06);
    }

    chipPlace() {
        this._tone(800, 0.06, 'sine', 0.1);
    }

    win() {
        this._tone(523, 0.15, 'sine', 0.2, 0);
        this._tone(659, 0.15, 'sine', 0.2, 0.1);
        this._tone(784, 0.15, 'sine', 0.2, 0.2);
        this._tone(1047, 0.3, 'sine', 0.25, 0.3);
    }

    bigWin() {
        this._tone(523, 0.12, 'sine', 0.25, 0);
        this._tone(659, 0.12, 'sine', 0.25, 0.08);
        this._tone(784, 0.12, 'sine', 0.25, 0.16);
        this._tone(1047, 0.12, 'sine', 0.25, 0.24);
        this._tone(1318, 0.4, 'sine', 0.3, 0.32);
    }

    loss() {
        this._tone(350, 0.2, 'triangle', 0.1, 0);
        this._tone(250, 0.35, 'triangle', 0.08, 0.15);
    }

    countdown() {
        this._tone(600, 0.06, 'sine', 0.08);
    }

    spinTick() {
        this._tone(1400, 0.015, 'square', 0.03);
    }
}

const soundEngine = new SoundEngine();
