/**
 * music.test.js - The layered drone
 *
 * Runs in the `node` environment against the shared fake AudioContext. What
 * matters here is the intensity curve - which voices are audible at which wave,
 * and that nothing ever ends up silent when it should not be.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { initAudio, disposeAudio } from '../js/audio.js';
import {
    startMusic, stopMusic, setMusicIntensity, setMusicWave,
    intensityForWave, isMusicPlaying, getMusicIntensity, getMusicVoiceCount
} from '../js/music.js';

import { CONFIG } from '../js/config.js';
import { createFakeContext, installContext, uninstallContext } from './helpers/fakeAudioContext.js';

let context;

/** Start audio and music against a fresh fake context. */
function withMusic() {
    context = createFakeContext();
    installContext(context);

    initAudio();
    startMusic();
}

/**
 * The gain nodes belonging to the music voices.
 *
 * audio.js builds three gains first (master, sfx, music), so everything after
 * those belongs to music.js - one per voice, plus one LFO depth gain for each
 * voice that pulses.
 *
 * @returns {Array<object>}
 */
function voiceGains() {
    const pulsing = CONFIG.audio.music.voices.filter(v => v.pulse).length;
    const all = context.createGain.mock.results.map(r => r.value).slice(3);

    // Voice gains and LFO depth gains are interleaved in creation order, so
    // filter by identity against the count we expect rather than by position
    return all.slice(0, all.length - pulsing);
}

afterEach(() => {
    stopMusic(0);
    disposeAudio();
    uninstallContext();
});

// ==================== LIFECYCLE ====================

describe('startMusic()', () => {
    it('does nothing without an audio context', () => {
        uninstallContext();
        disposeAudio();

        expect(startMusic()).toBe(false);
        expect(isMusicPlaying()).toBe(false);
    });

    it('starts one oscillator per configured voice', () => {
        withMusic();

        const pulsing = CONFIG.audio.music.voices.filter(v => v.pulse).length;

        expect(isMusicPlaying()).toBe(true);
        expect(getMusicVoiceCount()).toBe(CONFIG.audio.music.voices.length);

        // One oscillator per voice, plus an LFO for each pulsing voice
        expect(context.createOscillator).toHaveBeenCalledTimes(
            CONFIG.audio.music.voices.length + pulsing
        );
    });

    // A restart must rebalance the running drone, not stack a second one on it
    it('is idempotent', () => {
        withMusic();
        const oscillators = context.createOscillator.mock.calls.length;

        startMusic();

        expect(context.createOscillator.mock.calls.length).toBe(oscillators);
        expect(getMusicVoiceCount()).toBe(CONFIG.audio.music.voices.length);
    });

    it('builds a filter for every voice that configures one', () => {
        withMusic();

        const filtered = CONFIG.audio.music.voices.filter(v => v.filter).length;
        expect(context.createBiquadFilter).toHaveBeenCalledTimes(filtered);
    });
});

describe('stopMusic()', () => {
    it('releases every voice', () => {
        withMusic();
        stopMusic(0);

        expect(isMusicPlaying()).toBe(false);
        expect(getMusicVoiceCount()).toBe(0);
    });

    it('is safe to call when nothing is playing', () => {
        expect(() => stopMusic(0)).not.toThrow();
    });

    it('resets intensity', () => {
        withMusic();
        setMusicIntensity(1);
        stopMusic(0);

        expect(getMusicIntensity()).toBe(0);
    });
});

// ==================== INTENSITY CURVE ====================

describe('intensityForWave()', () => {
    it('starts at zero on wave 1', () => {
        expect(intensityForWave(1)).toBe(0);
    });

    it('reaches full intensity at the configured peak wave', () => {
        expect(intensityForWave(CONFIG.audio.music.peakWave)).toBe(1);
    });

    it('climbs monotonically', () => {
        for (let wave = 1; wave < CONFIG.audio.music.peakWave; wave++) {
            expect(intensityForWave(wave + 1)).toBeGreaterThan(intensityForWave(wave));
        }
    });

    it('does not exceed 1 deep into endless', () => {
        expect(intensityForWave(200)).toBe(1);
    });

    it('does not go negative on a nonsense wave number', () => {
        expect(intensityForWave(0)).toBe(0);
        expect(intensityForWave(-5)).toBe(0);
    });
});

