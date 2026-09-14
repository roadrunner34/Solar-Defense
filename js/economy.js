/**
 * economy.js - Economy System
 * 
 * Manages the player's resources:
 * - Credits: Currency earned from kills and wave completions
 * - Score: Points for leaderboards and achievement tracking
 * 
 * The economy is carefully balanced to ensure:
 * 1. Players always have enough to make progress (starting credits)
 * 2. Good play is rewarded (kill bonuses)
 * 3. There's always something to save for (upgrades cost money)
 */

import { CONFIG } from './config.js';

// Current economy state
let credits = CONFIG.economy.startingCredits;
let score = 0;
let totalKills = 0;
let shotsFired = 0;
let shotsHit = 0;

// Track earnings for display
let creditsEarnedThisWave = 0;
let scoreEarnedThisWave = 0;

// ==================== KILL CHAIN ====================
//
// How many kills are in the current chain, and how long is left to extend it.
// The chain is broken by the timer running out rather than by anything else,
// so a player who keeps enemies dying keeps the multiplier.

let comboChain = 0;
let comboTimer = 0;

// The highest multiplier reached this run, for the end-of-run summary
let bestComboMultiplier = 1;

/**
 * Initialize economy for a new game
 * @param {number} startingCredits - Override starting credits (optional)
 */
export function initEconomy(startingCredits = null) {
    credits = startingCredits !== null ? startingCredits : CONFIG.economy.startingCredits;
    score = 0;
    totalKills = 0;
    shotsFired = 0;
    shotsHit = 0;
    creditsEarnedThisWave = 0;
    scoreEarnedThisWave = 0;
    comboChain = 0;
    comboTimer = 0;
    bestComboMultiplier = 1;
}

/**
 * Get current credits
 * @returns {number} Current credit balance
 */
export function getCredits() {
    return credits;
}

/**
 * Get current score
 * @returns {number} Current score
 */
export function getScore() {
    return score;
}

/**
 * Add credits
 * @param {number} amount - Amount to add
 * @param {string} reason - Why credits were earned (for logging/analytics)
 */
export function addCredits(amount, reason = 'unspecified') {
    credits += amount;
    creditsEarnedThisWave += amount;
    
    // Could log for debugging
    // console.log(`Credits +${amount} (${reason}). Total: ${credits}`);
}

/**
 * Spend credits
 * @param {number} amount - Amount to spend
 * @returns {boolean} True if successful, false if not enough credits
 */
export function spendCredits(amount) {
    if (credits >= amount) {
        credits -= amount;
        return true;
    }
    return false;
}

/**
 * Check if player can afford something
 * @param {number} amount - Cost to check
 * @returns {boolean} True if player has enough credits
 */
export function canAfford(amount) {
    return credits >= amount;
}

/**
 * Add score
 * @param {number} amount - Points to add
 */
export function addScore(amount) {
    score += amount;
    scoreEarnedThisWave += amount;
}

/**
 * Record a kill, awarding credits and score with the current chain multiplier.
 *
 * @param {string} enemyType - Type of enemy killed
 * @returns {{credits: number, score: number, multiplier: number, chain: number}}
 *          What was actually awarded - the caller needs this for the floating
 *          "+N" text, which would otherwise show the base value and quietly
 *          contradict the credit counter
 */
export function recordKill(enemyType) {
    totalKills++;

    // Extend the chain if the window is still open, otherwise start a new one
    comboChain = comboTimer > 0 ? comboChain + 1 : 1;
    comboTimer = CONFIG.combo.window;

    const multiplier = getComboMultiplier();
    if (multiplier > bestComboMultiplier) bestComboMultiplier = multiplier;

    // Add credits for the kill
    const creditValue = Math.round((CONFIG.economy.creditsPerKill[enemyType] || 10) * multiplier);
    addCredits(creditValue, `kill_${enemyType}`);
    
    // Add score for the kill
    const scoreValue = Math.round((CONFIG.scoring.pointsPerKill[enemyType] || 100) * multiplier);
    addScore(scoreValue);

    return { credits: creditValue, score: scoreValue, multiplier, chain: comboChain };
}

/**
 * Run down the kill chain. Call once per frame while playing.
 *
 * @param {number} deltaTime - Seconds since the last frame
 * @returns {boolean} True on the frame the chain breaks, so the caller can
 *                    react to it ending rather than having to poll
 */
export function updateCombo(deltaTime) {
    if (comboTimer <= 0) return false;

    comboTimer -= deltaTime;
    if (comboTimer > 0) return false;

    comboTimer = 0;
    comboChain = 0;

    return true;
}

/**
 * The multiplier the next kill would be paid at.
 *
 * A chain of one is not a chain, so it pays exactly the base value - the
 * multiplier only starts climbing once kills are actually landing together.
 *
 * @returns {number} 1 or above, never past CONFIG.combo.max
 */
