/**
 * targeting.js - Which enemy a weapon shoots at
 *
 * Every weapon in the game used to fire at whatever was nearest to it. That is
 * the obvious rule and the wrong one: a Missile Launcher costs 100 credits and
 * reloads at 0.8/sec, and "nearest to me" spends that shot on whichever piece of
 * trash wandered closest while an Armored enemy walks past it to the planet.
 *
 * Giving each structure its own targeting priority turns every platform the
 * player already owns into a decision, without adding a single new thing to
 * build. That is the cheapest depth in the game.
 *
 * THE MODES
 * =========
 *   closest   - nearest to the weapon. The old behaviour, still the default.
 *   first     - furthest along its path, so nearest to the planet. The mode for
 *               anything whose job is to stop a leak.
 *   last      - least far along. Good for softening a wave up before it reaches
 *               the killing ground, and for not wasting overkill on something
 *               three other platforms are already shooting.
 *   strongest - most current health. The answer to Armored enemies, and the
 *               reason a single Missile Launcher can be worth more than two
 *               Laser Batteries against the right wave.
 *
 * Everything here reads state the enemy already carries - pathProgress and
 * health - so none of this cost anything to store.
 */

import { enemies } from './enemy.js';

/** The selectable modes, in the order the UI should offer them. */
export const TARGETING_MODES = ['closest', 'first', 'last', 'strongest'];

/** Short labels for the selection panel. */
export const TARGETING_LABELS = {
    closest: 'Closest',
    first: 'First',
    last: 'Last',
    strongest: 'Strongest'
};

/**
 * What a weapon does before anyone tells it otherwise.
 *
 * 'closest' rather than 'first' so that adding this feature changes nothing
 * about how an existing save or an untouched platform behaves.
 */
export const DEFAULT_TARGETING = 'closest';

/**
 * How each mode scores a candidate. Higher wins.
 *
 * Expressed as scores rather than comparators so the search below is a single
 * pass with no sorting and no intermediate array - this runs once per weapon
 * per frame, and a full board is a dozen platforms plus the starbase.
 */
const SCORERS = {
    // Negated, because the search keeps the highest score and we want the
    // smallest distance
    closest: (enemy, distance) => -distance,

    first: (enemy) => enemy.pathProgress,
    last: (enemy) => -enemy.pathProgress,
    strongest: (enemy) => enemy.health
};

/**
 * Whether a mode is one this module knows about.
 *
 * @param {string} mode
 * @returns {boolean}
 */
export function isTargetingMode(mode) {
    return TARGETING_MODES.includes(mode);
}

/**
 * Cycle to the next mode, for a keyboard shortcut or a single toggle button.
 *
 * @param {string} mode - Current mode
 * @returns {string} The next mode, wrapping around
 */
export function nextTargetingMode(mode) {
    const index = TARGETING_MODES.indexOf(mode);
    return TARGETING_MODES[(index + 1) % TARGETING_MODES.length];
}

/**
 * Pick the enemy a weapon should shoot at.
 *
 * @param {string} mode - One of TARGETING_MODES; anything else falls back to
 *                        the default rather than returning nothing, because a
 *                        weapon that stops firing is a worse failure than a
 *                        weapon that picks the wrong target
 * @param {THREE.Vector3} position - Where the weapon is
 * @param {number} range - How far it can reach
 * @returns {object|null} The chosen enemy, or null if none are in range
 */
export function selectTarget(mode, position, range) {
    const score = SCORERS[mode] || SCORERS[DEFAULT_TARGETING];

    let best = null;
    let bestScore = -Infinity;

    // A single pass over the live enemies. Deliberately not built on
    // getEnemiesInRange(), which allocates a filtered array - that would be a
    // dozen throwaway arrays per frame on a full board, every frame, forever.
    for (const enemy of enemies) {
        if (!enemy.alive) continue;

        const distance = position.distanceTo(enemy.mesh.position);
        if (distance > range) continue;

        const candidate = score(enemy, distance);

        if (candidate > bestScore) {
            bestScore = candidate;
            best = enemy;
        }
    }

    return best;
}
