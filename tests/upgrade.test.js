/**
 * upgrade.test.js - Upgrade tiers, costs and investment
 *
 * Sprint 3's economy depth. These tests cover the rules rather than the UI:
 * what a tier costs, what it does to a stat, and what the accumulated spend
 * comes to when a platform is sold.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
    UPGRADE_STATS,
    getUpgradeStats,
    getUpgradeTier,
    getUpgradeCost,
    canUpgrade,
    canAffordUpgrade,
    getUpgradedValue,
    purchaseUpgrade,
    describeUpgrades,
    getUpgradeInvestment,
    resetUpgrades
} from '../js/upgrade.js';

import { initEconomy, getCredits } from '../js/economy.js';
import { CONFIG } from '../js/config.js';

/** A stand-in for a platform: just a build cost and a tier bag. */
function target(cost = 100) {
    return { cost, upgradeTiers: {} };
}

const BASE_STATS = { damage: 20, range: 80, fireRate: 1.2 };

beforeEach(() => {
    initEconomy(10000);
});

describe('tiers', () => {
    it('starts everything at tier 0', () => {
        const platform = target();

        for (const stat of UPGRADE_STATS) {
            expect(getUpgradeTier(platform, stat)).toBe(0);
        }
    });

    it('treats a target with no upgradeTiers at all as unupgraded', () => {
        // Platforms created before this system existed have no tier bag, and
        // reading one must not throw
        expect(getUpgradeTier({ cost: 50 }, 'damage')).toBe(0);
    });

    it('allows upgrades up to the configured maximum and no further', () => {
        const platform = target();

        for (let tier = 0; tier < CONFIG.upgrades.maxTier; tier++) {
            expect(canUpgrade(platform, 'damage')).toBe(true);
            purchaseUpgrade(platform, 'damage', BASE_STATS, () => {});
        }

        expect(getUpgradeTier(platform, 'damage')).toBe(CONFIG.upgrades.maxTier);
        expect(canUpgrade(platform, 'damage')).toBe(false);
    });
});

describe('costs', () => {
    it('scales the price from the structure\'s own build cost', () => {
        const cheap = target(50);
        const dear = target(100);

        expect(getUpgradeCost(dear, 'damage')).toBe(getUpgradeCost(cheap, 'damage') * 2);
    });

    it('charges more for each successive tier', () => {
        const platform = target();
        const prices = [];

        for (let tier = 0; tier < CONFIG.upgrades.maxTier; tier++) {
            prices.push(getUpgradeCost(platform, 'damage'));
            purchaseUpgrade(platform, 'damage', BASE_STATS, () => {});
        }

        expect(prices[1]).toBeGreaterThan(prices[0]);
        expect(prices[2]).toBeGreaterThan(prices[1]);
    });

    it('reports an infinite cost once maxed, so nothing can price it', () => {
        const platform = target();
        platform.upgradeTiers.damage = CONFIG.upgrades.maxTier;

        expect(getUpgradeCost(platform, 'damage')).toBe(Infinity);
    });

    it('is unaffordable when the player is short', () => {
        const platform = target();
        initEconomy(1);

        expect(canAffordUpgrade(platform, 'damage')).toBe(false);
    });

    it('treats an exact balance as affordable', () => {
        const platform = target();
        initEconomy(getUpgradeCost(platform, 'damage'));

        expect(canAffordUpgrade(platform, 'damage')).toBe(true);
    });
});

