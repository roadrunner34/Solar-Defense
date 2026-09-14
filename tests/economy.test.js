/**
 * economy.test.js - Credits, score and accuracy tracking
 *
 * The economy module holds state at module scope, so every test starts
 * from initEconomy() to avoid order-dependent results.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initEconomy, getCredits, getScore, addCredits, spendCredits, canAfford,
    recordKill, recordShot, recordHit, getAccuracy, awardWaveBonus,
    resetWaveTracking, getWaveSummary, getGameStats,
    saveProgress, loadBestRun, clearProgress
} from '../js/economy.js';
import { CONFIG } from '../js/config.js';

beforeEach(() => {
    initEconomy();
});

describe('initEconomy()', () => {
    it('starts from the configured credit balance with a clean slate', () => {
        expect(getCredits()).toBe(CONFIG.economy.startingCredits);
        expect(getScore()).toBe(0);
        expect(getGameStats().totalKills).toBe(0);
    });

    it('honours an explicit starting balance', () => {
        initEconomy(500);
        expect(getCredits()).toBe(500);
    });
});

describe('spendCredits()', () => {
    it('deducts and reports success when affordable', () => {
        const before = getCredits();
        expect(spendCredits(50)).toBe(true);
        expect(getCredits()).toBe(before - 50);
    });

    it('refuses and leaves the balance untouched when unaffordable', () => {
        const before = getCredits();
        expect(spendCredits(before + 1)).toBe(false);
        expect(getCredits()).toBe(before);
    });

    it('allows spending the balance down to exactly zero', () => {
        expect(spendCredits(getCredits())).toBe(true);
        expect(getCredits()).toBe(0);
    });
});

describe('canAfford()', () => {
    it('treats an exact balance as affordable', () => {
        expect(canAfford(getCredits())).toBe(true);
        expect(canAfford(getCredits() + 1)).toBe(false);
    });
});

describe('recordKill()', () => {
    it('awards the configured credits and score per enemy type', () => {
        const credits = getCredits();
        recordKill('armored');
        expect(getCredits()).toBe(credits + CONFIG.economy.creditsPerKill.armored);
        expect(getScore()).toBe(CONFIG.scoring.pointsPerKill.armored);
    });

    it('counts kills toward the running total', () => {
        recordKill('basic');
        recordKill('fast');
        expect(getGameStats().totalKills).toBe(2);
    });
});

describe('getAccuracy()', () => {
    it('reports 100% before any shot is fired', () => {
        expect(getAccuracy()).toBe(100);
    });

    it('reports the hit ratio as a rounded percentage', () => {
        recordShot(); recordShot(); recordShot(); recordShot();
        recordHit(); recordHit();
        expect(getAccuracy()).toBe(50);
    });
});

describe('awardWaveBonus()', () => {
    it('pays the wave bonus plus an accuracy bonus', () => {
        recordShot(); recordHit(); // 100% accuracy
        const before = getCredits();
        const result = awardWaveBonus(1);

        expect(result.waveBonus).toBe(CONFIG.waves[1].bonusCredits);
        expect(result.accuracy).toBe(100);
        expect(getCredits()).toBe(before + result.waveBonus + result.accuracyBonus);
    });

    it('scales the bonus for waves past the authored ones', () => {
        expect(awardWaveBonus(99).waveBonus).toBe(50 * 99);
    });
});

describe('wave tracking', () => {
    it('reports only what was earned since the last reset', () => {
        recordKill('basic');
        resetWaveTracking();
        recordKill('fast');

        const summary = getWaveSummary();
        expect(summary.credits).toBe(CONFIG.economy.creditsPerKill.fast);
        expect(summary.score).toBe(CONFIG.scoring.pointsPerKill.fast);
        // Kills are a per-game total, deliberately not reset per wave
        expect(summary.kills).toBe(2);
    });
});

describe('best-run persistence', () => {
    /**
     * A minimal in-memory localStorage.
     *
     * economy.js reads the global directly, and Vitest's node environment has
     * none. Stubbing it here also keeps the tests from depending on - or
     * polluting - whatever the machine running them happens to have stored.
     */
    function stubStorage() {
        const store = new Map();

        globalThis.localStorage = {
            getItem: key => (store.has(key) ? store.get(key) : null),
            setItem: (key, value) => store.set(key, String(value)),
            removeItem: key => store.delete(key)
        };

        return store;
    }

    beforeEach(() => {
        stubStorage();
        initEconomy();
    });

    it('has nothing stored to begin with', () => {
        expect(loadBestRun()).toBeNull();
    });

    it('stores the first run that finishes', () => {
        expect(saveProgress({ wave: 4, score: 1200 })).toBe(true);
        expect(loadBestRun()).toMatchObject({ wave: 4, score: 1200 });
    });

    // Wave first, score second: in a tower defence, surviving longer is the
    // achievement and score is the tiebreak
    it('prefers a deeper run even at a lower score', () => {
        saveProgress({ wave: 4, score: 9000 });
        expect(saveProgress({ wave: 7, score: 100 })).toBe(true);
        expect(loadBestRun().wave).toBe(7);
    });

    it('breaks a tie on the same wave with score', () => {
        saveProgress({ wave: 5, score: 1000 });

        expect(saveProgress({ wave: 5, score: 2000 })).toBe(true);
        expect(loadBestRun().score).toBe(2000);

        expect(saveProgress({ wave: 5, score: 1500 })).toBe(false);
        expect(loadBestRun().score).toBe(2000);
    });

    it('does not overwrite a better run with a worse one', () => {
        saveProgress({ wave: 9, score: 5000 });

        expect(saveProgress({ wave: 2, score: 10 })).toBe(false);
        expect(loadBestRun()).toMatchObject({ wave: 9, score: 5000 });
    });

    it('forgets the record when cleared', () => {
        saveProgress({ wave: 6, score: 3000 });
        clearProgress();

        expect(loadBestRun()).toBeNull();
    });

    // localStorage is editable by anyone with devtools open, so a stored value
    // is untrusted input. A NaN reaching the start screen would render as
    // "Best: wave NaN" rather than failing anywhere useful.
    it('ignores a corrupted record rather than trusting it', () => {
        localStorage.setItem('solarDefense_best', 'not json at all');
        expect(loadBestRun()).toBeNull();

        localStorage.setItem('solarDefense_best', JSON.stringify({ wave: 'five' }));
        expect(loadBestRun()).toBeNull();
    });

    it('survives storage being unavailable entirely', () => {
        // Private browsing throws on both read and write
        globalThis.localStorage = {
            getItem() { throw new Error('denied'); },
            setItem() { throw new Error('denied'); },
            removeItem() { throw new Error('denied'); }
        };

        expect(() => loadBestRun()).not.toThrow();
        expect(loadBestRun()).toBeNull();
        expect(saveProgress({ wave: 3, score: 10 })).toBe(false);
        expect(() => clearProgress()).not.toThrow();
    });
});
