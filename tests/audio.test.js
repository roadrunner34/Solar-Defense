/**
 * audio.test.js - Procedural sound
 *
 * Runs in the default `node` environment, which has no Web Audio API at all.
 * That is deliberate: the first thing these tests prove is that audio.js
 * degrades silently rather than throwing when there is no AudioContext, because
 * every other test file in the suite imports a module chain that reaches it.
 *
 * The rest of the file installs a fake AudioContext on globalThis so the
 * scheduling logic - cooldowns, the voice cap, priority - can be tested without
 * a browser. The fake is deliberately dumb: it records what was asked of it and
 * does no audio.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
    initAudio, isAudioReady, playSound, panFromScreenX,
    getActiveVoiceCount, resetSoundCooldowns, disposeAudio,
    getMusicBus, getAudioContext
} from '../js/audio.js';

import { CONFIG } from '../js/config.js';
import { setSetting, resetSettings, reloadSettings, getSetting } from '../js/settings.js';

// ==================== FAKE WEB AUDIO ====================

/**
 * A minimal AudioParam that remembers the last value set on it.
 */
function fakeParam(initial = 0) {
    return {
        value: initial,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn()
    };
}

function fakeNode(extra = {}) {
    return {
        connect: vi.fn(function () {}),
        disconnect: vi.fn(function () {}),
        ...extra
    };
}

/**
 * Build a fake AudioContext.
 *
 * currentTime is a plain writable property so a test can advance the clock and
 * step past a retrigger cooldown without waiting in real time.
 *
 * Every mock is written as `function () {}` rather than an arrow. Vitest warns
 * about arrow implementations, and more importantly an arrow function cannot be
 * called with `new` - which is exactly how audio.js constructs the context.
 */
function createFakeContext() {
    const context = {
        state: 'running',
        sampleRate: 48000,
        currentTime: 0,
        destination: fakeNode(),

        createGain: vi.fn(function () {
            return fakeNode({ gain: fakeParam(1) });
        }),

        createOscillator: vi.fn(function () {
            return fakeNode({
                type: 'sine',
                frequency: fakeParam(440),
                start: vi.fn(function () {}),
                stop: vi.fn(function () {})
            });
        }),

        createBufferSource: vi.fn(function () {
            return fakeNode({
                buffer: null,
                loop: false,
                loopStart: 0,
                loopEnd: 0,
                start: vi.fn(function () {}),
                stop: vi.fn(function () {})
            });
        }),

        createBiquadFilter: vi.fn(function () {
            return fakeNode({
                type: 'lowpass',
                Q: fakeParam(1),
                frequency: fakeParam(1000)
            });
        }),

        createStereoPanner: vi.fn(function () {
            return fakeNode({ pan: fakeParam(0) });
        }),

        createBuffer: vi.fn(function (channels, length) {
            return {
                length,
                getChannelData: () => new Float32Array(length)
            };
        }),

        resume: vi.fn(function () {
            return Promise.resolve();
        }),

        close: vi.fn(function () {
            return Promise.resolve();
        })
    };

    return context;
}

/**
 * Install a fake context constructor.
 *
 * A plain function rather than an arrow: `new` on an arrow throws, and
 * returning an object from a constructor call is what hands audio.js the fake.
 *
 * @param {object} context - The fake context to hand out
 */
function installContext(context) {
    globalThis.AudioContext = vi.fn(function () {
        return context;
    });
}

/**
 * Install a fake context and initialize audio against it.
 * @returns {object} The fake context, so tests can advance its clock
 */
function withFakeAudio() {
    const context = createFakeContext();
    installContext(context);

    initAudio();

    return context;
}

afterEach(() => {
    disposeAudio();
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
    vi.useRealTimers();
});

// ==================== HEADLESS ====================