describe('purchaseUpgrade()', () => {
    it('spends the credits and raises the tier', () => {
        const platform = target();
        const cost = getUpgradeCost(platform, 'damage');
        const before = getCredits();

        const result = purchaseUpgrade(platform, 'damage', BASE_STATS, () => {});

        expect(result.success).toBe(true);
        expect(getCredits()).toBe(before - cost);
        expect(getUpgradeTier(platform, 'damage')).toBe(1);
    });

    it('writes the new value back through the callback', () => {
        const platform = target();
        let written = null;

        purchaseUpgrade(platform, 'damage', BASE_STATS, (stat, value) => {
            written = { stat, value };
        });

        expect(written.stat).toBe('damage');
        expect(written.value).toBe(BASE_STATS.damage * CONFIG.upgrades.multipliers.damage[1]);
    });

    // The important failure case: a rejected purchase must not take the money.
    it('charges nothing when the player cannot afford it', () => {
        const platform = target();
        initEconomy(5);

        const result = purchaseUpgrade(platform, 'damage', BASE_STATS, () => {});

        expect(result.success).toBe(false);
        expect(result.reason).toBe('credits');
        expect(getCredits()).toBe(5);
        expect(getUpgradeTier(platform, 'damage')).toBe(0);
    });

    it('charges nothing when the stat is already maxed', () => {
        const platform = target();
        platform.upgradeTiers.damage = CONFIG.upgrades.maxTier;
        const before = getCredits();

        const result = purchaseUpgrade(platform, 'damage', BASE_STATS, () => {});

        expect(result.success).toBe(false);
        expect(result.reason).toBe('maxed');
        expect(getCredits()).toBe(before);
    });

    // Values derive from the base every time rather than compounding off the
    // live value, so three upgrades land exactly on the tier-3 multiplier
    it('derives each value from the base rather than compounding', () => {
        const platform = target();
        let latest = BASE_STATS.damage;

        for (let i = 0; i < CONFIG.upgrades.maxTier; i++) {
            purchaseUpgrade(platform, 'damage', BASE_STATS, (stat, value) => {
                latest = value;
            });
        }

        const expected = BASE_STATS.damage *
            CONFIG.upgrades.multipliers.damage[CONFIG.upgrades.maxTier];

        expect(latest).toBeCloseTo(expected, 10);
    });
});

describe('getUpgradedValue()', () => {
    it('returns the base value at tier 0', () => {
        expect(getUpgradedValue(target(), 'damage', 20)).toBe(20);
    });

    it('passes unknown stats through untouched', () => {
        // rotationSpeed has no multiplier table and must not become NaN
        expect(getUpgradedValue(target(), 'rotationSpeed', 3)).toBe(3);
    });
});

describe('getUpgradeInvestment()', () => {
    it('is zero for an untouched structure', () => {
        expect(getUpgradeInvestment(target())).toBe(0);
    });

    it('totals every tier bought, not just the last one', () => {
        const platform = target();

        const first = getUpgradeCost(platform, 'damage');
        purchaseUpgrade(platform, 'damage', BASE_STATS, () => {});

        const second = getUpgradeCost(platform, 'damage');
        purchaseUpgrade(platform, 'damage', BASE_STATS, () => {});

        expect(getUpgradeInvestment(platform)).toBe(first + second);
    });

    it('sums across different stats', () => {
        const platform = target();

        purchaseUpgrade(platform, 'damage', BASE_STATS, () => {});
        purchaseUpgrade(platform, 'range', BASE_STATS, () => {});

        expect(getUpgradeInvestment(platform)).toBeGreaterThan(0);
        expect(getUpgradeInvestment(platform))
            .toBe(Math.round(100 * CONFIG.upgrades.costFactor[1]) * 2);
    });
});

describe('describeUpgrades()', () => {
    it('describes every upgradeable stat', () => {
        const rows = describeUpgrades(target());
        expect(rows.map(row => row.id)).toEqual(UPGRADE_STATS);
    });

    it('marks a maxed stat and gives it no price', () => {
        const platform = target();
        platform.upgradeTiers.damage = CONFIG.upgrades.maxTier;

        const damage = describeUpgrades(platform).find(row => row.id === 'damage');

        expect(damage.maxed).toBe(true);
        expect(damage.cost).toBe(0);
        expect(damage.affordable).toBe(false);
    });

    it('reflects affordability', () => {
        initEconomy(0);
        expect(describeUpgrades(target()).every(row => !row.affordable)).toBe(true);
    });
});

describe('resetUpgrades()', () => {
    it('drops every tier', () => {
        const platform = target();
        purchaseUpgrade(platform, 'damage', BASE_STATS, () => {});

        resetUpgrades(platform);

        expect(getUpgradeTier(platform, 'damage')).toBe(0);
        expect(getUpgradeInvestment(platform)).toBe(0);
    });
});

