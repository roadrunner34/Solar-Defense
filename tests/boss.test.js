// @vitest-environment jsdom

/**
 * boss.test.js - Boss enemies
 *
 * Needs a DOM because spawning enemies creates health-bar elements, and the
 * boss bar is a HUD element.
 *
 * Endless mode had no shape before this: wave 23 played exactly like wave 22,
 * only with more of everything. These tests cover the schedule, the scaling,
 * and the two structural constraints a boss has to respect - it must be one
 * mesh rather than a Group, and it must not be neutralisable by support
 * platforms alone.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';

import { createScene } from '../js/scene.js';
import { initPaths } from '../js/path.js';
import {
    initEnemies, spawnEnemy, clearEnemies, damageEnemy, enemies
} from '../js/enemy.js';
import { initParticles } from '../js/particles.js';

import {
    applyStatus, getSpeedMultiplier, getArmorReduction, STATUS_SLOW, STATUS_ARMOR_SHRED
} from '../js/status.js';

import { initUI, showBossBar, updateBossBar, hideBossBar, isBossBarVisible } from '../js/ui.js';
import { CONFIG, isBossWave, getBossHealthScale } from '../js/config.js';
import { initEconomy } from '../js/economy.js';

createScene();
initPaths();
initEnemies();
initParticles();

beforeEach(() => {
    clearEnemies();
    initEconomy();
});

// ==================== THE SCHEDULE ====================

describe('isBossWave()', () => {
    it('caps the authored campaign', () => {
        expect(isBossWave(5)).toBe(true);
    });

    it('leaves the earlier waves alone', () => {
        for (const wave of [1, 2, 3, 4]) {
            expect(isBossWave(wave)).toBe(false);
        }
    });

    it('keeps returning through endless mode', () => {
        expect(isBossWave(10)).toBe(true);
        expect(isBossWave(15)).toBe(true);
        expect(isBossWave(50)).toBe(true);
    });

    it('does not fire on the waves between', () => {
        expect(isBossWave(6)).toBe(false);
        expect(isBossWave(9)).toBe(false);
        expect(isBossWave(11)).toBe(false);
    });

    it('is not tripped by a zero or negative wave', () => {
        expect(isBossWave(0)).toBe(false);
        expect(isBossWave(-5)).toBe(false);
    });
});

describe('getBossHealthScale()', () => {
    it('gives the first boss its base health', () => {
        expect(getBossHealthScale(CONFIG.bosses.everyWaves)).toBe(1);
    });

    it('makes each appearance harder than the last', () => {
        const first = getBossHealthScale(5);
        const second = getBossHealthScale(10);
        const third = getBossHealthScale(15);

        expect(second).toBeGreaterThan(first);
        expect(third).toBeGreaterThan(second);
    });

    // Linear rather than compounding: a compounding curve makes the tenth boss
    // unkillable while the third is still trivial
    it('grows linearly rather than compounding', () => {
        const stepOne = getBossHealthScale(10) - getBossHealthScale(5);
        const stepTwo = getBossHealthScale(15) - getBossHealthScale(10);

        expect(stepTwo).toBeCloseTo(stepOne);
    });

    it('returns 1 for a wave with no boss', () => {
        expect(getBossHealthScale(7)).toBe(1);
    });
});

// ==================== SPAWNING ====================

describe('spawning a boss', () => {
    it('marks it as a boss', () => {
        const boss = spawnEnemy('boss', 'default');

        expect(boss.isBoss).toBe(true);
        expect(typeof boss.displayName).toBe('string');
    });

    it('scales its health', () => {
        const base = spawnEnemy('boss', 'default');
        const scaled = spawnEnemy('boss', 'default', { healthScale: 2 });

        expect(scaled.maxHealth).toBe(base.maxHealth * 2);
        expect(scaled.health).toBe(scaled.maxHealth);
    });

    it('defaults to unscaled health', () => {
        const boss = spawnEnemy('boss', 'default');
        expect(boss.maxHealth).toBe(CONFIG.enemies.boss.health);
    });

    it('does not scale a regular enemy by accident', () => {
        const basic = spawnEnemy('basic', 'default');
        expect(basic.maxHealth).toBe(CONFIG.enemies.basic.health);
    });

    it('is far tougher than anything else on the board', () => {
        const boss = spawnEnemy('boss', 'default');
        const armored = spawnEnemy('armored', 'default');

        expect(boss.maxHealth).toBeGreaterThan(armored.maxHealth * 5);
    });

    it('is worth substantially more than a regular kill', () => {
        expect(CONFIG.economy.creditsPerKill.boss)
            .toBeGreaterThan(CONFIG.economy.creditsPerKill.armored);
        expect(CONFIG.scoring.pointsPerKill.boss)
            .toBeGreaterThan(CONFIG.scoring.pointsPerKill.armored);
    });
});

// ==================== THE MESH CONSTRAINT ====================

/**
 * damageEnemy(), flashEnemy() and removeEnemy() all reach straight for
 * enemy.mesh.material. A boss built as a THREE.Group has no material at all and
 * would break the hit flash, the damage path and the disposal in one go.
 */
