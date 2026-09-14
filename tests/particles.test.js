/**
 * particles.test.js - Pooled particle systems
 *
 * Two regression guards here:
 *
 * 1. Frustum culling. THREE.Points computes its bounding sphere once, from the
 *    all-zero initial position array, and never recomputes it - so it stays a
 *    zero-radius sphere at the origin. Every burst vanished as soon as the
 *    origin left the view.
 * 2. Per-particle colour. Burst colour used to live in a material uniform,
 *    shared by the whole pool, so the most recent explosion recoloured every
 *    particle still in flight.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { createScene, scene } from '../js/scene.js';
import {
    initParticles, updateParticles, createExplosion, createSparks,
    createEnemyDeathEffect
} from '../js/particles.js';

// The three pooled systems, identified by their custom shader material
let systems;
let explosionSystem;

beforeAll(() => {
    createScene();
    initParticles();

    systems = scene.children.filter(c => c.isPoints && c.material.uniforms?.baseSize);
    // The explosion pool is the largest (MAX_EXPLOSION_PARTICLES = 500)
    explosionSystem = systems.reduce((a, b) =>
        a.geometry.attributes.position.count >= b.geometry.attributes.position.count ? a : b);
});

/** Colours of every currently-visible particle in a system. */
function visibleColors(points) {
    const colors = points.geometry.attributes.particleColor.array;
    const alphas = points.geometry.attributes.alpha.array;
    const out = [];

    for (let i = 0; i < alphas.length; i++) {
        if (alphas[i] > 0) {
            out.push([colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]]);
        }
    }
    return out;
}

describe('particle systems', () => {
    it('creates the three pooled systems', () => {
        expect(systems.length).toBe(3);
    });

    it('disables frustum culling on every pool', () => {
        for (const points of systems) {
            expect(points.frustumCulled).toBe(false);
        }
    });

    it('carries colour as a geometry attribute, not a shared uniform', () => {
        for (const points of systems) {
            expect(points.geometry.attributes.particleColor).toBeDefined();
            expect(points.geometry.attributes.particleColor.itemSize).toBe(3);
            expect(points.material.uniforms.color).toBeUndefined();
        }
    });

    it('sizes the colour attribute to match the pool', () => {
        for (const points of systems) {
            expect(points.geometry.attributes.particleColor.count)
                .toBe(points.geometry.attributes.position.count);
        }
    });
});

describe('simultaneous explosions', () => {
    it('keep their own colours instead of overwriting each other', () => {
        // Two enemy types dying at once, as happens constantly in a wave
        createEnemyDeathEffect(new THREE.Vector3(0, 0, 0), 'basic');    // red  (2, 0.5, 0.5)
        createEnemyDeathEffect(new THREE.Vector3(30, 0, 0), 'armored'); // purple (1.5, 0.5, 2)
        updateParticles(0.016);

        const colors = visibleColors(explosionSystem);
        const hasRed = colors.some(([r, g, b]) => r === 2 && g === 0.5 && b === 0.5);
        const hasPurple = colors.some(([r, g, b]) => r === 1.5 && g === 0.5 && b === 2);

        expect(hasRed).toBe(true);
        expect(hasPurple).toBe(true);
    });

    it('places particles at their own explosion sites', () => {
        createExplosion(new THREE.Vector3(50, 0, 0), new THREE.Color(1, 0, 0), 10, 0);
        updateParticles(0.016);

        const positions = explosionSystem.geometry.attributes.position.array;
        const alphas = explosionSystem.geometry.attributes.alpha.array;
        let nearFifty = 0;

        for (let i = 0; i < alphas.length; i++) {
            if (alphas[i] > 0 && Math.abs(positions[i * 3] - 50) < 1) nearFifty++;
        }

        expect(nearFifty).toBeGreaterThan(0);
    });
});

describe('particle lifetime', () => {
    it('fades particles out and frees them for reuse', () => {
        createSparks(new THREE.Vector3(0, 0, 0), null, 5);
        updateParticles(0.016);

        const sparkSystem = systems.find(s => s !== explosionSystem
            && s.geometry.attributes.position.count < explosionSystem.geometry.attributes.position.count);
        expect(visibleColors(sparkSystem).length).toBeGreaterThan(0);

        // Sparks live at most 0.5s; step well past that
        updateParticles(2);
        updateParticles(0.016);

        expect(visibleColors(sparkSystem).length).toBe(0);
    });

    it('flags the colour buffer for upload alongside the others', () => {
        createExplosion(new THREE.Vector3(0, 5, 0), null, 5, 1);
        updateParticles(0.016);

        const attrs = explosionSystem.geometry.attributes;
        expect(attrs.particleColor.needsUpdate).toBe(attrs.position.needsUpdate);
    });
});
