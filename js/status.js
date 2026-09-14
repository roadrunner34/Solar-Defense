/**
 * status.js - Temporary effects on enemies
 *
 * Until now an enemy had exactly two combat properties and both were constant:
 * the speed it was spawned with and the armour it was spawned with. Everything
 * the player could build attacked the third one, health.
 *
 * This module makes the other two movable, which is what lets a platform be
 * worth building without doing any damage at all. A Gravity Well is worthless
 * alone; it multiplies every gun already covering the same ground. That turns
 * "where does this go" - the only question this game actually asks - into a
 * question with a much more interesting answer.
 *
 * HOW EFFECTS COMBINE
 * ===================
 * Applying an effect that is already present REFRESHES it rather than stacking
 * another copy: the stronger magnitude wins and the longer remaining time wins.
 * Three overlapping Gravity Wells therefore give one good slow, not a 120%
 * slow. Stacking would be simpler to write and completely broken - see the note
 * on minSpeedMultiplier in the config for what a 100% slow actually does to a
 * wave.
 *
 * Effects live on the enemy as a small array, created lazily. Most enemies for
 * most of a run have none, and allocating an array per spawn to hold nothing
 * would be a waste on a board that can hold forty of them.
 */

import { CONFIG } from './config.js';

/** The effects this module knows how to apply. */
export const STATUS_SLOW = 'slow';
export const STATUS_ARMOR_SHRED = 'armorShred';

/**
 * Put an effect on an enemy, or refresh one it already has.
 *
 * @param {object} enemy - The enemy to affect
 * @param {string} type - STATUS_SLOW or STATUS_ARMOR_SHRED
 * @param {object} options
 * @param {number} options.duration - Seconds the effect lasts
 * @param {number} options.magnitude - Strength; a fraction for slow, flat
 *                                     armour points for shred
 * @returns {boolean} True if the effect was applied
 */
export function applyStatus(enemy, type, { duration, magnitude }) {
    if (!enemy || !enemy.alive) return false;
    if (!(duration > 0) || !(magnitude > 0)) return false;

    // Bosses shrug off most of what is thrown at them. Resistance is applied
    // here rather than when the effect is read, so the stored magnitude is
    // always the real one and nothing downstream has to know about it.
    const resistance = enemy.statusResistance || 0;
    const effective = magnitude * (1 - Math.min(1, Math.max(0, resistance)));

    if (effective <= 0) return false;

    if (!enemy.statuses) enemy.statuses = [];

    const existing = enemy.statuses.find(status => status.type === type);

    if (existing) {
        // Refresh, do not stack. Take the better of each - a weak long effect
        // should not shorten a strong short one, or vice versa.
        existing.magnitude = Math.max(existing.magnitude, effective);
        existing.remaining = Math.max(existing.remaining, duration);
        return true;
    }

    enemy.statuses.push({ type, magnitude: effective, remaining: duration });

    return true;
}

/**
 * Run down an enemy's effects. Called once per frame from updateEnemies().
 *
 * @param {object} enemy
 * @param {number} deltaTime - Seconds since the last frame
 * @returns {boolean} True if any effect expired, so the caller knows to refresh
 *                    the enemy's appearance
 */
export function updateStatuses(enemy, deltaTime) {
    if (!enemy.statuses || enemy.statuses.length === 0) return false;

    let expired = false;

    // Backwards so expired effects can be spliced out inside the loop
    for (let i = enemy.statuses.length - 1; i >= 0; i--) {
        enemy.statuses[i].remaining -= deltaTime;

        if (enemy.statuses[i].remaining <= 0) {
            enemy.statuses.splice(i, 1);
            expired = true;
        }
    }

    return expired;
}

/**
 * How fast an enemy is currently moving, as a fraction of its base speed.
 *
 * @param {object} enemy
 * @returns {number} 1 when unaffected, never below CONFIG.status.minSpeedMultiplier
 */
export function getSpeedMultiplier(enemy) {
    const slow = findStatus(enemy, STATUS_SLOW);
    if (!slow) return 1;

    return Math.max(CONFIG.status.minSpeedMultiplier, 1 - slow.magnitude);
}

/**
 * How much of an enemy's armour is currently stripped.
 *
 * @param {object} enemy
 * @returns {number} Flat armour points to subtract; 0 when unaffected
 */
export function getArmorReduction(enemy) {
    const shred = findStatus(enemy, STATUS_ARMOR_SHRED);
    return shred ? shred.magnitude : 0;
}

/**
 * Whether an enemy currently has a given effect.
 *
 * @param {object} enemy
 * @param {string} type
 * @returns {boolean}
 */
export function hasStatus(enemy, type) {
    return findStatus(enemy, type) !== null;
}

/**
 * Every effect currently on an enemy. Used by the visual tell and by tests.
 *
 * @param {object} enemy
 * @returns {Array<object>}
 */
export function getStatuses(enemy) {
    return enemy && enemy.statuses ? enemy.statuses : [];
}

/**
 * Strip every effect from an enemy.
 *
 * @param {object} enemy
 */
export function clearStatuses(enemy) {
    if (enemy && enemy.statuses) enemy.statuses.length = 0;
}

/**
 * @param {object} enemy
 * @param {string} type
 * @returns {object|null}
 */
function findStatus(enemy, type) {
    if (!enemy || !enemy.statuses) return null;

    for (const status of enemy.statuses) {
        if (status.type === type) return status;
    }

    return null;
}