export function getComboMultiplier() {
    if (comboChain <= 1) return 1;

    return Math.min(CONFIG.combo.max, 1 + (comboChain - 1) * CONFIG.combo.step);
}

/**
 * @returns {number} Kills in the current chain
 */
export function getComboChain() {
    return comboChain;
}

/**
 * @returns {number} Seconds left to extend the chain, 0 if it is not running
 */
export function getComboTimeRemaining() {
    return Math.max(0, comboTimer);
}

/**
 * @returns {number} The highest multiplier reached this run
 */
export function getBestComboMultiplier() {
    return bestComboMultiplier;
}

/**
 * Record a shot fired (for accuracy tracking)
 */
export function recordShot() {
    shotsFired++;
}

/**
 * Record a shot that hit (for accuracy tracking)
 */
export function recordHit() {
    shotsHit++;
}

/**
 * Get accuracy percentage
 * @returns {number} Accuracy as percentage (0-100)
 */
export function getAccuracy() {
    if (shotsFired === 0) return 100;
    return Math.round((shotsHit / shotsFired) * 100);
}

/**
 * Award wave completion bonus
 * @param {number} waveNumber - Which wave was completed
 */
export function awardWaveBonus(waveNumber) {
    const waveConfig = CONFIG.waves[waveNumber];
    const bonus = waveConfig ? waveConfig.bonusCredits : 50 * waveNumber;
    
    addCredits(bonus, `wave_${waveNumber}_complete`);
    
    // Accuracy bonus
    const accuracy = getAccuracy();
    const accuracyBonus = Math.round(bonus * (accuracy / 100) * CONFIG.scoring.accuracyBonus);
    if (accuracyBonus > 0) {
        addCredits(accuracyBonus, 'accuracy_bonus');
        addScore(accuracyBonus * 10); // Score bonus too
    }
    
    return {
        waveBonus: bonus,
        accuracyBonus,
        accuracy
    };
}

/**
 * Reset wave tracking
 * Call at the start of each wave
 */
export function resetWaveTracking() {
    creditsEarnedThisWave = 0;
    scoreEarnedThisWave = 0;
    // Don't reset shotsFired/shotsHit - accuracy is per-game
}

/**
 * Get wave summary
 * @returns {object} Summary of earnings this wave
 */
export function getWaveSummary() {
    return {
        credits: creditsEarnedThisWave,
        score: scoreEarnedThisWave,
        kills: totalKills,
        accuracy: getAccuracy()
    };
}

/**
 * Get full game statistics
 * @returns {object} All statistics
 */
export function getGameStats() {
    return {
        credits,
        score,
        totalKills,
        shotsFired,
        shotsHit,
        accuracy: getAccuracy()
    };
}

// ==================== PERSISTENCE ====================
//
// These three functions existed from Sprint 1 and were never called by
// anything. What was there saved the *live* credit and score balance and
// restored it into module state on load - which, had it ever been wired up,
// would have started every new run holding the previous run's money.
//
// What a session actually wants to remember is the best run: how far the player
// got and what they scored. That is a record, not a resumable save, and it
// cannot corrupt the run in progress.

const SAVE_KEY = 'solarDefense_best';

/**
 * Save a completed run if it beat the stored best.
 *
 * "Better" is judged on wave first and score second, because in a tower defence
 * surviving longer is the achievement and score is the tiebreak. A lucky
 * high-accuracy run that died on wave 2 should not displace a grind to wave 9.
 *
 * @param {{wave: number, score: number}} run - The run that just ended
 * @returns {boolean} True if this became the new best
 */
export function saveProgress(run) {
    const best = loadBestRun();

    const isBetter = !best ||
        run.wave > best.wave ||
        (run.wave === best.wave && run.score > best.score);

    if (!isBetter) return false;

    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
            wave: run.wave,
            score: run.score,
            kills: totalKills,
            accuracy: getAccuracy(),
            timestamp: Date.now()
        }));
        return true;
    } catch {
        // Private browsing, or storage disabled. A missing high score is not
        // worth interrupting anyone over.
        return false;
    }
}

/**
 * Read the stored best run.
 *
 * @returns {{wave: number, score: number}|null} Null if nothing is stored or
 *          the stored value is unusable
 */
export function loadBestRun() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;

        const data = JSON.parse(raw);

        // Validate rather than trust. localStorage is editable by anyone with
        // devtools, and a NaN reaching the start screen would render as "Best:
        // wave NaN" rather than failing anywhere useful.
        if (typeof data.wave !== 'number' || typeof data.score !== 'number') {
            return null;
        }

        return data;
    } catch {
        return null;
    }
}

/**
 * Forget the stored best run.
 */
export function clearProgress() {
    try {
        localStorage.removeItem(SAVE_KEY);
    } catch {
        // Nothing useful to do if storage is unavailable
    }
}
