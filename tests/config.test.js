/**
 * config.test.js - Game configuration
 *
 * Ported from the original tests/config/platform-config.test.js, which
 * verified Sprint 2 Task 1.1 with a hand-rolled pass/fail counter.
 */

import { describe, it, expect } from 'vitest';
import { CONFIG, getPlatformConfig, getEnemyConfig, getWaveConfig } from '../js/config.js';

describe('platform config', () => {
    it('defines a platforms section', () => {
        expect(CONFIG.platforms).toBeDefined();
    });

    it('gives the Laser Battery its documented stats', () => {
        expect(CONFIG.platforms.laserBattery).toMatchObject({
            damage: 20,
            range: 80,
            fireRate: 1.2,
            cost: 50
        });
    });

    it('gives the Missile Launcher its documented stats', () => {
        expect(CONFIG.platforms.missileLauncher).toMatchObject({
            damage: 40,
            range: 100,
            fireRate: 0.8,
            cost: 100
        });
    });

    it('trades damage for fire rate between the two platform types', () => {
        const { laserBattery, missileLauncher } = CONFIG.platforms;
        expect(missileLauncher.damage).toBeGreaterThan(laserBattery.damage);
        expect(missileLauncher.fireRate).toBeLessThan(laserBattery.fireRate);
        expect(missileLauncher.cost).toBeGreaterThan(laserBattery.cost);
    });
});

describe('getPlatformConfig()', () => {
    it('returns the laserBattery config', () => {
        expect(getPlatformConfig('laserBattery').damage).toBe(20);
    });

    it('returns the missileLauncher config', () => {
        expect(getPlatformConfig('missileLauncher').damage).toBe(40);
    });

    it('falls back to laserBattery for an unknown type', () => {
        expect(getPlatformConfig('invalidType').damage).toBe(20);
    });
});

describe('getEnemyConfig()', () => {
    it('returns each enemy type', () => {
        expect(getEnemyConfig('basic').health).toBe(100);
        expect(getEnemyConfig('fast').speed).toBe(10);
        expect(getEnemyConfig('armored').armor).toBe(10);
    });

    it('falls back to basic for an unknown type', () => {
        expect(getEnemyConfig('nope')).toBe(CONFIG.enemies.basic);
    });
});

describe('getWaveConfig()', () => {
    it('returns the authored waves 1-5', () => {
        for (let wave = 1; wave <= 5; wave++) {
            expect(getWaveConfig(wave).enemies.length).toBeGreaterThan(0);
        }
    });

    it('generates a scaled wave beyond the authored ones', () => {
        const wave6 = getWaveConfig(6);
        expect(wave6.enemies.length).toBe(3);
        expect(wave6.bonusCredits).toBeGreaterThan(CONFIG.waves[5].bonusCredits);
    });
});
