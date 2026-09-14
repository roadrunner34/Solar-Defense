// @vitest-environment jsdom
/**
 * platform-combat.test.js - Platform targeting, firing and economy
 *
 * Sprint 2 Epics 3 and 4. Before this work platforms could be placed but never
 * did anything: nothing called them from the game loop, and they cost nothing
 * to build despite carrying a cost from the config.
 *
 * Needs a DOM because spawning enemies creates health-bar elements.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createScene } from '../js/scene.js';
import { initPaths } from '../js/path.js';
import { initEnemies, spawnEnemy, clearEnemies } from '../js/enemy.js';
import { initParticles } from '../js/particles.js';
import {
    createPlatform, platforms, clearAllPlatforms, updatePlatforms,
    findTarget, firePlatformProjectile, canAffordPlatform,
    sellPlatform, createPlacementPreview, updatePlacementPreview,
    confirmPlacement, removePlacementPreview, placementState, getSellValue
} from '../js/platform.js';
import { purchaseUpgrade } from '../js/upgrade.js';
import { initEconomy, getCredits, spendCredits } from '../js/economy.js';
import { CONFIG, getPlatformConfig } from '../js/config.js';

createScene();
initPaths();
initEnemies();
initParticles();

/** Put an enemy at a known spot rather than at its path start. */
function enemyAt(x, y, z, type = 'basic') {
    const enemy = spawnEnemy(type, 'default');
    enemy.mesh.position.set(x, y, z);
    return enemy;
}

beforeEach(() => {
    clearEnemies();
    clearAllPlatforms();
    removePlacementPreview();
    initEconomy();
});

describe('findTarget()', () => {
    it('returns null when nothing is in range', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));
        enemyAt(500, 0, 0);

        expect(findTarget(platform)).toBe(null);
    });

    it('returns null when there are no enemies at all', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));
        expect(findTarget(platform)).toBe(null);
    });

    it('returns the closest of several enemies in range', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));
        const near = enemyAt(25, 0, 0);
        enemyAt(60, 0, 0);

        expect(findTarget(platform)).toBe(near);
    });

    it('respects each platform type\'s range', () => {
        const laser = createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));
        const missile = createPlatform('missileLauncher', new THREE.Vector3(-20, 0, 0));

        // 90 units from the laser (range 80) but inside the missile's range 100
        enemyAt(20 + 90, 0, 0);
        expect(findTarget(laser)).toBe(null);

        clearEnemies();
        enemyAt(-20 + 90, 0, 0);
        expect(findTarget(missile)).not.toBe(null);
    });
});

