// @vitest-environment jsdom
/**
 * ui.test.js - HUD and build menu
 *
 * Sprint 2 Epic 5. The build menu is generated from CONFIG.platforms rather
 * than written into the HTML, so these tests double as a check that adding a
 * platform type to the config surfaces it in the UI with the right stats.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initUI, initBuildMenu, updateBuildMenu, updateHUD, getPlatformHotkey } from '../js/ui.js';
import { initEconomy, spendCredits } from '../js/economy.js';
import { CONFIG } from '../js/config.js';

/** The parts of index.html the UI module reaches for. */
function renderHudFixture() {
    document.body.innerHTML = `
        <div id="hud">
            <div id="wave-number"></div>
            <div id="enemies-remaining"></div>
            <div id="score"></div>
            <div id="credits"></div>
            <div id="build-menu"></div>
        </div>
    `;
    initUI();
}

const buttons = () => [...document.querySelectorAll('.build-option')];
const buttonFor = (type) => document.querySelector(`.build-option[data-type="${type}"]`);

beforeEach(() => {
    renderHudFixture();
    initEconomy();
});

describe('initBuildMenu()', () => {
    it('creates a button for every configured platform type', () => {
        initBuildMenu(() => {});

        const types = buttons().map(b => b.dataset.type);
        expect(types).toEqual(Object.keys(CONFIG.platforms));
    });

    it('shows each platform\'s real cost and stats', () => {
        initBuildMenu(() => {});

        for (const [type, config] of Object.entries(CONFIG.platforms)) {
            const text = buttonFor(type).textContent;
            expect(text).toContain(String(config.cost));
            expect(text).toContain(String(config.damage));
            expect(text).toContain(String(config.range));
        }
    });

    it('gives each platform a readable name', () => {
        initBuildMenu(() => {});
        expect(buttonFor('laserBattery').textContent).toContain('Laser Battery');
        expect(buttonFor('missileLauncher').textContent).toContain('Missile Launcher');
    });

    it('labels each platform with its hotkey, in config order', () => {
        initBuildMenu(() => {});
        expect(getPlatformHotkey('laserBattery')).toBe('1');
        expect(getPlatformHotkey('missileLauncher')).toBe('2');
        expect(buttonFor('missileLauncher').textContent).toContain('2');
    });

    it('reports the chosen platform type when a button is clicked', () => {
        const chosen = [];
        initBuildMenu(type => chosen.push(type));

        buttonFor('missileLauncher').click();

        expect(chosen).toEqual(['missileLauncher']);
    });

    it('can be rebuilt without duplicating buttons', () => {
        initBuildMenu(() => {});
        initBuildMenu(() => {});

        expect(buttons().length).toBe(Object.keys(CONFIG.platforms).length);
    });
});

describe('updateBuildMenu()', () => {
    beforeEach(() => {
        initBuildMenu(() => {});
    });

    it('leaves affordable platforms enabled', () => {
        initEconomy(1000);
        updateBuildMenu();

        for (const button of buttons()) {
            expect(button.disabled).toBe(false);
            expect(button.classList.contains('unaffordable')).toBe(false);
        }
    });

    it('greys out and disables what the player cannot afford', () => {
        // Enough for the laser battery, not the missile launcher
        initEconomy(CONFIG.platforms.laserBattery.cost);
        updateBuildMenu();

        expect(buttonFor('laserBattery').disabled).toBe(false);
        expect(buttonFor('missileLauncher').disabled).toBe(true);
        expect(buttonFor('missileLauncher').classList.contains('unaffordable')).toBe(true);
    });

    it('treats an exact balance as affordable', () => {
        initEconomy(CONFIG.platforms.missileLauncher.cost);
        updateBuildMenu();

        expect(buttonFor('missileLauncher').disabled).toBe(false);
    });

    it('disables everything when the player is broke', () => {
        initEconomy(0);
        updateBuildMenu();

        expect(buttons().every(b => b.disabled)).toBe(true);
    });

    it('marks the platform currently being placed as selected', () => {
        updateBuildMenu('missileLauncher');

        expect(buttonFor('missileLauncher').classList.contains('selected')).toBe(true);
        expect(buttonFor('laserBattery').classList.contains('selected')).toBe(false);
    });

    it('clears the selection when nothing is being placed', () => {
        updateBuildMenu('missileLauncher');
        updateBuildMenu(null);

        expect(buttons().some(b => b.classList.contains('selected'))).toBe(false);
    });
});

describe('updateHUD()', () => {
    beforeEach(() => {
        initBuildMenu(() => {});
    });

    it('refreshes affordability as credits are spent', () => {
        initEconomy(1000);
        updateHUD(1);
        expect(buttonFor('missileLauncher').disabled).toBe(false);

        spendCredits(950);
        updateHUD(1);
        expect(buttonFor('missileLauncher').disabled).toBe(true);
    });

    it('shows the wave number and credit balance', () => {
        initEconomy(250);
        updateHUD(4);

        expect(document.getElementById('wave-number').textContent).toBe('4');
        expect(document.getElementById('credits').textContent).toBe('250');
    });

    it('passes the selected platform type through to the menu', () => {
        updateHUD(1, 'laserBattery');
        expect(buttonFor('laserBattery').classList.contains('selected')).toBe(true);
    });
});
