/**
 * textures.test.js - Procedural texture generation
 *
 * Two things worth guarding here.
 *
 * The first is the headless fallback. Vitest's default environment has no DOM
 * at all, and its jsdom environment has a DOM with no 2D canvas context. Every
 * factory in textures.js has to survive both, or building a scene in a test
 * throws - and four existing test files build a scene. This file runs in the
 * node environment deliberately, which is the harsher of the two.
 *
 * The second is the noise itself, which is pure maths and testable without any
 * rendering: it has to be deterministic (or a reload reshuffles every planet)
 * and stay inside 0..1 (or it silently clips when written into a texture).
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import {
    createPlanetMaps,
    createCloudTexture,
    createRockMaps,
    createHullMaps,
    createStarSprite,
    createNebulaTexture,
    fbm,
    ridged,
    noise3
} from '../js/textures.js';

describe('headless safety', () => {
    // There is no `document` in this environment at all, so every factory takes
    // the null-canvas path. They must still hand back usable Texture objects.
    it('returns textures for the planet without a DOM', () => {
        const maps = createPlanetMaps(32, 16);

        expect(maps.map).toBeInstanceOf(THREE.Texture);
        expect(maps.bumpMap).toBeInstanceOf(THREE.Texture);
        expect(maps.roughnessMap).toBeInstanceOf(THREE.Texture);
        expect(maps.emissiveMap).toBeInstanceOf(THREE.Texture);
    });

    it('returns a texture for the clouds', () => {
        expect(createCloudTexture(32, 16)).toBeInstanceOf(THREE.Texture);
    });

    it('returns textures for rock', () => {
        const maps = createRockMaps(16);

        expect(maps.map).toBeInstanceOf(THREE.Texture);
        expect(maps.bumpMap).toBeInstanceOf(THREE.Texture);
        expect(maps.roughnessMap).toBeInstanceOf(THREE.Texture);
    });

    it('returns textures for hull plating', () => {
        const maps = createHullMaps(16);

        expect(maps.map).toBeInstanceOf(THREE.Texture);
        expect(maps.roughnessMap).toBeInstanceOf(THREE.Texture);
        expect(maps.metalnessMap).toBeInstanceOf(THREE.Texture);
    });

    it('returns a texture for stars and for the nebula', () => {
        expect(createStarSprite(16)).toBeInstanceOf(THREE.Texture);
        expect(createNebulaTexture(32, 16)).toBeInstanceOf(THREE.Texture);
    });
});

describe('noise', () => {
    // Determinism is what makes the planet the same world on every reload. A
    // Math.random-based field would regenerate the continents each refresh.
    it('gives the same value for the same coordinate every time', () => {
        expect(noise3(1.5, 2.25, 3.75)).toBe(noise3(1.5, 2.25, 3.75));
        expect(fbm(0.3, 0.7, 1.1, 4)).toBe(fbm(0.3, 0.7, 1.1, 4));
    });

    it('gives different values for different coordinates', () => {
        expect(noise3(1.5, 2.25, 3.75)).not.toBe(noise3(9.5, 4.25, 1.75));
    });

    // Values feed straight into 0-255 pixel channels. Anything outside 0..1
    // clips silently and shows up as flat white or black patches.
    it('stays within 0..1', () => {
        for (let i = 0; i < 400; i++) {
            const x = (i % 20) * 0.37;
            const y = Math.floor(i / 20) * 0.53;
            const z = i * 0.11;

            for (const value of [noise3(x, y, z), fbm(x, y, z, 5), ridged(x, y, z, 4)]) {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
            }
        }
    });

    it('produces no NaN at exact integer lattice points', () => {
        // Integer coordinates land on cell corners, where the interpolation
        // weights are exactly 0 or 1 - a common source of edge-case NaN
        for (let i = 0; i < 5; i++) {
            expect(Number.isNaN(noise3(i, i, i))).toBe(false);
            expect(Number.isNaN(fbm(i, i, i, 4))).toBe(false);
        }
    });

    it('copes with negative coordinates', () => {
        // Spherical sampling produces negative directions on half the sphere,
        // so floor() has to behave there too
        expect(Number.isNaN(noise3(-3.4, -0.2, -7.9))).toBe(false);
        expect(noise3(-3.4, -0.2, -7.9)).toBeGreaterThanOrEqual(0);
    });

    it('makes more detail available as octaves are added', () => {
        // More octaves should change the field rather than being a no-op
        expect(fbm(2.2, 3.3, 4.4, 1)).not.toBe(fbm(2.2, 3.3, 4.4, 6));
    });
});