describe('updatePlatforms()', () => {
    it('fires nothing when there are no targets', () => {
        createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));
        expect(updatePlatforms(1)).toEqual([]);
    });

    it('turns the turret toward its target', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
        enemyAt(40, 0, 0);

        const turret = platform.mesh.getObjectByName('turret');
        const before = turret.rotation.y;
        updatePlatforms(0.05);

        expect(turret.rotation.y).not.toBe(before);
    });

    it('fires once aimed and off cooldown', () => {
        createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
        enemyAt(40, 0, 0);

        // A large step both settles the aim and clears the cooldown
        const fired = updatePlatforms(1);
        expect(fired.length).toBe(1);
    });

    it('holds fire until the cooldown has elapsed', () => {
        createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
        enemyAt(40, 0, 0);

        updatePlatforms(1);                    // first shot
        expect(updatePlatforms(0.1)).toEqual([]); // 0.1s < 1/1.2s
    });

    it('honours each type\'s fire rate over time', () => {
        createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
        enemyAt(40, 0, 0);

        updatePlatforms(1); // settle aim and take the first shot

        let shots = 0;
        for (let i = 0; i < 600; i++) shots += updatePlatforms(1 / 60).length;

        // 10 seconds at 1.2 shots/sec
        expect(shots).toBeGreaterThanOrEqual(11);
        expect(shots).toBeLessThanOrEqual(13);
    });

    it('fires from every platform that has a target', () => {
        createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));
        createPlatform('laserBattery', new THREE.Vector3(-20, 0, 0));
        enemyAt(0, 0, 0);

        expect(updatePlatforms(1).length).toBe(2);
    });

    it('carries the platform\'s own damage and projectile speed', () => {
        createPlatform('missileLauncher', new THREE.Vector3(0, 0, 0));
        enemyAt(40, 0, 0);

        const [shot] = updatePlatforms(2);
        const config = getPlatformConfig('missileLauncher');

        expect(shot.damage).toBe(config.damage);
        expect(shot.speed).toBe(config.projectileSpeed);
        expect(shot.projectileType).toBe('missile');
    });

    // `source` identifies the individual platform, not its type. Two Laser
    // Batteries have to keep separate kill counts for the selection panel, so
    // the id is what a hit result is matched back against in main.js.
    it('tags each shot with the firing platform\'s instance id', () => {
        const first = createPlatform('laserBattery', new THREE.Vector3(20, 0, 0));
        const second = createPlatform('laserBattery', new THREE.Vector3(-20, 0, 0));
        enemyAt(0, 0, 0);

        const sources = updatePlatforms(2).map(shot => shot.source);

        expect(sources).toContain(`platform:${first.id}`);
        expect(sources).toContain(`platform:${second.id}`);
        expect(first.id).not.toBe(second.id);
    });

    it('counts the shots each platform has fired', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
        enemyAt(40, 0, 0);

        expect(platform.shotsFired).toBe(0);

        updatePlatforms(2);
        updatePlatforms(2);

        expect(platform.shotsFired).toBe(2);
    });

    it('aims a homing round at the enemy it acquired', () => {
        createPlatform('missileLauncher', new THREE.Vector3(0, 0, 0));
        const enemy = enemyAt(40, 0, 0);

        const [shot] = updatePlatforms(2);

        expect(shot.target).toBe(enemy);
    });

    it('stops firing at an enemy that leaves range', () => {
        createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
        const enemy = enemyAt(40, 0, 0);

        expect(updatePlatforms(1).length).toBe(1);
        enemy.mesh.position.set(500, 0, 0);
        expect(updatePlatforms(1)).toEqual([]);
    });

    it('ignores platforms that have been removed', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
        enemyAt(40, 0, 0);
        sellPlatform(platform);

        expect(updatePlatforms(1)).toEqual([]);
    });
});

describe('firePlatformProjectile()', () => {
    it('spawns from the muzzle, clear of the platform body', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
        const enemy = enemyAt(40, 0, 0);
        platform.mesh.updateMatrixWorld(true);

        const shot = firePlatformProjectile(platform, enemy);

        expect(shot.position.distanceTo(platform.position)).toBeGreaterThan(1);
    });

    it('aims the projectile at the target', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
        const enemy = enemyAt(40, 0, 0);
        platform.mesh.updateMatrixWorld(true);

        const shot = firePlatformProjectile(platform, enemy);
        const toTarget = new THREE.Vector3()
            .subVectors(enemy.mesh.position, shot.position)
            .normalize();

        expect(shot.direction.dot(toTarget)).toBeCloseTo(1, 5);
        expect(shot.direction.length()).toBeCloseTo(1, 5);
    });

    it('gives both platform types a muzzle to fire from', () => {
        for (const type of ['laserBattery', 'missileLauncher']) {
            const platform = createPlatform(type, new THREE.Vector3(0, 0, 0));
            expect(platform.mesh.getObjectByName('muzzle')).toBeDefined();
            clearAllPlatforms();
        }
    });
});