// ==================== PER-TYPE UPGRADE STATS ====================

/**
 * Support platforms upgrade a different set of stats to weapons. A Gravity Well
 * has no damage and no fire rate, and offering it three tiers of "Damage" would
 * be offering it nothing.
 */
describe('getUpgradeStats()', () => {
    it('falls back to the weapon stats for anything that does not declare its own', () => {
        expect(getUpgradeStats(target())).toEqual(UPGRADE_STATS);
    });

    it('falls back for the starbase, which carries no list', () => {
        expect(getUpgradeStats({ isStarbase: true, upgradeTiers: {} }))
            .toEqual(UPGRADE_STATS);
    });

    it('honours a declared list', () => {
        const well = { cost: 75, upgradeTiers: {}, upgradeStats: ['magnitude', 'range'] };
        expect(getUpgradeStats(well)).toEqual(['magnitude', 'range']);
    });

    it('ignores an empty list rather than offering no upgrades at all', () => {
        expect(getUpgradeStats({ cost: 50, upgradeTiers: {}, upgradeStats: [] }))
            .toEqual(UPGRADE_STATS);
    });

    it('describes exactly the declared stats', () => {
        initEconomy(9999);

        const well = {
            cost: 75, upgradeTiers: {},
            upgradeStats: ['magnitude', 'range', 'duration']
        };

        expect(describeUpgrades(well).map(row => row.id))
            .toEqual(['magnitude', 'range', 'duration']);
    });

    it('has a multiplier curve and a label for every support stat', () => {
        for (const stat of ['magnitude', 'duration']) {
            expect(Array.isArray(CONFIG.upgrades.multipliers[stat])).toBe(true);
            expect(CONFIG.upgrades.multipliers[stat].length)
                .toBe(CONFIG.upgrades.maxTier + 1);
            expect(typeof CONFIG.upgrades.labels[stat]).toBe('string');
        }
    });
});

/**
 * The regression this whole section exists for.
 *
 * getUpgradeInvestment() feeds the sell refund, and it used to iterate the
 * weapon stat list unconditionally. A Gravity Well upgraded three times would
 * have valued every one of those tiers at zero, so selling it would have
 * refunded it as though it were straight off the build menu - quietly
 * destroying the player's credits.
 */
describe('getUpgradeInvestment() with per-type stats', () => {
    const supportTarget = () => ({
        cost: 75,
        upgradeTiers: {},
        upgradeStats: ['magnitude', 'range', 'duration']
    });

    it('counts tiers bought on the stats a support platform declares', () => {
        initEconomy(9999);

        const well = supportTarget();
        purchaseUpgrade(well, 'magnitude', { magnitude: 0.4 }, () => {});

        expect(getUpgradeInvestment(well)).toBeGreaterThan(0);
    });

    it('matches what was actually spent', () => {
        initEconomy(9999);

        const well = supportTarget();
        const before = getCredits();

        purchaseUpgrade(well, 'magnitude', { magnitude: 0.4 }, () => {});
        purchaseUpgrade(well, 'duration', { duration: 0.6 }, () => {});

        expect(getUpgradeInvestment(well)).toBe(before - getCredits());
    });

    it('sums across every declared stat', () => {
        initEconomy(9999);

        const one = supportTarget();
        purchaseUpgrade(one, 'magnitude', { magnitude: 0.4 }, () => {});
        const single = getUpgradeInvestment(one);

        const two = supportTarget();
        purchaseUpgrade(two, 'magnitude', { magnitude: 0.4 }, () => {});
        purchaseUpgrade(two, 'range', { range: 55 }, () => {});

        expect(getUpgradeInvestment(two)).toBeGreaterThan(single);
    });

    it('still values a weapon exactly as before', () => {
        initEconomy(9999);

        const platform = target();
        purchaseUpgrade(platform, 'damage', BASE_STATS, () => {});

        expect(getUpgradeInvestment(platform))
            .toBe(Math.round(100 * CONFIG.upgrades.costFactor[1]));
    });
});