describe('the boss mesh', () => {
    it('is a single mesh, not a group', () => {
        const boss = spawnEnemy('boss', 'default');

        expect(boss.mesh.isMesh).toBe(true);
        expect(boss.mesh.material).toBeDefined();
    });

    it('carries its decoration as children', () => {
        const boss = spawnEnemy('boss', 'default');

        expect(boss.mesh.getObjectByName('bossCore')).toBeDefined();
        expect(boss.mesh.getObjectByName('bossRing0')).toBeDefined();
    });

    it('takes damage and flashes like any other enemy', () => {
        const boss = spawnEnemy('boss', 'default');
        const before = boss.health;

        expect(() => damageEnemy(boss, 100)).not.toThrow();
        expect(boss.health).toBeLessThan(before);
    });

    it('has a silhouette no other enemy uses', () => {
        const boss = spawnEnemy('boss', 'default');
        const others = ['basic', 'fast', 'armored'].map(t => spawnEnemy(t, 'default'));

        for (const other of others) {
            expect(boss.mesh.geometry).not.toBe(other.mesh.geometry);
        }
    });

    it('is removed cleanly', () => {
        const boss = spawnEnemy('boss', 'default');

        expect(() => damageEnemy(boss, 999999)).not.toThrow();
        expect(enemies.includes(boss)).toBe(false);
    });
});

// ==================== STATUS RESISTANCE ====================

/**
 * Without resistance, a pair of Gravity Wells trivialises the fight: the boss
 * is slow already, and slowing it further just means it spends longer being
 * shot at with no way to threaten anything.
 */
describe('status resistance', () => {
    it('resists slows far more than a regular enemy', () => {
        const boss = spawnEnemy('boss', 'default');
        const basic = spawnEnemy('basic', 'default');

        applyStatus(boss, STATUS_SLOW, { duration: 5, magnitude: 0.5 });
        applyStatus(basic, STATUS_SLOW, { duration: 5, magnitude: 0.5 });

        expect(getSpeedMultiplier(boss)).toBeGreaterThan(getSpeedMultiplier(basic));
    });

    it('is still slowed somewhat, so support platforms are not useless', () => {
        const boss = spawnEnemy('boss', 'default');
        applyStatus(boss, STATUS_SLOW, { duration: 5, magnitude: 0.5 });

        expect(getSpeedMultiplier(boss)).toBeLessThan(1);
    });

    it('resists armour shred too', () => {
        const boss = spawnEnemy('boss', 'default');
        const armored = spawnEnemy('armored', 'default');

        applyStatus(boss, STATUS_ARMOR_SHRED, { duration: 5, magnitude: 12 });
        applyStatus(armored, STATUS_ARMOR_SHRED, { duration: 5, magnitude: 12 });

        expect(getArmorReduction(boss)).toBeLessThan(getArmorReduction(armored));
    });

    it('cannot be fully neutralised by stacked fields', () => {
        const boss = spawnEnemy('boss', 'default');

        for (let i = 0; i < 10; i++) {
            applyStatus(boss, STATUS_SLOW, { duration: 5, magnitude: 0.5 });
        }

        // Refresh-not-stack plus resistance keeps it well above the global floor
        expect(getSpeedMultiplier(boss))
            .toBeGreaterThan(CONFIG.status.minSpeedMultiplier);
    });
});

