/**
 * fakeAudioContext.js - A stand-in for the Web Audio API
 *
 * Shared by audio.test.js and music.test.js, both of which run in Vitest's
 * `node` environment where there is no Web Audio API at all.
 *
 * The fake is deliberately dumb: it records what was asked of it and produces
 * no sound. What the tests care about is scheduling - which nodes got built,
 * what gains were ramped to, whether a cooldown or a voice cap refused a
 * request - and none of that needs an audio thread.
 *
 * Every mock is written as `function () {}` rather than an arrow, for two
 * reasons: Vitest warns about arrow implementations, and an arrow cannot be
 * called with `new` - which is exactly how audio.js constructs the context.
 */

import { vi } from 'vitest';

/**
 * A minimal AudioParam that remembers the last value set on it.
 *
 * @param {number} [initial]
 * @returns {object}
 */
export function fakeParam(initial = 0) {
    return {
        value: initial,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
        cancelScheduledValues: vi.fn()
    };
}

/**
 * A minimal AudioNode.
 *
 * @param {object} [extra] - Node-specific properties to merge in
 * @returns {object}
 */
export function fakeNode(extra = {}) {
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
 * @returns {object}
 */
export function createFakeContext() {
    return {
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
                detune: fakeParam(0),
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
}

/**
 * Install a fake context constructor on globalThis.
 *
 * A plain function rather than an arrow: `new` on an arrow throws, and
 * returning an object from a constructor call is what hands audio.js the fake.
 *
 * @param {object} context - The fake context to hand out
 */
export function installContext(context) {
    globalThis.AudioContext = vi.fn(function () {
        return context;
    });
}

/**
 * Remove any installed fake constructor.
 */
export function uninstallContext() {
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
}
