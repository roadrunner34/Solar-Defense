// @vitest-environment jsdom

/**
 * settings.test.js - Persisted player preferences
 *
 * Needs a DOM environment for localStorage. The node environment has none, and
 * while settings.js is written to survive that (it falls back to defaults), the
 * interesting behaviour here is what happens when storage *does* work.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
    getSetting, setSetting, getAllSettings, resetSettings,
    onSettingChange, reloadSettings, getSettingDefault
} from '../js/settings.js';

const STORAGE_KEY = 'solarDefense_settings';

beforeEach(() => {
    localStorage.clear();

    // settings.js caches the loaded object, so a test that writes storage
    // directly has to drop the cache to simulate a fresh page load
    reloadSettings();
});

describe('defaults', () => {
    it('returns a default for every known setting', () => {
        const settings = getAllSettings();

        expect(typeof settings.masterVolume).toBe('number');
        expect(typeof settings.sfxVolume).toBe('number');
        expect(typeof settings.musicVolume).toBe('number');
        expect(settings.quality).toBe('auto');
        expect(settings.reducedMotion).toBe('auto');
    });

    it('returns undefined for a key that is not a setting', () => {
        expect(getSetting('nonsense')).toBeUndefined();
        expect(getSettingDefault('nonsense')).toBeUndefined();
    });

    // 'auto' means "keep deciding for me" - quality follows device detection
    // and the frame-time watchdog, reduced motion follows the media query
    it('defaults the two overridable systems to auto', () => {
        expect(getSettingDefault('quality')).toBe('auto');
        expect(getSettingDefault('reducedMotion')).toBe('auto');
    });
});

describe('setSetting()', () => {
    it('stores and returns a valid value', () => {
        expect(setSetting('musicVolume', 0.25)).toBe(0.25);
        expect(getSetting('musicVolume')).toBe(0.25);
    });

    it('clamps a volume above 1', () => {
        expect(setSetting('masterVolume', 4)).toBe(1);
    });

    it('clamps a volume below 0', () => {
        expect(setSetting('masterVolume', -1)).toBe(0);
    });

    it('rejects a non-numeric volume and falls back to the default', () => {
        setSetting('sfxVolume', 'loud');
        expect(getSetting('sfxVolume')).toBe(getSettingDefault('sfxVolume'));
    });

    it('rejects a quality tier that does not exist', () => {
        setSetting('quality', 'ultra');
        expect(getSetting('quality')).toBe('auto');
    });

    it('accepts every quality tier the graphics config defines', () => {
        for (const tier of ['auto', 'high', 'medium', 'low']) {
            expect(setSetting('quality', tier)).toBe(tier);
        }
    });

    // A typo should not silently create a preference that nothing ever reads
    it('refuses a key that is not in the schema', () => {
        expect(setSetting('volumee', 0.5)).toBeUndefined();
        expect(getAllSettings().volumee).toBeUndefined();
    });
});

describe('persistence', () => {
    it('survives a reload', () => {
        setSetting('musicVolume', 0.1);
        reloadSettings();

        expect(getSetting('musicVolume')).toBe(0.1);
    });

    it('writes to the expected storage key', () => {
        setSetting('quality', 'low');

        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        expect(stored.quality).toBe('low');
    });

    // localStorage is editable by anyone with devtools, so a stored value is
    // validated on the way back in rather than trusted
    it('repairs a corrupt stored value', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ masterVolume: 'banana' }));
        reloadSettings();

        expect(getSetting('masterVolume')).toBe(getSettingDefault('masterVolume'));
    });

    it('survives malformed JSON in storage', () => {
        localStorage.setItem(STORAGE_KEY, '{not json');
        reloadSettings();

        expect(getSetting('quality')).toBe('auto');
    });

    it('fills in settings missing from an older stored object', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ masterVolume: 0.3 }));
        reloadSettings();

        expect(getSetting('masterVolume')).toBe(0.3);
        expect(getSetting('musicVolume')).toBe(getSettingDefault('musicVolume'));
    });

    it('does not throw when storage is unavailable', () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

        expect(() => setSetting('masterVolume', 0.2)).not.toThrow();

        // The setting still applies for this session, it just will not persist
        expect(getSetting('masterVolume')).toBe(0.2);

        setItem.mockRestore();
    });
});

describe('resetSettings()', () => {
    it('restores every default', () => {
        setSetting('masterVolume', 0.1);
        setSetting('quality', 'low');

        resetSettings();

        expect(getSetting('masterVolume')).toBe(getSettingDefault('masterVolume'));
        expect(getSetting('quality')).toBe('auto');
    });
});

describe('onSettingChange()', () => {
    it('notifies listeners of a change', () => {
        const listener = vi.fn();
        const unsubscribe = onSettingChange(listener);

        setSetting('sfxVolume', 0.4);

        expect(listener).toHaveBeenCalledWith('sfxVolume', 0.4);
        unsubscribe();
    });

    // A slider drag fires a change event per pixel; without this, each one
    // would push an identical value into the audio graph
    it('stays silent when the value did not actually change', () => {
        setSetting('sfxVolume', 0.4);

        const listener = vi.fn();
        const unsubscribe = onSettingChange(listener);

        setSetting('sfxVolume', 0.4);

        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });

    it('stops notifying after unsubscribe', () => {
        const listener = vi.fn();
        const unsubscribe = onSettingChange(listener);

        unsubscribe();
        setSetting('sfxVolume', 0.15);

        expect(listener).not.toHaveBeenCalled();
    });
});

describe('getAllSettings()', () => {
    // Mutating the returned object must not be a way to skip validation
    it('returns a copy, not the live store', () => {
        const snapshot = getAllSettings();
        snapshot.masterVolume = 99;

        expect(getSetting('masterVolume')).not.toBe(99);
    });
});
