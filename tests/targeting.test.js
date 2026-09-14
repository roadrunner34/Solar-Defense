// @vitest-environment jsdom

/**
 * targeting.test.js - Which enemy a weapon shoots at
 *
 * Needs a DOM because spawning enemies creates health-bar elements.
 *
 * The four modes are easy to state and easy to get subtly backwards, which is
 * what most of these tests are for: 'first' means furthest along the path
 * (nearest the planet), not first spawned; 'last' means least far along, not
 * most recently spawned.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';

import { createScene } from '../js/scene.js';
import { initPaths } from '../js/path.js';
import { initEnemies, spawnEnemy, clearEnemies, damageEnemy } from '../js/enemy.js';
import { initParticles } from '../js/particles.js';

import {
    selectTarget, TARGETING_MODES, TARGETING_LABELS, DEFAULT_TARGETING,
    isTargetingMode, nextTargetingMode
} from '../js/targeting.js';

import {
    createPlatform, clearAllPlatforms, findTarget, setPlatformTargeting
} from '../js/platform.js';

import { initEconomy } from '../js/economy.js';

createScene();
initPaths();
initEnemies();
initParticles();

const origin = new THREE.Vector3(0, 0, 0);

/**
 * Put an enemy at a known spot with a known path progress.
 *
 * Position and progress are set independently here so a test can express
 * "near me but barely started" - which is exactly the case that separates
 * 'closest' from 'last'.
 */
function enemyAt(x, { progress = 0, type = 'basic' } = {}) {
    const enemy = spawnEnemy(type, 'default');
    enemy.mesh.position.set(x, 0, 0);
    enemy.pathProgress = progress;
    return enemy;
}

beforeEach(() => {
    clearEnemies();
    clearAllPlatforms();
    initEconomy();
});

// ==================== THE MODE LIST ====================

describe('the mode list', () => {
    it('has a label for every mode', () => {
        for (const mode of TARGETING_MODES) {
            expect(typeof TARGETING_LABELS[mode]).toBe('string');
            expect(TARGETING_LABELS[mode].length).toBeGreaterThan(0);
        }
    });

    // Defaulting to anything else would silently change how every existing
    // platform behaves the moment this feature landed
    it('defaults to the pre-existing behaviour', () => {
        expect(DEFAULT_TARGETING).toBe('closest');
        expect(TARGETING_MODES).toContain(DEFAULT_TARGETING);
    });

    it('recognises its own modes and nothing else', () => {
        for (const mode of TARGETING_MODES) {
            expect(isTargetingMode(mode)).toBe(true);
        }

        expect(isTargetingMode('nearest')).toBe(false);
        expect(isTargetingMode('')).toBe(false);
        expect(isTargetingMode(undefined)).toBe(false);
    });

    it('cycles through every mode and wraps', () => {
        let mode = TARGETING_MODES[0];
        const seen = [mode];

        for (let i = 1; i < TARGETING_MODES.length; i++) {
            mode = nextTargetingMode(mode);
            seen.push(mode);
        }

        expect(seen).toEqual(TARGETING_MODES);
        expect(nextTargetingMode(mode)).toBe(TARGETING_MODES[0]);
    });
});

// ==================== SELECTING ====================

describe('selectTarget()', () => {
    it('returns null when nothing is in range', () => {
        enemyAt(500);
        expect(selectTarget('closest', origin, 100)).toBe(null);
    });

    it('returns null when there are no enemies', () => {
        expect(selectTarget('closest', origin, 100)).toBe(null);
    });

    it('ignores dead enemies', () => {
        const enemy = enemyAt(10);
        damageEnemy(enemy, 99999);

        expect(selectTarget('closest', origin, 100)).toBe(null);
    });

    // A weapon that stops firing is a worse failure than one that picks an
    // unexpected target, so an unknown mode falls back rather than returning null
    it('falls back to the default for an unknown mode', () => {
        const near = enemyAt(10);
        enemyAt(50);

        expect(selectTarget('nonsense', origin, 100)).toBe(near);
    });
});

describe("'closest'", () => {
    it('picks the nearest enemy regardless of progress', () => {
        const near = enemyAt(10, { progress: 0.1 });
        enemyAt(50, { progress: 0.9 });

        expect(selectTarget('closest', origin, 100)).toBe(near);
    });

    it('respects range', () => {
        enemyAt(150);
        const inRange = enemyAt(80);

        expect(selectTarget('closest', origin, 100)).toBe(inRange);
    });
});

