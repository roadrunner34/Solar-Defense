// @vitest-environment jsdom

/**
 * run-summary.test.js - The end-of-run breakdown
 *
 * The defeat screen used to show exactly one number - the final score - and was
 * otherwise a dead end. Every figure needed to say something more was already
 * being tracked and thrown away.
 *
 * These tests cover both halves: what economy.js accumulates over a run, and
 * how ui.js renders it.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
    initEconomy, addCredits, spendCredits, recordKill, recordShot, recordHit,
    getGameStats, updateCombo
} from '../js/economy.js';

import { initUI, showRunSummary } from '../js/ui.js';
import { CONFIG } from '../js/config.js';

/** The parts of index.html the summary needs. */
function renderFixture() {
    document.body.innerHTML = `
        <div id="hud">
            <div id="wave-number"></div>
            <div id="enemies-remaining"></div>
            <div id="score"></div>
            <div id="credits"></div>
        </div>
        <div id="victory-screen" class="screen">
            <div class="run-stats" id="run-stats-victory"></div>
        </div>
        <div id="defeat-screen" class="screen">
            <div class="run-stats" id="run-stats-defeat"></div>
        </div>
    `;
    initUI();
}

const rows = (id = 'run-stats-defeat') =>
    [...document.querySelectorAll(`#${id} .run-stat`)].map(row => ({
        label: row.children[0].textContent,
        value: row.children[1].textContent
    }));

const valueOf = (label, id) => (rows(id).find(r => r.label === label) || {}).value;

beforeEach(() => {
    renderFixture();
    initEconomy();
});

// ==================== WHAT THE ECONOMY ACCUMULATES ====================

describe('run totals', () => {
    it('breaks kills down by type', () => {
        recordKill('basic');
        recordKill('basic');
        recordKill('armored');

        const stats = getGameStats();

        expect(stats.killsByType.basic).toBe(2);
        expect(stats.killsByType.armored).toBe(1);
        expect(stats.killsByType.fast).toBeUndefined();
    });

    it('returns a copy of the breakdown, not the live tally', () => {
        recordKill('basic');

        const stats = getGameStats();
        stats.killsByType.basic = 999;

        expect(getGameStats().killsByType.basic).toBe(1);
    });

    it('tracks credits earned and spent separately from the balance', () => {
        addCredits(500, 'test');
        spendCredits(460);

        const stats = getGameStats();

        expect(stats.creditsEarned).toBeGreaterThanOrEqual(500);
        expect(stats.creditsSpent).toBe(460);

        // The whole point: a player finishing on 40 credits may have moved
        // thousands, and the balance alone cannot say so
        expect(stats.credits).toBeLessThan(stats.creditsEarned);
    });

    // Otherwise a player could inflate "credits earned" by building and selling
    // the same platform over and over, which is the opposite of an achievement
    it('does not count a sale refund as credits earned', () => {
        const before = getGameStats().creditsEarned;

        addCredits(200, 'sell_laserBattery');

        expect(getGameStats().creditsEarned).toBe(before);
    });

    it('does not count a failed purchase as spending', () => {
        initEconomy(10);

        expect(spendCredits(500)).toBe(false);
        expect(getGameStats().creditsSpent).toBe(0);
    });

    it('remembers the best chain reached', () => {
        recordKill('basic');
        recordKill('basic');
        recordKill('basic');

        updateCombo(CONFIG.combo.window + 1);

        expect(getGameStats().bestCombo).toBeGreaterThan(1);
    });

    it('is cleared by a new run', () => {
        recordKill('basic');
        addCredits(100, 'test');
        spendCredits(50);

        initEconomy();

        const stats = getGameStats();

        expect(stats.killsByType).toEqual({});
        expect(stats.creditsEarned).toBe(0);
        expect(stats.creditsSpent).toBe(0);
        expect(stats.bestCombo).toBe(1);
    });
});

// ==================== HOW IT RENDERS ====================

describe('showRunSummary()', () => {
    const baseSummary = {
        wavesSurvived: 8,
        totalKills: 120,
        killsByType: { basic: 80, fast: 30, armored: 10 },
        accuracy: 73,
        creditsEarned: 2400,
        creditsSpent: 2100,
        bestCombo: 2.25,
        platformsBuilt: 9,
        bestPlatform: { name: 'Missile Launcher', damage: 5400 }
    };

    it('reports the headline figures', () => {
        showRunSummary(baseSummary);

        expect(valueOf('Waves survived')).toBe('8');
        expect(valueOf('Accuracy')).toBe('73%');
        expect(valueOf('Platforms built')).toBe('9');
    });

    it('lists the kill breakdown in configured order', () => {
        showRunSummary(baseSummary);

        const breakdown = valueOf('Breakdown');

        expect(breakdown).toContain('80 basic');
        expect(breakdown).toContain('30 fast');
        expect(breakdown.indexOf('basic')).toBeLessThan(breakdown.indexOf('fast'));
    });

    it('names the top platform and what it dealt', () => {
        showRunSummary(baseSummary);

        const top = valueOf('Top platform');

        expect(top).toContain('Missile Launcher');
        expect(top).toContain('5,400');
    });

    it('formats large numbers readably', () => {
        showRunSummary({ ...baseSummary, creditsEarned: 24000 });
        expect(valueOf('Credits earned')).toBe('24,000');
    });

    it('shows the best chain when there was one', () => {
        showRunSummary(baseSummary);
        expect(valueOf('Best chain')).toBe('x2.25');
    });

    // Rows with nothing to say are dropped rather than shown as zero
    it('omits the chain row when no chain was ever built', () => {
        showRunSummary({ ...baseSummary, bestCombo: 1 });
        expect(valueOf('Best chain')).toBeUndefined();
    });

    it('omits the top platform row when nothing dealt damage', () => {
        showRunSummary({ ...baseSummary, bestPlatform: null });
        expect(valueOf('Top platform')).toBeUndefined();
    });

    it('omits the breakdown when nothing was killed', () => {
        showRunSummary({ ...baseSummary, totalKills: 0, killsByType: {} });
        expect(valueOf('Breakdown')).toBeUndefined();
    });

    it('populates both screens, since only one will be shown', () => {
        showRunSummary(baseSummary);

        expect(rows('run-stats-victory').length).toBeGreaterThan(0);
        expect(rows('run-stats-defeat').length).toBe(rows('run-stats-victory').length);
    });

    it('replaces the previous run rather than appending to it', () => {
        showRunSummary(baseSummary);
        const first = rows().length;

        showRunSummary(baseSummary);

        expect(rows().length).toBe(first);
    });

    it('survives a summary with nothing in it', () => {
        expect(() => showRunSummary({})).not.toThrow();
        expect(valueOf('Waves survived')).toBe('0');
    });

    it('does not throw when the screens have no stats container', () => {
        document.body.innerHTML = '<div id="hud"></div>';
        initUI();

        expect(() => showRunSummary(baseSummary)).not.toThrow();
    });
});
