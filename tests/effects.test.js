/**
 * effects.test.js - Short-lived visual effects
 *
 * Regression guard for the pause bug. Muzzle flashes and hit effects used to
 * drive themselves with their own requestAnimationFrame loops, so they kept
 * animating while the game was paused and ran faster on high-refresh displays.
 * They are now stepped by the game loop with the same deltaTime as everything
 * else, which means a deltaTime of 0 - what the paused timer produces - must
 * leave them frozen but alive.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { addEffect, updateEffects, clearEffects, getEffectCount } from '../js/effects.js';

beforeEach(() => {
    clearEffects();
});

describe('addEffect()', () => {
    it('registers an effect', () => {
        addEffect(() => true);
        expect(getEffectCount()).toBe(1);
    });
});

describe('updateEffects()', () => {
    it('passes deltaTime and accumulated elapsed time', () => {
        const calls = [];
        addEffect((dt, elapsed) => { calls.push([dt, elapsed]); return true; });

        updateEffects(0.1);
        updateEffects(0.25);

        expect(calls).toEqual([[0.1, 0.1], [0.25, 0.35]]);
    });

    it('keeps an effect alive while it returns true', () => {
        addEffect(() => true);
        updateEffects(0.016);
        updateEffects(0.016);
        expect(getEffectCount()).toBe(1);
    });

    it('removes an effect once it returns false', () => {
        let ticks = 0;
        addEffect(() => ++ticks < 3);

        updateEffects(0.016);
        updateEffects(0.016);
        expect(getEffectCount()).toBe(1);

        updateEffects(0.016);
        expect(getEffectCount()).toBe(0);
    });

    it('removes effects independently, without disturbing the others', () => {
        addEffect(() => false);
        addEffect(() => true);
        addEffect(() => false);

        updateEffects(0.016);
        expect(getEffectCount()).toBe(1);
    });

    it('steps nothing when deltaTime is zero, but keeps effects alive', () => {
        // This is what a paused game looks like: timer.setTimescale(0)
        let progress = 0;
        addEffect((dt) => { progress += dt; return true; });

        updateEffects(0);
        updateEffects(0);

        expect(progress).toBe(0);
        expect(getEffectCount()).toBe(1);
    });

    it('advances the same amount over one big step as many small ones', () => {
        let a = 0;
        addEffect((dt) => { a += dt; return true; });
        for (let i = 0; i < 10; i++) updateEffects(0.01);
        const manySmallSteps = a;

        clearEffects();

        let b = 0;
        addEffect((dt) => { b += dt; return true; });
        updateEffects(0.1);

        expect(manySmallSteps).toBeCloseTo(b, 10);
    });
});

describe('clearEffects()', () => {
    it('gives each effect a final call so it can dispose its resources', () => {
        let disposed = false;
        addEffect(() => { disposed = true; return true; });

        clearEffects();

        expect(disposed).toBe(true);
        expect(getEffectCount()).toBe(0);
    });

    it('passes a large but finite deltaTime, never Infinity', () => {
        let seen = null;
        addEffect((dt) => { seen = dt; return true; });

        clearEffects();

        expect(Number.isFinite(seen)).toBe(true);
        expect(seen).toBeGreaterThan(1);
    });
});
