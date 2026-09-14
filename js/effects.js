/**
 * effects.js - Short-lived visual effects
 *
 * Muzzle flashes, hit sparks and similar one-shot visuals used to drive
 * themselves with their own requestAnimationFrame loops. That had two
 * problems:
 *
 * 1. They ignored the game state entirely, so they kept animating while
 *    the game was paused.
 * 2. Each effect stepped by a fixed amount per frame, so they played
 *    faster on a 144Hz monitor than on a 60Hz one.
 *
 * Registering them here instead means they are stepped by the game loop,
 * with the same deltaTime as everything else - so they pause when the game
 * pauses and run at the same speed on any display.
 *
 * An effect is a function called once per frame. It returns false when it
 * is finished, after disposing whatever it created.
 */

// Effects currently running
const effects = [];

// A deltaTime large enough to drive any effect past the end of its life in a
// single step, but still finite - Infinity would produce NaN transforms.
const FORCE_FINISH_DELTA = 1000;

/**
 * Register a short-lived effect.
 *
 * @param {Function} update - Called each frame as update(deltaTime, elapsed).
 *                            Return false when the effect is done; the effect
 *                            is responsible for its own cleanup before then.
 */
export function addEffect(update) {
    effects.push({ update, elapsed: 0 });
}

/**
 * Step every running effect. Call once per frame from the game loop.
 *
 * @param {number} deltaTime - Time since last frame in seconds
 */
export function updateEffects(deltaTime) {
    // Iterate backwards so finished effects can be spliced out safely
    for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        effect.elapsed += deltaTime;

        if (effect.update(deltaTime, effect.elapsed) === false) {
            effects.splice(i, 1);
        }
    }
}

/**
 * Finish every running effect immediately.
 *
 * Used when restarting so effects from the previous run don't linger. Each
 * effect is given one final call with a large deltaTime, which drives it past
 * the end of its lifetime and lets it dispose its own resources.
 */
export function clearEffects() {
    for (const effect of effects) {
        effect.update(FORCE_FINISH_DELTA, FORCE_FINISH_DELTA);
    }
    effects.length = 0;
}

/**
 * How many effects are currently running (used in tests).
 * @returns {number}
 */
export function getEffectCount() {
    return effects.length;
}