describe('without an AudioContext', () => {
    beforeEach(() => {
        disposeAudio();
        delete globalThis.AudioContext;
        delete globalThis.webkitAudioContext;
    });

    it('reports that audio is not ready', () => {
        expect(isAudioReady()).toBe(false);
    });

    it('fails initialization without throwing', () => {
        expect(() => initAudio()).not.toThrow();
        expect(initAudio()).toBe(false);
    });

    // This is the property the rest of the test suite depends on: every other
    // spec imports a module that reaches audio.js, and a throw here would take
    // all of them down.
    it('refuses to play every configured sound, silently', () => {
        for (const name of Object.keys(CONFIG.audio.sounds)) {
            expect(() => playSound(name)).not.toThrow();
            expect(playSound(name)).toBe(false);
        }
    });

    it('exposes no context or music bus', () => {
        expect(getAudioContext()).toBeNull();
        expect(getMusicBus()).toBeNull();
    });
});

// ==================== INITIALIZATION ====================

describe('initAudio()', () => {
    it('builds the graph and reports ready', () => {
        withFakeAudio();

        expect(isAudioReady()).toBe(true);
        expect(getMusicBus()).not.toBeNull();
    });

    it('is idempotent - a second call does not rebuild the context', () => {
        withFakeAudio();
        const constructorCalls = globalThis.AudioContext.mock.calls.length;

        initAudio();

        expect(globalThis.AudioContext.mock.calls.length).toBe(constructorCalls);
    });

    it('resumes a context that was created suspended', () => {
        const context = createFakeContext();
        context.state = 'suspended';
        installContext(context);

        initAudio();

        expect(context.resume).toHaveBeenCalled();
    });

    it('survives a constructor that throws', () => {
        globalThis.AudioContext = vi.fn(function () {
            throw new Error('too many contexts');
        });

        expect(initAudio()).toBe(false);
        expect(isAudioReady()).toBe(false);
    });
});

// ==================== PLAYBACK ====================

describe('playSound()', () => {
    let context;

    beforeEach(() => {
        context = withFakeAudio();
        resetSoundCooldowns();
    });

    it('plays a known sound', () => {
        expect(playSound('laser')).toBe(true);
    });

    it('ignores a sound that is not in the config', () => {
        expect(playSound('trombone')).toBe(false);
    });

    it('creates one oscillator per tone layer', () => {
        // The laser is a single sawtooth layer
        playSound('laser');
        expect(context.createOscillator).toHaveBeenCalledTimes(1);
    });

    it('uses the noise buffer for noise layers', () => {
        // An explosion is a noise body plus a sine thump
        playSound('explosion');

        expect(context.createBufferSource).toHaveBeenCalledTimes(1);
        expect(context.createOscillator).toHaveBeenCalledTimes(1);
    });

    it('builds a filter only for layers that ask for one', () => {
        playSound('hit'); // one noise layer, bandpassed
        expect(context.createBiquadFilter).toHaveBeenCalledTimes(1);

        context.createBiquadFilter.mockClear();

        playSound('build'); // one tone layer, unfiltered
        expect(context.createBiquadFilter).not.toHaveBeenCalled();
    });

    it('pans only when asked to', () => {
        playSound('laser', { pan: 0.5 });
        expect(context.createStereoPanner).toHaveBeenCalledTimes(1);

        context.createStereoPanner.mockClear();
        context.currentTime += 1;

        playSound('laser');
        expect(context.createStereoPanner).not.toHaveBeenCalled();
    });

    it('clamps pan into range', () => {
        playSound('laser', { pan: 99 });

        const panner = context.createStereoPanner.mock.results[0].value;
        expect(panner.pan.value).toBe(1);
    });
});

// ==================== RETRIGGER COOLDOWN ====================

describe('retrigger cooldown', () => {
    let context;

    beforeEach(() => {
        context = withFakeAudio();
        resetSoundCooldowns();
    });

    // Eight platforms firing in the same frame must not stack eight copies of
    // the same bolt at the same instant - that is not eight times louder, it is
    // one bolt, clipped.
    it('refuses a repeat inside the configured window', () => {
        expect(playSound('laser')).toBe(true);
        expect(playSound('laser')).toBe(false);
    });

    it('allows the repeat once the window has passed', () => {
        expect(playSound('laser')).toBe(true);

        context.currentTime += CONFIG.audio.sounds.laser.cooldown + 0.001;

        expect(playSound('laser')).toBe(true);
    });

    it('tracks each sound separately', () => {
        expect(playSound('laser')).toBe(true);
        expect(playSound('explosion')).toBe(true);
    });

    it('is cleared by resetSoundCooldowns()', () => {
        expect(playSound('laser')).toBe(true);

        resetSoundCooldowns();

        expect(playSound('laser')).toBe(true);
    });
});

