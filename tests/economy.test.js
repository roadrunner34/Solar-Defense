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
    resetWaveTracking, getWaveSummary, getGameStats
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
