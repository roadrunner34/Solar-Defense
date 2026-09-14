// @vitest-environment jsdom

/**
 * status.test.js - Temporary effects on enemies
 *
 * Needs a DOM because spawning enemies creates health-bar elements.
 *
 * Two properties matter most here and both are guarded directly:
 *
 *   - Effects REFRESH rather than stack. Stacking is simpler to write and
 *     completely broken - see minSpeedMultiplier below.
 *   - The aggregate slow is floored. An enemy at zero speed never reaches the
 *     planet and never dies, so the wave never ends: a softlock, not difficulty.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';

import { createScene } from '../js/scene.js';
import { initPaths } from '../js/path.js';
import {
    initEnemies, spawnEnemy, clearEnemies, updateEnemies, damageEnemy, enemies,
    refreshStatusVisual
} from '../js/enemy.js';
import { initParticles } from '../js/particles.js';

import {
    applyStatus, updateStatuses, getSpeedMultiplier, getArmorReduction,
    hasStatus, getStatuses, clearStatuses, STATUS_SLOW, STATUS_ARMOR_SHRED
} from '../js/status.js';

import {
    createPlatform, clearAllPlatforms, updatePlatforms
} from '../js/platform.js';

import { initEconomy } from '../js/economy.js';
import { CONFIG } from '../js/config.js';

createScene();
initPaths();
initEnemies();
initParticles();

function enemyAt(x, type = 'basic') {
    const enemy = spawnEnemy(type, 'default');
    enemy.mesh.position.set(x, 0, 0);
    return enemy;
}

beforeEach(() => {
    clearEnemies();
    clearAllPlatforms();
    initEconomy();
});

// ==================== APPLYING ====================

describe('applyStatus()', () => {
    it('puts an effect on an enemy', () => {
        const enemy = enemyAt(10);

        expect(applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.4 })).toBe(true);
        expect(hasStatus(enemy, STATUS_SLOW)).toBe(true);
    });

    it('leaves an enemy with no effects alone', () => {
        const enemy = enemyAt(10);

        expect(hasStatus(enemy, STATUS_SLOW)).toBe(false);
        expect(getSpeedMultiplier(enemy)).toBe(1);
        expect(getArmorReduction(enemy)).toBe(0);
    });

    it('refuses to affect a dead enemy', () => {
        const enemy = enemyAt(10);
        damageEnemy(enemy, 99999);

        expect(applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.4 })).toBe(false);
    });

    it('rejects a zero or negative magnitude', () => {
        const enemy = enemyAt(10);

        expect(applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0 })).toBe(false);
        expect(applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: -1 })).toBe(false);
    });

    it('rejects a zero or negative duration', () => {
        const enemy = enemyAt(10);

        expect(applyStatus(enemy, STATUS_SLOW, { duration: 0, magnitude: 0.4 })).toBe(false);
    });

    it('allocates nothing until an effect is actually applied', () => {
        const enemy = enemyAt(10);
        expect(enemy.statuses).toBeNull();
    });
});

// ==================== REFRESH, NOT STACK ====================

describe('re-applying an effect', () => {
    // Three overlapping Gravity Wells must give one good slow, not a 120% slow
    it('does not add a second copy', () => {
        const enemy = enemyAt(10);

        applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.4 });
        applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.4 });
        applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.4 });

        expect(getStatuses(enemy).length).toBe(1);
        expect(getSpeedMultiplier(enemy)).toBeCloseTo(0.6);
    });

    it('keeps the stronger magnitude', () => {
        const enemy = enemyAt(10);

        applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.5 });
        applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.2 });

        expect(getSpeedMultiplier(enemy)).toBeCloseTo(0.5);
    });

    it('keeps the longer remaining time', () => {
        const enemy = enemyAt(10);

        applyStatus(enemy, STATUS_SLOW, { duration: 5, magnitude: 0.4 });
        applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.4 });

        expect(getStatuses(enemy)[0].remaining).toBe(5);
    });

    it('keeps different effect types separate', () => {
        const enemy = enemyAt(10, 'armored');

        applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.4 });
        applyStatus(enemy, STATUS_ARMOR_SHRED, { duration: 1, magnitude: 10 });

        expect(getStatuses(enemy).length).toBe(2);
        expect(getSpeedMultiplier(enemy)).toBeCloseTo(0.6);
        expect(getArmorReduction(enemy)).toBe(10);
    });
});

// ==================== EXPIRY ====================

describe('updateStatuses()', () => {
    it('runs an effect down and removes it', () => {
        const enemy = enemyAt(10);
        applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.4 });

        updateStatuses(enemy, 0.5);
        expect(hasStatus(enemy, STATUS_SLOW)).toBe(true);

        updateStatuses(enemy, 0.6);
        expect(hasStatus(enemy, STATUS_SLOW)).toBe(false);
    });

    it('reports when something expired', () => {
        const enemy = enemyAt(10);
        applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.4 });

        expect(updateStatuses(enemy, 0.5)).toBe(false);
        expect(updateStatuses(enemy, 0.6)).toBe(true);
    });

    it('restores full speed once the effect is gone', () => {
        const enemy = enemyAt(10);
        applyStatus(enemy, STATUS_SLOW, { duration: 0.5, magnitude: 0.4 });

        updateStatuses(enemy, 1);

        expect(getSpeedMultiplier(enemy)).toBe(1);
    });

    it('is cheap on an enemy with nothing applied', () => {
        const enemy = enemyAt(10);
        expect(updateStatuses(enemy, 1)).toBe(false);
    });

    it('removes several expired effects in one step', () => {
        const enemy = enemyAt(10, 'armored');

        applyStatus(enemy, STATUS_SLOW, { duration: 0.5, magnitude: 0.4 });
        applyStatus(enemy, STATUS_ARMOR_SHRED, { duration: 0.5, magnitude: 10 });

        updateStatuses(enemy, 1);

        expect(getStatuses(enemy).length).toBe(0);
    });
});

// ==================== THE SPEED FLOOR ====================

describe('the speed floor', () => {
    // The softlock guard. An enemy at zero speed never reaches the planet and
    // never leaves, so the wave-complete check never fires and the run is stuck.
    it('never stops an enemy completely', () => {
        const enemy = enemyAt(10);
        applyStatus(enemy, STATUS_SLOW, { duration: 10, magnitude: 1 });

        expect(getSpeedMultiplier(enemy)).toBe(CONFIG.status.minSpeedMultiplier);
        expect(getSpeedMultiplier(enemy)).toBeGreaterThan(0);
    });

    it('holds the floor against an absurd magnitude', () => {
        const enemy = enemyAt(10);
        applyStatus(enemy, STATUS_SLOW, { duration: 10, magnitude: 50 });

        expect(getSpeedMultiplier(enemy)).toBe(CONFIG.status.minSpeedMultiplier);
    });

    it('still moves a fully slowed enemy along its path', () => {
        const enemy = enemyAt(10);
        applyStatus(enemy, STATUS_SLOW, { duration: 100, magnitude: 1 });

        const before = enemy.pathProgress;
        updateEnemies(0.5);

        expect(enemy.pathProgress).toBeGreaterThan(before);
    });
});

// ==================== RESISTANCE ====================

describe('status resistance', () => {
    it('weakens an effect on a resistant enemy', () => {
        const enemy = enemyAt(10);
        enemy.statusResistance = 0.5;

        applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.4 });

        expect(getSpeedMultiplier(enemy)).toBeCloseTo(0.8);
    });

    it('makes a fully resistant enemy immune', () => {
        const enemy = enemyAt(10);
        enemy.statusResistance = 1;

        expect(applyStatus(enemy, STATUS_SLOW, { duration: 1, magnitude: 0.4 })).toBe(false);
        expect(getSpeedMultiplier(enemy)).toBe(1);
    });
});

// ==================== INTEGRATION WITH MOVEMENT AND DAMAGE ====================

describe('effect on movement', () => {
    it('moves a slowed enemy less far than an unslowed one', () => {
        const slowed = enemyAt(10);
        const normal = enemyAt(12);

        applyStatus(slowed, STATUS_SLOW, { duration: 10, magnitude: 0.5 });

        updateEnemies(0.5);

        expect(slowed.pathProgress).toBeLessThan(normal.pathProgress);
    });

    // The base speed must stay intact. Writing the effect onto enemy.speed
    // could never be undone exactly, and two overlapping fields would compound.
    it('leaves the enemy\'s base speed untouched', () => {
        const enemy = enemyAt(10);
        const baseSpeed = enemy.speed;

        applyStatus(enemy, STATUS_SLOW, { duration: 10, magnitude: 0.5 });
        updateEnemies(0.5);

        expect(enemy.speed).toBe(baseSpeed);
    });
});

describe('effect on damage', () => {
    it('lets a weak shot through an armoured enemy once shredded', () => {
        const armored = enemyAt(10, 'armored');
        const before = armored.health;

        // A Laser Battery's 20 damage lands as 10 against 10 armour
        damageEnemy(armored, 20);
        const unshredded = before - armored.health;

        const second = enemyAt(20, 'armored');
        applyStatus(second, STATUS_ARMOR_SHRED, { duration: 5, magnitude: 10 });

        const secondBefore = second.health;
        damageEnemy(second, 20);
        const shredded = secondBefore - second.health;

        expect(unshredded).toBe(10);
        expect(shredded).toBe(20);
    });

    // Shredding more armour than an enemy has should make it unarmoured, not
    // hand the attacker a bonus on top
    it('never turns armour into a damage bonus', () => {
        const basic = enemyAt(10, 'basic'); // 0 armour
        applyStatus(basic, STATUS_ARMOR_SHRED, { duration: 5, magnitude: 40 });

        const before = basic.health;
        damageEnemy(basic, 20);

        expect(before - basic.health).toBe(20);
    });
});

// ==================== THE GRAVITY WELL ====================

describe('the Gravity Well', () => {
    const wellAt = (x) =>
        createPlatform('gravityWell', new THREE.Vector3(x, 0, 0));

    it('is configured as an aura, not a turret', () => {
        const well = wellAt(20);
        expect(well.behaviour).toBe('aura');
    });

    it('has no damage or fire rate', () => {
        const well = wellAt(20);

        expect(well.damage).toBeUndefined();
        expect(well.fireRate).toBeUndefined();
    });

    it('fires no projectiles', () => {
        wellAt(20);
        enemyAt(20);

        expect(updatePlatforms(1)).toEqual([]);
    });

    it('has no turret or muzzle in its mesh', () => {
        const well = wellAt(20);

        expect(well.mesh.getObjectByName('turret')).toBeUndefined();
        expect(well.mesh.getObjectByName('muzzle')).toBeUndefined();
    });

    it('slows enemies inside its radius', () => {
        wellAt(20);
        const enemy = enemyAt(25);

        updatePlatforms(CONFIG.status.auraTickSeconds + 0.01);

        expect(hasStatus(enemy, STATUS_SLOW)).toBe(true);
        expect(getSpeedMultiplier(enemy)).toBeLessThan(1);
    });

    it('leaves enemies outside its radius alone', () => {
        const well = wellAt(20);
        const enemy = enemyAt(20 + well.range + 10);

        updatePlatforms(CONFIG.status.auraTickSeconds + 0.01);

        expect(hasStatus(enemy, STATUS_SLOW)).toBe(false);
    });

    it('reports how many enemies it is affecting', () => {
        const well = wellAt(20);
        enemyAt(22);
        enemyAt(25);

        updatePlatforms(CONFIG.status.auraTickSeconds + 0.01);

        expect(well.affecting).toBe(2);
    });

    // The effect's duration is configured longer than the tick interval, so an
    // enemy sitting in the field stays continuously slowed rather than
    // flickering between ticks
    it('keeps an enemy slowed between ticks', () => {
        const wellPlatform = wellAt(20);
        const enemy = enemyAt(25);

        updatePlatforms(CONFIG.status.auraTickSeconds + 0.01);

        expect(wellPlatform.duration).toBeGreaterThan(CONFIG.status.auraTickSeconds);
        expect(hasStatus(enemy, STATUS_SLOW)).toBe(true);
    });

    it('does not re-apply on every frame', () => {
        wellAt(20);
        const enemy = enemyAt(25);

        // A step far shorter than the tick interval
        updatePlatforms(0.01);

        expect(hasStatus(enemy, STATUS_SLOW)).toBe(false);
    });

    it('turns its rings so it does not look inert', () => {
        const well = wellAt(20);
        const outer = well.mesh.getObjectByName('ringOuter');
        const inner = well.mesh.getObjectByName('ringInner');

        const outerBefore = outer.rotation.z;
        const innerBefore = inner.rotation.z;

        updatePlatforms(0.1);

        expect(outer.rotation.z).not.toBe(outerBefore);
        expect(inner.rotation.z).not.toBe(innerBefore);

        // Opposed, so the thing reads as a field being held open rather than
        // one rigid object turning
        expect(Math.sign(outer.rotation.z - outerBefore))
            .not.toBe(Math.sign(inner.rotation.z - innerBefore));
    });

    it('does not compound when several overlap', () => {
        wellAt(20);
        wellAt(35);
        wellAt(50);

        const enemy = enemyAt(35);

        updatePlatforms(CONFIG.status.auraTickSeconds + 0.01);

        expect(getStatuses(enemy).length).toBe(1);
        expect(getSpeedMultiplier(enemy))
            .toBeGreaterThanOrEqual(CONFIG.status.minSpeedMultiplier);
    });
});

// ==================== THE VISUAL TELL ====================

/**
 * A status effect the player cannot see is indistinguishable from a bug.
 *
 * A Gravity Well does no damage and spawns no projectile, so without a visible
 * change on the enemies themselves the only evidence it works at all is a
 * subtle difference in how fast shapes cross the screen - which nobody can read.
 */