describe('setMusicIntensity()', () => {
    beforeEach(() => {
        withMusic();
    });

    it('clamps into 0-1', () => {
        setMusicIntensity(5);
        expect(getMusicIntensity()).toBe(1);

        setMusicIntensity(-2);
        expect(getMusicIntensity()).toBe(0);
    });

    it('ramps voice gains rather than setting them abruptly', () => {
        setMusicIntensity(1);

        const ramped = voiceGains().some(
            gain => gain.gain.linearRampToValueAtTime.mock.calls.length > 0
        );

        expect(ramped).toBe(true);
    });

    // Exponential ramps cannot pass through zero, and a voice fading fully out
    // is exactly the case here - so music is the one place in the project that
    // correctly uses a linear ramp
    it('never uses an exponential ramp on a voice gain', () => {
        setMusicIntensity(1);
        setMusicIntensity(0);

        for (const gain of voiceGains()) {
            expect(gain.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
        }
    });
});

describe('voice thresholds', () => {
    beforeEach(() => {
        withMusic();
    });

    /**
     * The gain each voice is ramping toward at a given intensity, computed the
     * same way applyIntensity() does.
     */
    function targetsAt(intensity) {
        const { fadeBand } = CONFIG.audio.music;

        return CONFIG.audio.music.voices.map((spec) => {
            const presence = Math.min(1, Math.max(0,
                (intensity - (spec.threshold - fadeBand)) / fadeBand
            ));

            return spec.gain * presence;
        });
    }

    // The bug this guards: with the fade band applied above the threshold
    // rather than below it, a threshold-0 voice is silent at intensity 0 - so
    // wave 1 would have no music at all rather than a bare root drone.
    it('keeps the root voices audible at zero intensity', () => {
        const targets = targetsAt(0);
        const audible = targets.filter(t => t > 0);

        expect(audible.length).toBeGreaterThan(0);
    });

    it('has every voice audible at full intensity', () => {
        for (const target of targetsAt(1)) {
            expect(target).toBeGreaterThan(0);
        }
    });

    it('adds voices as intensity climbs, never removes them', () => {
        let previous = targetsAt(0);

        for (let step = 1; step <= 10; step++) {
            const current = targetsAt(step / 10);

            current.forEach((target, i) => {
                expect(target).toBeGreaterThanOrEqual(previous[i] - 1e-9);
            });

            previous = current;
        }
    });

    it('reaches each voice full level by its configured threshold', () => {
        CONFIG.audio.music.voices.forEach((spec, i) => {
            expect(targetsAt(spec.threshold)[i]).toBeCloseTo(spec.gain);
        });
    });
});

describe('setMusicWave()', () => {
    beforeEach(() => {
        withMusic();
    });

    it('maps a wave onto its intensity', () => {
        setMusicWave(6);
        expect(getMusicIntensity()).toBeCloseTo(intensityForWave(6));
    });

    it('is safe deep into endless mode', () => {
        expect(() => setMusicWave(87)).not.toThrow();
        expect(getMusicIntensity()).toBe(1);
    });
});

// ==================== CONFIG SANITY ====================

describe('music config', () => {
    it('keeps every pulse depth below 1', () => {
        // The LFO output is added to the voice gain rather than replacing it,
        // so a depth at or above 1 would drive the trough negative and invert
        // the voice's phase
        for (const voice of CONFIG.audio.music.voices) {
            if (!voice.pulse) continue;
            expect(voice.pulse.depth).toBeLessThan(1);
        }
    });

    it('orders thresholds so voices enter progressively', () => {
        const thresholds = CONFIG.audio.music.voices.map(v => v.threshold);
        const sorted = [...thresholds].sort((a, b) => a - b);

        expect(thresholds).toEqual(sorted);
    });

    it('keeps the summed level of all voices modest', () => {
        // These run continuously and sum with each other, unlike a 120ms laser
        const total = CONFIG.audio.music.voices.reduce((sum, v) => sum + v.gain, 0);
        expect(total).toBeLessThan(0.5);
    });
});
