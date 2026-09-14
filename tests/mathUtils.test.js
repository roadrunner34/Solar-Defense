/**
 * mathUtils.test.js - Animation and interpolation utilities
 *
 * These are pure functions, so they need no DOM and no Three.js renderer.
 * dampAngle's wrap-around behaviour is the interesting one: it underpins
 * every turret in the game, so a regression here makes aiming go the long
 * way round the circle.
 */

import { describe, it, expect } from 'vitest';
import { damp, dampAngle, clamp, mapRange, lerp, easeInOutCubic } from '../js/mathUtils.js';

describe('damp()', () => {
    it('moves toward the target without overshooting', () => {
        const result = damp(0, 10, 5, 0.016);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(10);
    });

    it('converges on the target over many steps', () => {
        let value = 0;
        for (let i = 0; i < 200; i++) value = damp(value, 10, 5, 0.016);
        expect(value).toBeCloseTo(10, 1);
    });

    it('is frame-rate independent: one big step ~= many small ones', () => {
        let stepped = 0;
        for (let i = 0; i < 10; i++) stepped = damp(stepped, 100, 5, 0.01);
        const single = damp(0, 100, 5, 0.1);
        expect(stepped).toBeCloseTo(single, 5);
    });

    it('does not move when already at the target', () => {
        expect(damp(7, 7, 5, 0.016)).toBe(7);
    });
});

describe('dampAngle()', () => {
    it('takes the short way across the +/-PI seam', () => {
        // From just below +PI to just above -PI is a 0.2rad hop forward,
        // not a 6.08rad journey backwards through zero.
        const from = Math.PI - 0.1;
        const to = -Math.PI + 0.1;
        const result = dampAngle(from, to, 20, 0.016);
        expect(result).toBeGreaterThan(from);
    });

    it('takes the short way in the other direction too', () => {
        const from = -Math.PI + 0.1;
        const to = Math.PI - 0.1;
        const result = dampAngle(from, to, 20, 0.016);
        expect(result).toBeLessThan(from);
    });

    it('never steps further than the wrapped difference', () => {
        const from = 3.0;
        const to = -3.0;
        const step = Math.abs(dampAngle(from, to, 100, 1) - from);
        // Wrapped difference is ~0.283rad, not ~6.0rad
        expect(step).toBeLessThan(1);
    });
});

describe('clamp()', () => {
    it('bounds values on both sides and passes through the middle', () => {
        expect(clamp(-5, 0, 10)).toBe(0);
        expect(clamp(15, 0, 10)).toBe(10);
        expect(clamp(5, 0, 10)).toBe(5);
    });
});

describe('mapRange()', () => {
    it('remaps between ranges', () => {
        expect(mapRange(50, 0, 100, 0, 1)).toBe(0.5);
        expect(mapRange(0, 0, 100, 10, 20)).toBe(10);
    });
});

describe('lerp() and easeInOutCubic()', () => {
    it('lerp hits both endpoints and the midpoint', () => {
        expect(lerp(0, 10, 0)).toBe(0);
        expect(lerp(0, 10, 1)).toBe(10);
        expect(lerp(0, 10, 0.5)).toBe(5);
    });

    it('easeInOutCubic is pinned at 0, 0.5 and 1', () => {
        expect(easeInOutCubic(0)).toBe(0);
        expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
        expect(easeInOutCubic(1)).toBe(1);
    });
});