describe("'first'", () => {
    // The mode that exists so a weapon can defend the leak rather than its own
    // doorstep. 'First' means furthest along the path - nearest the planet.
    it('picks the enemy furthest along its path, not the nearest one', () => {
        const nearButEarly = enemyAt(10, { progress: 0.1 });
        const farButLate = enemyAt(60, { progress: 0.95 });

        expect(selectTarget('first', origin, 100)).toBe(farButLate);
        expect(selectTarget('first', origin, 100)).not.toBe(nearButEarly);
    });

    it('still only considers enemies in range', () => {
        enemyAt(500, { progress: 0.99 });
        const reachable = enemyAt(40, { progress: 0.2 });

        expect(selectTarget('first', origin, 100)).toBe(reachable);
    });
});

describe("'last'", () => {
    it('picks the enemy least far along its path', () => {
        enemyAt(60, { progress: 0.9 });
        const freshest = enemyAt(70, { progress: 0.05 });

        expect(selectTarget('last', origin, 100)).toBe(freshest);
    });

    it('is the exact opposite of first', () => {
        enemyAt(30, { progress: 0.2 });
        enemyAt(40, { progress: 0.8 });

        const first = selectTarget('first', origin, 100);
        const last = selectTarget('last', origin, 100);

        expect(first).not.toBe(last);
        expect(first.pathProgress).toBeGreaterThan(last.pathProgress);
    });
});

describe("'strongest'", () => {
    it('picks the enemy with the most health', () => {
        enemyAt(10, { type: 'fast' });      // 60 health
        const armored = enemyAt(70, { type: 'armored' }); // 200 health

        expect(selectTarget('strongest', origin, 100)).toBe(armored);
    });

    // Current health, not maximum - an Armored enemy already worked down to 20
    // is no longer the thing most worth shooting
    it('uses current health rather than maximum', () => {
        const armored = enemyAt(20, { type: 'armored' });
        const basic = enemyAt(30, { type: 'basic' });

        damageEnemy(armored, 150); // 200 -> down to 40 after armour

        expect(selectTarget('strongest', origin, 100)).toBe(basic);
    });
});

// ==================== PLATFORM INTEGRATION ====================

describe('platform targeting', () => {
    it('defaults a new platform to the default mode', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));
        expect(platform.targeting).toBe(DEFAULT_TARGETING);
    });

    it('changes which enemy the platform picks', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));

        const near = enemyAt(10, { progress: 0.1 });
        const advanced = enemyAt(50, { progress: 0.9 });

        expect(findTarget(platform)).toBe(near);

        setPlatformTargeting(platform, 'first');

        expect(findTarget(platform)).toBe(advanced);
    });

    it('refuses an invalid mode and leaves the platform alone', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));

        expect(setPlatformTargeting(platform, 'sideways')).toBe(false);
        expect(platform.targeting).toBe(DEFAULT_TARGETING);
    });

    // Otherwise the platform keeps tracking the enemy it had already acquired
    // and the change appears not to take effect until that one dies
    it('drops the current target so the change takes effect immediately', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
        enemyAt(10);

        platform.currentTarget = findTarget(platform);
        expect(platform.currentTarget).not.toBe(null);

        setPlatformTargeting(platform, 'first');

        expect(platform.currentTarget).toBe(null);
    });

    it('keeps each platform\'s priority independent', () => {
        const a = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
        const b = createPlatform('laserBattery', new THREE.Vector3(30, 0, 0));

        setPlatformTargeting(a, 'strongest');

        expect(a.targeting).toBe('strongest');
        expect(b.targeting).toBe(DEFAULT_TARGETING);
    });
});

// ==================== ALLOCATION ====================

describe('efficiency', () => {
    // This runs once per weapon per frame, forever. Building a filtered array
    // per call would be a dozen throwaway arrays every frame on a full board.
    it('handles a crowded board without choking', () => {
        for (let i = 0; i < 200; i++) {
            enemyAt(10 + (i % 80), { progress: (i % 100) / 100 });
        }

        for (const mode of TARGETING_MODES) {
            expect(selectTarget(mode, origin, 100)).not.toBe(null);
        }
    });
});
