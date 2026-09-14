/**
 * settings.js - Persisted player preferences
 *
 * A small key/value store backed by localStorage, holding the things a player
 * configures rather than the things they achieve. economy.js already owns the
 * "best run" record; this is the other half of persistence.
 *
 * Three rules borrowed from economy.js's persistence, for the same reasons:
 *
 * 1. Every read is validated rather than trusted. localStorage is editable by
 *    anyone with devtools, and a masterVolume of "banana" reaching a GainNode
 *    throws deep inside the Web Audio graph rather than anywhere useful.
 * 2. Storage failures are swallowed. Private browsing disables localStorage
 *    entirely, and losing a volume preference is not worth an exception.
 * 3. Defaults live in one place, so a missing key and a corrupt key behave
 *    identically.
 */

const SETTINGS_KEY = 'solarDefense_settings';

/**
 * Coerce a value into the 0-1 range, rejecting anything non-numeric.
 *
 * @param {number} fallback - Used when the value is unusable
 * @returns {Function} A validator for a normalised volume
 */
function volume(fallback) {
    return (value) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
        return Math.min(1, Math.max(0, value));
    };
}

/**
 * Accept one of a fixed set of strings, rejecting anything else.
 *
 * @param {Array<string>} allowed - The permitted values
 * @param {string} fallback - Used when the value is not one of them
 * @returns {Function} A validator for an enumerated setting
 */
function oneOf(allowed, fallback) {
    return (value) => (allowed.includes(value) ? value : fallback);
}

/**
 * Every setting the game knows about: its default, and how to validate it.
 *
 * A key absent from here is not a setting - setSetting() rejects it rather than
 * storing it, so a typo cannot silently create a preference nothing reads.
 *
 * 'auto' on quality and reducedMotion means "keep deciding for me": quality
 * follows the device detection and the frame-time watchdog, reduced motion
 * follows the prefers-reduced-motion media query. Any other value is the player
 * overriding that decision, and the override has to win - including winning
 * against the watchdog, which would otherwise quietly undo it.
 */
const SCHEMA = {
    masterVolume:  { default: 0.7, validate: volume(0.7) },
    sfxVolume:     { default: 0.8, validate: volume(0.8) },
    musicVolume:   { default: 0.5, validate: volume(0.5) },
    quality:       { default: 'auto', validate: oneOf(['auto', 'high', 'medium', 'low'], 'auto') },
    reducedMotion: { default: 'auto', validate: oneOf(['auto', 'on', 'off'], 'auto') }
};

/**
 * In-memory copy of the settings, loaded once on first access.
 *
 * Cached rather than read through to localStorage on every call because
 * getSetting('masterVolume') is called once per sound - a JSON.parse per laser
 * bolt would be absurd.
 */
let cache = null;

/**
 * Listeners notified whenever a setting changes, so the settings screen can
 * move a slider and have the audio graph follow it live.
 */
const listeners = new Set();

/**
 * Read and validate the stored settings, filling in defaults for anything
 * missing or unusable.
 *
 * @returns {object} Every key in SCHEMA, with a valid value
 */
function load() {
    let stored = {};

    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) stored = JSON.parse(raw) || {};
    } catch {
        // Storage unavailable or the stored JSON is malformed. Defaults, then.
        stored = {};
    }

    const result = {};

    for (const [key, spec] of Object.entries(SCHEMA)) {
        result[key] = key in stored ? spec.validate(stored[key]) : spec.default;
    }

    return result;
}

/**
 * Write the cache back to localStorage.
 */
function persist() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(cache));
    } catch {
        // Private browsing, or storage disabled. The setting still applies for
        // this session - it just will not survive a reload.
    }
}

/**
 * Read a setting.
 *
 * @param {string} key - One of the keys in SCHEMA
 * @returns {*} The current value, or undefined if the key is not a setting
 */
export function getSetting(key) {
    if (!cache) cache = load();
    return cache[key];
}

/**
 * Change a setting, validate it, persist it, and notify listeners.
 *
 * @param {string} key - One of the keys in SCHEMA
 * @param {*} value - The new value, validated against the schema
 * @returns {*} The value actually stored, which may differ from the one passed
 *              if it needed clamping
 */
export function setSetting(key, value) {
    if (!cache) cache = load();

    const spec = SCHEMA[key];
    if (!spec) return undefined;

    const validated = spec.validate(value);

    // Notifying on a no-op change would make a slider drag fire a hundred
    // identical updates into the audio graph
    if (cache[key] === validated) return validated;

    cache[key] = validated;
    persist();

    for (const listener of listeners) {
        listener(key, validated);
    }

    return validated;
}

/**
 * Every current setting, as a plain object.
 *
 * A copy rather than the live cache, so a caller cannot mutate settings behind
 * setSetting()'s back and skip both validation and persistence.
 *
 * @returns {object} A snapshot of all settings
 */
export function getAllSettings() {
    if (!cache) cache = load();
    return { ...cache };
}

/**
 * Restore every setting to its default.
 */
export function resetSettings() {
    cache = {};

    for (const [key, spec] of Object.entries(SCHEMA)) {
        cache[key] = spec.default;
    }

    persist();

    for (const listener of listeners) {
        listener(null, null);
    }
}

/**
 * Subscribe to setting changes.
 *
 * @param {Function} listener - Called as listener(key, value). Both are null
 *                             when every setting changed at once, via
 *                             resetSettings().
 * @returns {Function} Call to unsubscribe
 */
export function onSettingChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Drop the in-memory cache so the next read re-reads storage.
 *
 * Only used by tests, which need to simulate a fresh page load without the
 * previous test's cache surviving into it.
 */
export function reloadSettings() {
    cache = null;
}

/**
 * The default value for a setting, without reading what is stored.
 *
 * @param {string} key
 * @returns {*} The schema default, or undefined if the key is not a setting
 */
export function getSettingDefault(key) {
    return SCHEMA[key] ? SCHEMA[key].default : undefined;
}
