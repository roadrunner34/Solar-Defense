/**
 * upgrade.js - Upgrade rules
 *
 * Sprint 3's missing half. `upgradeStarbase()` has existed in starbase.js since
 * that sprint and was never called by anything: there was no cost model, no
 * tier tracking, and no UI. This module supplies the first two, and ui.js the
 * third.
 *
 * WHY TIERS AND MULTIPLIERS RATHER THAN "+5 DAMAGE"
 * ================================================
 * A flat increment has to be re-tuned every time a base stat changes, and it
 * scales wrongly across structures: +5 damage is a 25% improvement to a Laser
 * Battery and a 12% improvement to a Missile Launcher, so the same upgrade is
 * quietly worth half as much on the more expensive platform.
 *
 * Storing a tier per stat and deriving the value as `base * multiplier[tier]`
 * fixes both. The upgrade means the same thing everywhere, the base values in
 * config.js stay the single source of truth, and selling or resetting is a
 * matter of dropping the tiers rather than trying to subtract increments back
 * out in the right order.
 */

import { CONFIG } from './config.js';
import { getCredits, spendCredits } from './economy.js';

/**
 * The stats a weapon can upgrade, in the order they appear in the panel.
 *
 * This is the default, not the whole story. Support platforms upgrade something
 * else entirely - a Gravity Well has no damage and no fire rate, and offering
 * it three tiers of "Damage" would be offering it nothing. See getUpgradeStats().
 */
export const UPGRADE_STATS = ['damage', 'range', 'fireRate'];

/**
 * Which stats a particular target can upgrade.
 *
 * Targets declare their own list by carrying an `upgradeStats` array, copied
 * from their platform config at build time. Anything that does not - every
 * weapon platform, and the starbase - falls back to the weapon stats, so this
 * change is invisible to everything that existed before support platforms did.
 *
 * @param {object} target - A platform, or the starbase view object
 * @returns {Array<string>} The upgradeable stat names
 */
export function getUpgradeStats(target) {
    const declared = target && target.upgradeStats;

    return Array.isArray(declared) && declared.length > 0
        ? declared
        : UPGRADE_STATS;
}

/**
 * Read a target's tier for one stat.
 *
 * Targets carry an `upgradeTiers` object created lazily, so nothing has to
 * remember to initialise it at construction - including platforms built before
 * this module existed.
 *
 * @param {object} target - A platform, or the starbase view object
 * @param {string} stat
 * @returns {number} 0 for unupgraded
 */
export function getUpgradeTier(target, stat) {
    return (target.upgradeTiers && target.upgradeTiers[stat]) || 0;
}

/**
 * The build cost an upgrade price is scaled from.
 *
 * @param {object} target
 * @returns {number}
 */
function getBaseCost(target) {
    return target.cost || CONFIG.upgrades.starbaseBaseCost;
}

/**
 * What the next tier of a stat costs.
 *
 * @param {object} target
 * @param {string} stat
 * @returns {number} Credits, or Infinity if already at max tier
 */
export function getUpgradeCost(target, stat) {
    const tier = getUpgradeTier(target, stat);
    if (tier >= CONFIG.upgrades.maxTier) return Infinity;

    return Math.round(getBaseCost(target) * CONFIG.upgrades.costFactor[tier + 1]);
}

/**
 * @param {object} target
 * @param {string} stat
 * @returns {boolean} Whether the stat has room to improve
 */
export function canUpgrade(target, stat) {
    return getUpgradeTier(target, stat) < CONFIG.upgrades.maxTier;
}

/**
 * @param {object} target
 * @param {string} stat
 * @returns {boolean} Whether it can be improved AND paid for
 */
export function canAffordUpgrade(target, stat) {
    return canUpgrade(target, stat) && getCredits() >= getUpgradeCost(target, stat);
}

