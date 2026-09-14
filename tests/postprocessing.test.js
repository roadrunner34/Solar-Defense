/**
 * postprocessing.test.js - Quality tier selection
 *
 * Narrow by design: this covers how a tier gets chosen, not the composer chain,
 * which needs a WebGL context that neither test environment has.
 *
 * The behaviour worth guarding is the interaction between three things that all
 * want to decide the tier - the device guess, the frame-time watchdog, and the
 * player's setting. Getting the precedence wrong is invisible in the UI: the
 * setting appears to apply, then the watchdog silently undoes it a second later.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
    initQuality, getQualityTier, setQualityTier, sampleFrame, getFrameStats,
    resetPostProcessing
} from '../js/postprocessing.js';

import { CONFIG } from '../js/config.js';
import { setSetting, resetSettings, reloadSettings } from '../js/settings.js';

/**
 * Feed the watchdog frames of a given duration.
 *
 * The watchdog needs a full window before it will judge anything, and gives the
 * first window a free pass - startup frames include shader compilation, which
 * says nothing about steady-state performance. So two windows are needed before
 * it will act, and this sends three to be sure.
 *
 * @param {number} frameMs - Milliseconds per frame
 */
function feedFrames(frameMs) {
    let stamp = 1000;

    for (let i = 0; i < 300; i++) {
        stamp += frameMs;
        sampleFrame(stamp);
    }
}

beforeEach(() => {
    reloadSettings();
    resetSettings();

    // The frame-sample buffer lives at module scope, so without this a test
    // that fed the watchdog slow frames leaves them sitting there for the next
    // one to trip over. See the note on module state in tests/README.md.
    resetPostProcessing();

    setQualityTier('high');
});

describe('initQuality()', () => {
    it('falls back to the device guess when quality is auto', () => {
        setSetting('quality', 'auto');

        // No document in the node environment, so detection returns the
        // configured default rather than probing a canvas
        expect(initQuality()).toBe(CONFIG.graphics.defaultTier);
    });

    it('honours a stored quality preference over the device guess', () => {
        setSetting('quality', 'low');

        expect(initQuality()).toBe('low');
        expect(getQualityTier()).toBe('low');
    });

    it('accepts every configured tier', () => {
        for (const tier of Object.keys(CONFIG.graphics.tiers)) {
            setSetting('quality', tier);
            expect(initQuality()).toBe(tier);
        }
    });
});

describe('setQualityTier()', () => {
    it('changes the active tier', () => {
        setQualityTier('medium');
        expect(getQualityTier()).toBe('medium');
    });

    it('ignores a tier that does not exist', () => {
        setQualityTier('medium');
        setQualityTier('ultra');

        expect(getQualityTier()).toBe('medium');
    });
});

describe('the frame-time watchdog', () => {
    it('leaves a comfortable machine alone', () => {
        setSetting('quality', 'auto');
        initQuality();
        setQualityTier('high');

        feedFrames(10); // 100fps

        expect(getQualityTier()).toBe('high');
    });

    it('steps down a machine that cannot hold the frame budget', () => {
        setSetting('quality', 'auto');
        initQuality();
        setQualityTier('high');

        feedFrames(CONFIG.graphics.frameBudgetMs + 20);

        expect(getQualityTier()).not.toBe('high');
    });

    // The regression this exists for: without the pin check, choosing 'high' on
    // a machine that cannot quite hold 60fps appears to work, and is then
    // silently reverted a second later. A setting that undoes itself is worse
    // than no setting at all.
    it('does not override a tier the player pinned', () => {
        setSetting('quality', 'high');
        initQuality();

        feedFrames(CONFIG.graphics.frameBudgetMs + 20);

        expect(getQualityTier()).toBe('high');
    });

    it('still respects a pin at the lowest tier', () => {
        setSetting('quality', 'low');
        initQuality();

        feedFrames(CONFIG.graphics.frameBudgetMs + 20);

        expect(getQualityTier()).toBe('low');
    });

    it('ignores absurd frame gaps from tab switches and breakpoints', () => {
        setSetting('quality', 'auto');
        initQuality();
        setQualityTier('high');

        let stamp = 1000;
        for (let i = 0; i < 300; i++) {
            stamp += 5000; // Five-second "frames"
            sampleFrame(stamp);
        }

        expect(getQualityTier()).toBe('high');
    });
});

describe('getFrameStats()', () => {
    it('reports the active tier', () => {
        setQualityTier('medium');
        expect(getFrameStats().tier).toBe('medium');
    });

    it('reports a frame time once it has samples', () => {
        feedFrames(16);
        expect(getFrameStats().frameMs).toBeGreaterThan(0);
    });
});