describe('platform purchasing', () => {
    /** Enter placement mode at a known valid spot. */
    function beginPlacement(type, position = new THREE.Vector3(30, 0, 0)) {
        createPlacementPreview(type);
        updatePlacementPreview(position);
    }

    it('charges the platform\'s cost on placement', () => {
        const before = getCredits();
        beginPlacement('laserBattery');

        expect(confirmPlacement()).not.toBe(null);
        expect(getCredits()).toBe(before - CONFIG.platforms.laserBattery.cost);
    });

    it('refuses placement the player cannot afford, and builds nothing', () => {
        spendCredits(getCredits()); // broke
        beginPlacement('missileLauncher');

        expect(confirmPlacement()).toBe(null);
        expect(platforms.length).toBe(0);
    });

    it('explains why an unaffordable placement failed', () => {
        spendCredits(getCredits());
        beginPlacement('missileLauncher');
        confirmPlacement();

        expect(placementState.lastError).toMatch(/credits/i);
    });

    it('does not charge for a placement rejected on position', () => {
        const before = getCredits();
        beginPlacement('laserBattery', new THREE.Vector3(0, 0, 0)); // inside the planet

        expect(confirmPlacement()).toBe(null);
        expect(getCredits()).toBe(before);
        expect(placementState.lastError).toMatch(/planet/i);
    });

    it('charges separately for each platform placed', () => {
        const before = getCredits();
        const cost = CONFIG.platforms.laserBattery.cost;

        beginPlacement('laserBattery', new THREE.Vector3(30, 0, 0));
        confirmPlacement();
        beginPlacement('laserBattery', new THREE.Vector3(-30, 0, 0));
        confirmPlacement();

        expect(getCredits()).toBe(before - cost * 2);
    });
});

describe('canAffordPlatform()', () => {
    it('is true with a full purse and false with an empty one', () => {
        expect(canAffordPlatform('laserBattery')).toBe(true);

        spendCredits(getCredits());
        expect(canAffordPlatform('laserBattery')).toBe(false);
    });

    it('can be true for the cheap platform and false for the dear one', () => {
        initEconomy(CONFIG.platforms.laserBattery.cost);

        expect(canAffordPlatform('laserBattery')).toBe(true);
        expect(canAffordPlatform('missileLauncher')).toBe(false);
    });
});

describe('sellPlatform()', () => {
    it('refunds half the cost and removes the platform', () => {
        const platform = createPlatform('missileLauncher', new THREE.Vector3(30, 0, 0));
        const before = getCredits();

        const refund = sellPlatform(platform);

        expect(refund).toBe(Math.floor(CONFIG.platforms.missileLauncher.cost * 0.5));
        expect(getCredits()).toBe(before + refund);
        expect(platforms).not.toContain(platform);
        expect(platform.alive).toBe(false);
    });

    it('refuses to sell the same platform twice', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(30, 0, 0));
        sellPlatform(platform);

        const before = getCredits();
        expect(sellPlatform(platform)).toBe(0);
        expect(getCredits()).toBe(before);
    });

    it('frees the space for a new platform', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(30, 0, 0));
        sellPlatform(platform);

        createPlacementPreview('laserBattery');
        updatePlacementPreview(new THREE.Vector3(30, 0, 0));

        expect(confirmPlacement()).not.toBe(null);
    });
});

describe('sell value and upgrades', () => {
    it('refunds half of a fresh platform\'s build cost', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(30, 0, 0));
        const cost = getPlatformConfig('laserBattery').cost;

        expect(getSellValue(platform)).toBe(Math.floor(cost * 0.5));
    });

    // Without this, relocating a platform you have poured credits into costs
    // you all of that investment - so the only rational play becomes never
    // upgrading anything you might later want to move
    it('includes what has been spent on upgrades', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(30, 0, 0));
        const fresh = getSellValue(platform);

        initEconomy(5000);
        purchaseUpgrade(platform, 'damage', getPlatformConfig('laserBattery'), () => {});

        expect(getSellValue(platform)).toBeGreaterThan(fresh);
    });

    it('pays the quoted amount when actually sold', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(30, 0, 0));

        initEconomy(0);
        const quoted = getSellValue(platform);
        const paid = sellPlatform(platform);

        expect(paid).toBe(quoted);
        expect(getCredits()).toBe(quoted);
    });

    it('removes the platform from the board', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(30, 0, 0));

        sellPlatform(platform);

        expect(platforms).not.toContain(platform);
        expect(platform.alive).toBe(false);
    });

    it('refunds nothing for a platform already sold', () => {
        const platform = createPlatform('laserBattery', new THREE.Vector3(30, 0, 0));

        sellPlatform(platform);

        expect(sellPlatform(platform)).toBe(0);
        expect(getSellValue(platform)).toBe(0);
    });
});
