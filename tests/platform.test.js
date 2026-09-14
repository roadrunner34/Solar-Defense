/**
 * platform.test.js - Deployable weapon platforms
 *
 * Ported from the original tests/platforms/platform-base.test.js (Sprint 2
 * Task 1.2) and extended to cover the placement rules from Tasks 2.1/2.2.
 *
 * createScene() is safe to call headless because createFlareTexture()
 * returns a blank texture when no 2D canvas context is available.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createScene, scene } from '../js/scene.js';
import {
    createPlatform, platforms, removePlatform, clearAllPlatforms,
    isValidPlacementPosition, checkPlatformOverlap, snapToGrid,
    getPlacementConstraints
} from '../js/platform.js';
import { getPlatformConfig } from '../js/config.js';

createScene();

beforeEach(() => {
    clearAllPlatforms();
});

describe('createPlatform()', () => {
    it('creates a platform carrying its config stats', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(20, 0, 20));
        const config = getPlatformConfig('laserBattery');

        expect(platform.type).toBe('laserBattery');
        expect(platform).toMatchObject({
            damage: config.damage,
            range: config.range,
            fireRate: config.fireRate,
            cost: config.cost
        });
    });

    it('creates each platform type', () => {
        expect(createPlatform('missileLauncher', new THREE.Vector3(30, 0, 0)).damage)
            .toBe(getPlatformConfig('missileLauncher').damage);
    });

    it('exposes every property the rest of the game reads', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));
        for (const prop of ['mesh', 'type', 'position', 'damage', 'range', 'fireRate', 'cost', 'id', 'alive']) {
            expect(platform).toHaveProperty(prop);
        }
    });

    it('positions both the record and the mesh', () => {
        const position = new THREE.Vector3(25, 0, -25);
        const platform = createPlatform('laserBattery', position);

        expect(platform.position.equals(position)).toBe(true);
        expect(platform.mesh.position.equals(position)).toBe(true);
    });

    it('accepts a plain {x, y, z} object as well as a Vector3', () => {
        const platform = createPlatform('laserBattery', { x: 20, y: 0, z: 20 });
        expect(platform.position.x).toBe(20);
    });

    it('adds a visible mesh to the scene and tracks it', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));

        expect(platform.mesh.visible).toBe(true);
        expect(scene.children).toContain(platform.mesh);
        expect(platforms).toContain(platform);
        expect(platforms.length).toBe(1);
    });

    it('does not copy the caller\'s vector by reference', () => {
        const position = new THREE.Vector3(20, 0, 20);
        const platform = createPlatform('laserBattery', position);
        position.set(999, 999, 999);
        expect(platform.position.x).toBe(20);
    });
});

describe('removePlatform()', () => {
    it('drops the platform from the array, the scene and marks it dead', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));
        removePlatform(platform);

        expect(platforms).not.toContain(platform);
        expect(scene.children).not.toContain(platform.mesh);
        expect(platform.alive).toBe(false);
    });
});

describe('clearAllPlatforms()', () => {
    it('empties the array', () => {
        createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));
        createPlatform('missileLauncher', new THREE.Vector3(-30, 0, 10));
        expect(platforms.length).toBe(2);

        clearAllPlatforms();
        expect(platforms.length).toBe(0);
    });
});

describe('isValidPlacementPosition()', () => {
    const { minDistance, maxDistance } = getPlacementConstraints();

    it('accepts a spot inside the defence ring', () => {
        expect(isValidPlacementPosition(new THREE.Vector3(30, 0, 0)).valid).toBe(true);
    });

    it('rejects a spot too close to the planet', () => {
        const result = isValidPlacementPosition(new THREE.Vector3(minDistance - 1, 0, 0));
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/close to planet/i);
    });

    it('rejects a spot beyond the outer limit', () => {
        const result = isValidPlacementPosition(new THREE.Vector3(maxDistance + 1, 0, 0));
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/far from planet/i);
    });

    it('measures distance on the XZ plane, ignoring height', () => {
        // Height alone must not push a valid spot out of range
        expect(isValidPlacementPosition(new THREE.Vector3(30, 500, 0)).valid).toBe(true);
    });

    it('rejects a spot occupied by another platform', () => {
        createPlatform('laserBattery', new THREE.Vector3(30, 0, 0));
        const result = isValidPlacementPosition(new THREE.Vector3(31, 0, 0));

        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/another platform/i);
    });
});

describe('checkPlatformOverlap()', () => {
    it('reports no overlap against an empty field', () => {
        expect(checkPlatformOverlap(new THREE.Vector3(30, 0, 0)).overlapping).toBe(false);
    });

    it('finds the nearest platform and its distance', () => {
        const near = createPlatform('laserBattery', new THREE.Vector3(30, 0, 0));
        createPlatform('laserBattery', new THREE.Vector3(-30, 0, 0));

        const result = checkPlatformOverlap(new THREE.Vector3(35, 0, 0));
        expect(result.nearestPlatform).toBe(near);
        expect(result.distance).toBeCloseTo(5);
    });

    it('honours excludePlatform so a platform never blocks itself', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(30, 0, 0));
        expect(checkPlatformOverlap(platform.position, platform).overlapping).toBe(false);
    });
});

describe('snapToGrid()', () => {
    const { gridSpacing } = getPlacementConstraints();

    it('snaps X and Z to the nearest grid point', () => {
        const snapped = snapToGrid(new THREE.Vector3(7, 0, 13));
        expect(snapped.x % gridSpacing).toBe(0);
        expect(snapped.z % gridSpacing).toBe(0);
        expect(snapped.x).toBe(5);
        expect(snapped.z).toBe(15);
    });

    it('leaves height untouched', () => {
        expect(snapToGrid(new THREE.Vector3(7, 3.3, 13)).y).toBeCloseTo(3.3);
    });

    it('does not mutate the input vector', () => {
        const original = new THREE.Vector3(7, 0, 13);
        snapToGrid(original);
        expect(original.x).toBe(7);
    });
});