// ==================== THE HUD BAR ====================

describe('the boss bar', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="hud">
                <div id="wave-number"></div>
                <div id="enemies-remaining"></div>
                <div id="score"></div>
                <div id="credits"></div>
                <div id="boss-bar" hidden>
                    <div id="boss-name"></div>
                    <div class="boss-meter"><div class="boss-fill" id="boss-fill"></div></div>
                </div>
            </div>
        `;
        initUI();
    });

    const bar = () => document.getElementById('boss-bar');
    const fill = () => document.getElementById('boss-fill');

    it('starts hidden', () => {
        expect(isBossBarVisible()).toBe(false);
    });

    it('shows with the boss name', () => {
        showBossBar('Dreadnought');

        expect(isBossBarVisible()).toBe(true);
        expect(document.getElementById('boss-name').textContent).toBe('Dreadnought');
    });

    it('starts full', () => {
        showBossBar('Dreadnought');
        expect(fill().style.width).toBe('100%');
    });

    it('tracks the fraction it is given', () => {
        showBossBar('Dreadnought');
        updateBossBar(0.5);

        expect(fill().style.width).toBe('50%');
    });

    it('clamps out-of-range fractions', () => {
        showBossBar('Dreadnought');

        updateBossBar(5);
        expect(fill().style.width).toBe('100%');

        updateBossBar(-2);
        expect(fill().style.width).toBe('0%');
    });

    // Colour shifts so the state of the fight is readable from peripheral
    // vision, without measuring the bar's length
    it('marks the bar wounded and then critical', () => {
        showBossBar('Dreadnought');

        updateBossBar(0.9);
        expect(fill().classList.contains('wounded')).toBe(false);
        expect(fill().classList.contains('critical')).toBe(false);

        updateBossBar(0.5);
        expect(fill().classList.contains('wounded')).toBe(true);

        updateBossBar(0.1);
        expect(fill().classList.contains('critical')).toBe(true);
        expect(fill().classList.contains('wounded')).toBe(false);
    });

    it('hides again', () => {
        showBossBar('Dreadnought');
        hideBossBar();

        expect(isBossBarVisible()).toBe(false);
    });

    it('does not throw when the HUD has no boss bar', () => {
        document.body.innerHTML = '<div id="hud"></div>';
        initUI();

        expect(() => showBossBar('Dreadnought')).not.toThrow();
        expect(() => updateBossBar(0.5)).not.toThrow();
        expect(() => hideBossBar()).not.toThrow();
    });
});

// ==================== BALANCE ====================

/**
 * The boss's armour is the one number here that playtesting moved, and the
 * reason is worth keeping a test for.
 *
 * damageEnemy() floors every hit at 1. Armour of 20 against a Laser Battery's
 * 20 damage therefore landed as exactly 1 - seven platforms took a full minute
 * to remove a third of the boss, and the only feedback the player got was that
 * their guns had stopped working.
 */
describe('boss armour', () => {
    it('leaves the cheapest weapon visibly blunted rather than useless', () => {
        const laser = CONFIG.platforms.laserBattery.damage;
        const landed = laser - CONFIG.enemies.boss.armor;

        // Above the floor, so the reduction is legible in the damage numbers
        expect(landed).toBeGreaterThan(1);

        // But still a serious penalty - this is what makes the counter matter
        expect(landed).toBeLessThan(laser / 2);
    });

    it('lets a Disruptor multiply the cheapest weapon several times over', () => {
        const laser = CONFIG.platforms.laserBattery.damage;
        const armour = CONFIG.enemies.boss.armor;
        const shred = CONFIG.platforms.disruptor.magnitude
            * (1 - CONFIG.enemies.boss.statusResistance);

        const without = Math.max(1, laser - armour);
        const with_ = Math.max(1, laser - Math.max(0, armour - shred));

        expect(with_).toBeGreaterThan(without * 1.5);
    });

    it('does not wall out a Missile Launcher', () => {
        const missile = CONFIG.platforms.missileLauncher.damage;
        const landed = missile - CONFIG.enemies.boss.armor;

        // The expensive weapon should stay clearly the right tool
        expect(landed).toBeGreaterThan(missile / 2);
    });
});