// ==================== VOICE CAP ====================

describe('voice cap', () => {
    let context;

    beforeEach(() => {
        context = withFakeAudio();
        resetSoundCooldowns();
    });

    /** Play `count` lasers, stepping past the cooldown between each. */
    function playLasers(count) {
        const results = [];

        for (let i = 0; i < count; i++) {
            results.push(playSound('laser'));
            context.currentTime += CONFIG.audio.sounds.laser.cooldown + 0.001;
        }

        return results;
    }

    it('counts active voices', () => {
        playLasers(3);
        expect(getActiveVoiceCount()).toBe(3);
    });

    it('drops sounds once the cap is reached', () => {
        const results = playLasers(CONFIG.audio.maxVoices + 2);
        const played = results.filter(Boolean).length;

        expect(played).toBe(CONFIG.audio.maxVoices);
    });

    // A breach alarm losing out to the tail of six explosions is exactly the
    // wrong trade, so priority sounds ignore the cap.
    it('lets priority sounds through anyway', () => {
        playLasers(CONFIG.audio.maxVoices + 2);

        expect(getActiveVoiceCount()).toBe(CONFIG.audio.maxVoices);
        expect(playSound('breach')).toBe(true);
    });

    it('releases voices after they finish', () => {
        vi.useFakeTimers();

        playSound('explosion');
        expect(getActiveVoiceCount()).toBe(1);

        // Longer than the longest layer in the recipe
        vi.advanceTimersByTime(2000);

        expect(getActiveVoiceCount()).toBe(0);
    });
});

// ==================== PANNING ====================

describe('panFromScreenX()', () => {
    it('puts the centre of the screen in the middle', () => {
        expect(panFromScreenX(500, 1000)).toBe(0);
    });

    it('pans left for the left edge and right for the right', () => {
        expect(panFromScreenX(0, 1000)).toBeLessThan(0);
        expect(panFromScreenX(1000, 1000)).toBeGreaterThan(0);
    });

    // Hard panning is disorienting on headphones, and an explosion at the edge
    // of the screen is not actually beside the player's ear
    it('never pans fully to one side', () => {
        expect(Math.abs(panFromScreenX(0, 1000))).toBeLessThan(1);
        expect(Math.abs(panFromScreenX(1000, 1000))).toBeLessThan(1);
    });

    it('stays in range for positions outside the viewport', () => {
        expect(panFromScreenX(-500, 1000)).toBeGreaterThanOrEqual(-1);
        expect(panFromScreenX(5000, 1000)).toBeLessThanOrEqual(1);
    });

    it('returns centre when the viewport has no width', () => {
        expect(panFromScreenX(100, 0)).toBe(0);
    });
});

// ==================== VOLUME ====================

describe('volume settings', () => {
    beforeEach(() => {
        reloadSettings();
        resetSettings();
    });

    it('clamps volumes into 0-1', () => {
        expect(setSetting('masterVolume', 5)).toBe(1);
        expect(setSetting('masterVolume', -3)).toBe(0);
    });

    it('rejects a non-numeric volume, falling back to the default', () => {
        setSetting('masterVolume', 'loud');
        expect(typeof getSetting('masterVolume')).toBe('number');
    });

    it('applies stored volumes to the mixer on init', () => {
        setSetting('masterVolume', 0.5);

        const context = withFakeAudio();

        // Master is the first gain node built, and volume is applied as the
        // square of the setting to correct for perceived loudness
        const master = context.createGain.mock.results[0].value;
        expect(master.gain.value).toBeCloseTo(0.25);
    });

    it('follows a volume change made after init', () => {
        const context = withFakeAudio();
        const master = context.createGain.mock.results[0].value;

        setSetting('masterVolume', 1);

        expect(master.gain.value).toBeCloseTo(1);
    });
});
