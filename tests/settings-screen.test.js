// @vitest-environment jsdom

/**
 * settings-screen.test.js - The settings screen
 *
 * settings.test.js covers the store; this covers the screen that drives it -
 * that the controls reflect what is stored, that changing one writes through,
 * and that Back returns to whichever screen opened it.
 *
 * That last one is the behaviour most worth guarding. Settings is reachable
 * from the start screen and from the pause screen, and a hard-coded return
 * would strand a paused player on the main menu with their run still live.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
    initUI, setupUICallbacks, showScreen, showSettings,
    getSettingsReturnScreen, isSettingsOpen, setSettingsCallbacks
} from '../js/ui.js';

import {
    getSetting, setSetting, resetSettings, reloadSettings
} from '../js/settings.js';

import { initEconomy } from '../js/economy.js';

/**
 * The parts of index.html the settings screen needs, plus the two screens it
 * can be opened from and returned to.
 */
function renderSettingsFixture() {
    document.body.innerHTML = `
        <div id="game-screens">
            <div id="start-screen" class="screen active">
                <button id="start-button">Start</button>
                <button id="settings-start">Settings</button>
            </div>

            <div id="pause-screen" class="screen">
                <button id="resume-button">Resume</button>
                <button id="settings-pause">Settings</button>
            </div>

            <div id="settings-screen" class="screen">
                <label class="setting" for="setting-master-volume">
                    <input type="range" id="setting-master-volume" min="0" max="100" step="1">
                    <output class="setting-value"></output>
                </label>
                <label class="setting" for="setting-sfx-volume">
                    <input type="range" id="setting-sfx-volume" min="0" max="100" step="1">
                    <output class="setting-value"></output>
                </label>
                <label class="setting" for="setting-music-volume">
                    <input type="range" id="setting-music-volume" min="0" max="100" step="1">
                    <output class="setting-value"></output>
                </label>
                <label class="setting" for="setting-quality">
                    <select id="setting-quality">
                        <option value="auto">Automatic</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </label>
                <label class="setting" for="setting-reduced-motion">
                    <select id="setting-reduced-motion">
                        <option value="auto">Follow system</option>
                        <option value="on">On</option>
                        <option value="off">Off</option>
                    </select>
                </label>
                <button id="settings-back">Back</button>
            </div>
        </div>
    `;

    initUI();
    setupUICallbacks({});
}

const el = (id) => document.getElementById(id);
const isActive = (id) => el(id).classList.contains('active');

/** Set a range input's value the way a drag would, firing the input event. */
function drag(id, value) {
    const slider = el(id);
    slider.value = String(value);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Change a select the way a user would. */
function choose(id, value) {
    const select = el(id);
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
    localStorage.clear();
    reloadSettings();
    resetSettings();

    renderSettingsFixture();
    initEconomy();
});

// ==================== NAVIGATION ====================

describe('opening settings', () => {
    it('is not open to begin with', () => {
        expect(isSettingsOpen()).toBe(false);
    });

    it('opens from the start screen', () => {
        el('settings-start').click();

        expect(isSettingsOpen()).toBe(true);
        expect(isActive('start-screen')).toBe(false);
    });

    it('opens from the pause screen', () => {
        showScreen('pause');
        el('settings-pause').click();

        expect(isSettingsOpen()).toBe(true);
        expect(isActive('pause-screen')).toBe(false);
    });
});

describe('returning from settings', () => {
    it('remembers that it was opened from the start screen', () => {
        el('settings-start').click();
        expect(getSettingsReturnScreen()).toBe('start');

        el('settings-back').click();

        expect(isSettingsOpen()).toBe(false);
        expect(isActive('start-screen')).toBe(true);
    });

    // The case that matters: returning to the main menu from here would leave
    // a paused run running behind an un-dismissable screen
    it('returns to the pause screen when opened from pause', () => {
        showScreen('pause');
        el('settings-pause').click();

        expect(getSettingsReturnScreen()).toBe('pause');

        el('settings-back').click();

        expect(isSettingsOpen()).toBe(false);
        expect(isActive('pause-screen')).toBe(true);
        expect(isActive('start-screen')).toBe(false);
    });

    it('can be opened from each screen in turn without confusing the return', () => {
        el('settings-start').click();
        el('settings-back').click();

        showScreen('pause');
        el('settings-pause').click();

        expect(getSettingsReturnScreen()).toBe('pause');
    });
});

// ==================== CONTROLS ====================

describe('control state', () => {
    it('reflects the stored settings when opened', () => {
        setSetting('musicVolume', 0.2);
        setSetting('quality', 'low');

        showSettings('start');

        expect(el('setting-music-volume').value).toBe('20');
        expect(el('setting-quality').value).toBe('low');
    });

    it('re-syncs each time it is opened', () => {
        showSettings('start');
        setSetting('sfxVolume', 0.9);
        showSettings('start');

        expect(el('setting-sfx-volume').value).toBe('90');
    });

    it('shows a percentage beside each volume slider', () => {
        setSetting('masterVolume', 0.45);
        showSettings('start');

        const readout = el('setting-master-volume')
            .parentElement.querySelector('.setting-value');

        expect(readout.textContent).toBe('45%');
    });
});

describe('changing a setting', () => {
    // Sliders read 0-100 because that is what makes sense in a UI; the store
    // keeps 0-1 because that is what a GainNode wants
    it('writes a slider through as a 0-1 value', () => {
        showSettings('start');
        drag('setting-master-volume', 60);

        expect(getSetting('masterVolume')).toBeCloseTo(0.6);
    });

    it('updates the readout as the slider moves', () => {
        showSettings('start');
        drag('setting-sfx-volume', 33);

        const readout = el('setting-sfx-volume')
            .parentElement.querySelector('.setting-value');

        expect(readout.textContent).toBe('33%');
    });

    it('writes a select through', () => {
        showSettings('start');
        choose('setting-quality', 'medium');

        expect(getSetting('quality')).toBe('medium');
    });

    it('persists a change across a reload', () => {
        showSettings('start');
        choose('setting-reduced-motion', 'on');

        reloadSettings();

        expect(getSetting('reducedMotion')).toBe('on');
    });
});

// ==================== CALLBACKS ====================

describe('setSettingsCallbacks()', () => {
    // ui.js knows nothing about the composer, so a quality change has to be
    // handed back out to main.js to reach the renderer
    it('reports a quality change to the host', () => {
        const onSettingApplied = vi.fn();
        setSettingsCallbacks({ onSettingApplied });

        showSettings('start');
        choose('setting-quality', 'low');

        expect(onSettingApplied).toHaveBeenCalledWith('quality', 'low');

        setSettingsCallbacks({ onSettingApplied: null });
    });

    it('does not report volume changes, which apply themselves', () => {
        const onSettingApplied = vi.fn();
        setSettingsCallbacks({ onSettingApplied });

        showSettings('start');
        drag('setting-music-volume', 10);

        expect(onSettingApplied).not.toHaveBeenCalled();

        setSettingsCallbacks({ onSettingApplied: null });
    });
});
