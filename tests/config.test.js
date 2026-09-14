/**
 * config.test.js - Game configuration
 *
 * Ported from the original tests/config/platform-config.test.js, which
 * verified Sprint 2 Task 1.1 with a hand-rolled pass/fail counter.
 */

import { describe, it, expect } from 'vitest';
import { CONFIG, getPlatformConfig, getEnemyConfig, getWaveConfig , getWaveFlavour, describeWaveComposition } from '../js/config.js';

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

describe('endless waves', () => {
    /** Total enemies across every group in a wave. */
    const enemyCount = (wave) =>
        getWaveConfig(wave).enemies.reduce((total, group) => total + group.count, 0);

    it('never gets easier as the waves go on', () => {
        // The old generator scaled on floor(wave / 5), which held flat for four
        // waves and then doubled. This checks the ramp is monotonic.
        for (let wave = 6; wave < 40; wave++) {
            expect(enemyCount(wave)).toBeGreaterThanOrEqual(enemyCount(wave - 1));
        }
    });

    it('steps up from wave 5 rather than jumping', () => {
        const authored = enemyCount(5);
        const first = enemyCount(6);

        expect(first).toBeGreaterThan(authored);

        // The old curve doubled here. Anything near that is a cliff, not a ramp.
        expect(first).toBeLessThan(authored * 1.6);
    });

    it('raises the bonus alongside the difficulty', () => {
        for (let wave = 7; wave < 30; wave++) {
            expect(getWaveConfig(wave).bonusCredits)
                .toBeGreaterThan(getWaveConfig(wave - 1).bonusCredits);
        }
    });

    // Without a floor the spawn delay tends toward zero and a late wave arrives
    // as one instantaneous block, which is not difficulty - it is a dropped frame
    it('keeps a floor under the spawn spacing however deep the run goes', () => {
        for (const group of getWaveConfig(500).enemies) {
            expect(group.spawnDelay).toBeGreaterThanOrEqual(0.25);
        }
    });

    it('keeps all three enemy types in every generated wave', () => {
        const types = getWaveConfig(42).enemies.map(group => group.type);
        expect(types).toEqual(['basic', 'fast', 'armored']);
    });
});

// ==================== WAVE FLAVOUR AND PREVIEW ====================

/**
 * showWaveAnnouncement(waveNumber, subtitle = '') has existed since Sprint 1
 * with no caller ever passing the second argument - the same kind of dangling
 * scaffold that showTooltip() and saveProgress() were. getWaveFlavour() fills it.
 */
describe('getWaveFlavour()', () => {
    it('has a line for every authored wave', () => {
        for (const wave of Object.keys(CONFIG.waves)) {
            expect(getWaveFlavour(Number(wave)).length).toBeGreaterThan(0);
        }
    });

    it('keeps talking past the campaign', () => {
        for (const wave of [6, 7, 12, 40]) {
            expect(getWaveFlavour(wave).length).toBeGreaterThan(0);
        }
    });

    it('cycles the endless lines rather than running out', () => {
        const period = CONFIG.endlessFlavour.length;
        expect(getWaveFlavour(6)).toBe(getWaveFlavour(6 + period));
    });

    it('returns a string for a nonsense wave number', () => {
        expect(typeof getWaveFlavour(0)).toBe('string');
        expect(typeof getWaveFlavour(-3)).toBe('string');
    });

    // Terse on purpose: a wave banner is on screen for about a second and a
    // half, and the player is watching the board rather than reading
    it('keeps every line short enough to read at a glance', () => {
        const lines = [
            ...Object.values(CONFIG.waveFlavour),
            ...CONFIG.endlessFlavour
        ];

        for (const line of lines) {
            expect(line.length).toBeLessThan(46);
        }
    });
});

describe('describeWaveComposition()', () => {
    it('names every enemy group in an authored wave', () => {
        const summary = describeWaveComposition(3);

        expect(summary).toContain('basic');
        expect(summary).toContain('fast');
    });

    it('reports the real counts', () => {
        const wave = CONFIG.waves[4];

        for (const group of wave.enemies) {
            expect(describeWaveComposition(4)).toContain(`${group.count} ${group.type}`);
        }
    });

    it('mentions the boss on a boss wave', () => {
        expect(describeWaveComposition(5)).toContain('boss');
    });

    it('does not mention a boss on a wave without one', () => {
        expect(describeWaveComposition(4)).not.toContain('boss');
    });

    it('still describes generated waves', () => {
        expect(describeWaveComposition(23).length).toBeGreaterThan(0);
    });

    it('never renders a zero-count group', () => {
        for (let wave = 1; wave <= 30; wave++) {
            expect(describeWaveComposition(wave)).not.toMatch(/\b0 /);
        }
    });
});