describe('the slow tint', () => {
    it('changes a slowed enemy\'s colour', () => {
        const enemy = enemyAt(10);
        const before = enemy.mesh.material.color.clone();

        applyStatus(enemy, STATUS_SLOW, { duration: 5, magnitude: 0.4 });
        refreshStatusVisual(enemy);

        expect(enemy.mesh.material.color.equals(before)).toBe(false);
    });

    it('restores the exact original colour when the slow expires', () => {
        const enemy = enemyAt(10);
        const before = enemy.mesh.material.color.clone();

        applyStatus(enemy, STATUS_SLOW, { duration: 0.5, magnitude: 0.4 });
        refreshStatusVisual(enemy);

        updateStatuses(enemy, 1);
        refreshStatusVisual(enemy);

        expect(enemy.mesh.material.color.equals(before)).toBe(true);
    });

    // Repeated application must not drift the colour further each time - that
    // would leave an enemy that sat in a field for a while permanently wrong
    it('does not compound over repeated refreshes', () => {
        const enemy = enemyAt(10);

        applyStatus(enemy, STATUS_SLOW, { duration: 5, magnitude: 0.4 });
        refreshStatusVisual(enemy);
        const once = enemy.mesh.material.color.clone();

        for (let i = 0; i < 10; i++) refreshStatusVisual(enemy);

        expect(enemy.mesh.material.color.equals(once)).toBe(true);
    });

    it('keeps enemy types distinguishable while slowed', () => {
        const basic = enemyAt(10, 'basic');
        const fast = enemyAt(20, 'fast');

        for (const enemy of [basic, fast]) {
            applyStatus(enemy, STATUS_SLOW, { duration: 5, magnitude: 0.4 });
            refreshStatusVisual(enemy);
        }

        expect(basic.mesh.material.color.equals(fast.mesh.material.color)).toBe(false);
    });
});

// ==================== CLEANUP ====================

describe('cleanup', () => {
    it('clears effects when an enemy is removed', () => {
        const enemy = enemyAt(10);
        applyStatus(enemy, STATUS_SLOW, { duration: 10, magnitude: 0.4 });

        damageEnemy(enemy, 99999);

        expect(getStatuses(enemy).length).toBe(0);
    });

    it('clearStatuses() is safe on an enemy with none', () => {
        const enemy = enemyAt(10);
        expect(() => clearStatuses(enemy)).not.toThrow();
    });
});