/**
 * The value a stat should have at its current tier.
 *
 * Always computed from the base rather than from the live value, so repeated
 * upgrades cannot compound through floating-point drift and a reset is exact.
 *
 * @param {object} target
 * @param {string} stat
 * @param {number} baseValue - The stat's unupgraded value from config
 * @returns {number}
 */
export function getUpgradedValue(target, stat, baseValue) {
    const multipliers = CONFIG.upgrades.multipliers[stat];
    if (!multipliers) return baseValue;

    return baseValue * multipliers[getUpgradeTier(target, stat)];
}

/**
 * Buy the next tier of a stat.
 *
 * Credits are only spent once every check has passed, so a failed upgrade never
 * charges for nothing.
 *
 * @param {object} target
 * @param {string} stat
 * @param {object} baseStats - The target's unupgraded values
 * @param {Function} applyValue - Called with (stat, newValue) to write it back
 * @returns {{success: boolean, cost?: number, tier?: number, reason?: string}}
 */
export function purchaseUpgrade(target, stat, baseStats, applyValue) {
    if (!canUpgrade(target, stat)) {
        return { success: false, reason: 'maxed' };
    }

    const cost = getUpgradeCost(target, stat);

    if (!spendCredits(cost)) {
        return { success: false, reason: 'credits' };
    }

    if (!target.upgradeTiers) target.upgradeTiers = {};
    target.upgradeTiers[stat] = getUpgradeTier(target, stat) + 1;

    applyValue(stat, getUpgradedValue(target, stat, baseStats[stat]));

    return { success: true, cost, tier: target.upgradeTiers[stat] };
}

/**
 * Describe a target's upgrades for the selection panel.
 *
 * Returns plain data rather than touching the DOM, so ui.js stays unaware of
 * what an upgrade costs and this module stays unaware of how it is rendered.
 *
 * @param {object} target
 * @returns {Array<{id: string, label: string, cost: number,
 *                  affordable: boolean, maxed: boolean, tier: number}>}
 */
export function describeUpgrades(target) {
    return getUpgradeStats(target).map((stat) => {
        const maxed = !canUpgrade(target, stat);
        const tier = getUpgradeTier(target, stat);

        return {
            id: stat,
            label: `${CONFIG.upgrades.labels[stat]} ${romanTier(tier + 1)}`,
            cost: maxed ? 0 : getUpgradeCost(target, stat),
            affordable: canAffordUpgrade(target, stat),
            maxed,
            tier
        };
    });
}

/**
 * Tier numeral for a button label.
 *
 * Roman numerals rather than digits purely so the tier cannot be misread as
 * part of the cost sitting next to it on the same button.
 *
 * @param {number} tier - 1-based
 * @returns {string}
 */
function romanTier(tier) {
    return ['', 'I', 'II', 'III', 'IV', 'V'][tier] || String(tier);
}

/**
 * Total credits sunk into a target's upgrades.
 *
 * Used to work out a sale refund: a platform that has had 300 credits of
 * upgrades poured into it should not refund the same as one straight off the
 * build menu.
 *
 * @param {object} target
 * @returns {number}
 */
export function getUpgradeInvestment(target) {
    const baseCost = getBaseCost(target);

    // Must iterate the target's OWN stats, not the weapon defaults. A Gravity
    // Well upgrades magnitude and duration; counting only damage/range/fireRate
    // would value every one of those tiers at zero, so selling a fully upgraded
    // support platform would refund it as if it were straight off the build
    // menu. upgrade.test.js guards this case directly.
    return getUpgradeStats(target).reduce((total, stat) => {
        const tier = getUpgradeTier(target, stat);

        // Sum the cost of every tier bought so far, not just the current one
        for (let step = 1; step <= tier; step++) {
            total += Math.round(baseCost * CONFIG.upgrades.costFactor[step]);
        }

        return total;
    }, 0);
}

/**
 * Clear every upgrade on a target.
 * @param {object} target
 */
export function resetUpgrades(target) {
    target.upgradeTiers = {};
}
