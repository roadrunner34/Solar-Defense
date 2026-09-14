/**
 * selection.js - Clicking on things you own
 *
 * Sprint 2 finished with `sellPlatform()` implemented, tested, and called by
 * nothing. There was no way to click a placed platform, so there was no way to
 * inspect it, upgrade it or sell it. This module is that missing layer.
 *
 * It serves both the platforms and the starbase through one code path, because
 * the moment upgrades exist the starbase becomes a selectable thing too, and
 * two parallel selection systems would drift.
 *
 * WHAT LIVES WHERE
 * ================
 *   selection.js  decides what is selected and describes it
 *   upgrade.js    decides what an improvement costs and does
 *   ui.js         renders a plain view object and reports clicks
 *   platform.js   owns platform state and the range ring geometry
 *
 * The view object handed to ui.js is deliberately dumb - labels and strings.
 * That is what keeps the panel reusable for the starbase, which has no cost, no
 * sell value, and a different set of stats.
 */

import * as THREE from 'three';

import { scene } from './scene.js';
import { platforms, sellPlatform, getSellValue, createRangeIndicator,
         setPlatformTargeting } from './platform.js';
import { starbase, getStarbaseStats, upgradeStarbase,
         getStarbaseTargeting, setStarbaseTargeting } from './starbase.js';
import { getPlatformConfig, CONFIG } from './config.js';
import { playSound } from './audio.js';
import { TARGETING_MODES, TARGETING_LABELS, DEFAULT_TARGETING } from './targeting.js';
import {
    UPGRADE_STATS,
    describeUpgrades,
    purchaseUpgrade,
    getUpgradeTier,
    getUpgradedValue
} from './upgrade.js';
import { showSelectionPanel, hideSelectionPanel, setSelectionCallbacks } from './ui.js';

// What is currently selected: a platform object, the starbase marker, or null
let selected = null;
let rangeRing = null;

// The starbase is a THREE.Group rather than a game object with stats on it, so
// selection wraps it in a stand-in that carries the upgrade tiers. Kept at
// module scope so tiers survive being deselected and reselected.
const starbaseTarget = {
    isStarbase: true,
    name: 'Starbase',
    upgradeTiers: {}
};

const raycaster = new THREE.Raycaster();

// ==================== SETUP ====================

/**
 * Wire the panel's buttons to this module.
 * Called once during init.
 */
export function initSelection() {
    setSelectionCallbacks({
        onUpgrade: handleUpgrade,
        onSell: handleSell,
        onClose: clearSelection,
        onTargeting: handleTargeting
    });
}

// ==================== PICKING ====================

/**
 * Try to select whatever is under the cursor.
 *
 * @param {THREE.Camera} camera
 * @param {THREE.Vector2} normalisedMouse - Mouse in -1..1 clip space
 * @returns {boolean} True if something was selected or deselected
 */
export function handleSelectionClick(camera, normalisedMouse) {
    raycaster.setFromCamera(normalisedMouse, camera);

    // Platforms are Groups of many small meshes, so the ray has to test
    // descendants - `true` is the recursive flag. Without it a click would only
    // ever hit a Group's own (non-existent) geometry and always miss.
    const candidates = platforms.filter(p => p.alive).map(p => p.mesh);
    if (starbase) candidates.push(starbase);

    const intersections = raycaster.intersectObjects(candidates, true);

    if (intersections.length === 0) {
        // A click on empty space dismisses the panel. This is what players
        // expect, and without it the only way to close it is the small X.
        clearSelection();
        return false;
    }

    const hit = findOwner(intersections[0].object);
    if (!hit) return false;

    select(hit);
    return true;
}

/**
 * Walk up the scene graph from a hit mesh to the thing that owns it.
 *
 * Platforms store a back-reference in mesh.userData; the starbase is matched by
 * identity. Either way the search has to climb, because the ray hits a barrel
 * or a fin, not the root.
 *
 * @param {THREE.Object3D} object
 * @returns {object|null} A platform, the starbase stand-in, or null
 */
function findOwner(object) {
    let node = object;

    while (node) {
        if (node.userData && node.userData.platform) return node.userData.platform;
        if (starbase && node === starbase) return starbaseTarget;
        node = node.parent;
    }

    return null;
}

// ==================== SELECTION STATE ====================

/**
 * Select a platform or the starbase.
 * @param {object} target
 */
export function select(target) {
    if (selected === target) {
        refreshPanel();
        return;
    }

    clearSelection();
    selected = target;

    showRangeRing(target);
    refreshPanel();
}

/**
 * Deselect, hiding the panel and the range ring.
 */
export function clearSelection() {
    selected = null;
    removeRangeRing();
    hideSelectionPanel();
}

/**
 * @returns {object|null} The selected platform or starbase stand-in
 */
export function getSelected() {
    return selected;
}

/**
 * Drop the selection and reset the starbase's upgrade tiers.
 * Called when a run restarts.
 */
export function resetSelection() {
    clearSelection();
    starbaseTarget.upgradeTiers = {};
}

// ==================== RANGE RING ====================

/**
 * Draw a ring showing what the selected structure covers.
 *
 * Reuses createRangeIndicator() from platform.js, which until now only existed
 * for the placement ghost and was torn down the instant a platform was
 * confirmed. Showing it on selection is what makes range legible after the fact
 * - the moment a player is actually deciding whether the coverage is right.
 *
 * @param {object} target
 */
function showRangeRing(target) {
    const range = target.isStarbase ? getStarbaseStats().range : target.range;
    const position = target.isStarbase ? starbase.position : target.position;

    rangeRing = createRangeIndicator(range);
    rangeRing.position.copy(position);

    // Sat on the orbital plane rather than the structure's own height, so the
    // ring reads as coverage over the battlefield instead of a halo
    rangeRing.position.y = 0;

    rangeRing.material.color.set(0x58c8f0);
    rangeRing.material.opacity = 0.65;

    scene.add(rangeRing);
}

/**
 * Remove the range ring and release its GPU resources.
 */
function removeRangeRing() {
    if (!rangeRing) return;

    scene.remove(rangeRing);
    rangeRing.geometry.dispose();
    rangeRing.material.dispose();
    rangeRing = null;
}

// ==================== PANEL CONTENTS ====================

/**
 * Rebuild the panel for whatever is selected.
 *
 * Called after every state change - selection, upgrade, and once per second
 * from the game loop so kill counts and upgrade affordability stay live while
 * the panel is open.
 */
export function refreshPanel() {
    if (!selected) return;

    showSelectionPanel(
        selected.isStarbase ? describeStarbase() : describePlatform(selected)
    );
}

/**
 * @param {object} platform
 * @returns {object} View object for ui.showSelectionPanel
 */
function describePlatform(platform) {
    const base = getPlatformConfig(platform.type);

    return {
        name: formatName(platform.type),

        stats: [
            statRow('Damage', platform.damage, base.damage, platform, 'damage'),
            statRow('Range', platform.range, base.range, platform, 'range'),
            statRow('Fire rate', platform.fireRate, base.fireRate, platform, 'fireRate', '/s'),
            { label: 'Kills', value: String(platform.kills) },
            { label: 'Shots fired', value: String(platform.shotsFired) },
            { label: 'Damage dealt', value: String(Math.round(platform.damageDealt)) }
        ],

        upgrades: describeUpgrades(platform),
        targeting: describeTargeting(platform.targeting || DEFAULT_TARGETING),
        sellValue: getSellValue(platform)
    };
}

/**
 * Build the targeting view for the panel.
 *
 * Shared by platforms and the starbase, because both choose their own target
 * and both deserve the same control - the starbase is the longest-ranged weapon
 * on the board, so which enemy it picks matters more than for anything else.
 *
 * @param {string} current - The active mode
 * @returns {{current: string, modes: Array<{id: string, label: string}>}}
 */
function describeTargeting(current) {
    return {
        current,
        modes: TARGETING_MODES.map(id => ({ id, label: TARGETING_LABELS[id] }))
    };
}

/**
 * @returns {object} View object for the starbase
 */
function describeStarbase() {
    const live = getStarbaseStats();
    const base = CONFIG.starbase;

    return {
        name: 'Starbase',

        stats: [
            statRow('Damage', live.damage, base.damage, starbaseTarget, 'damage'),
            statRow('Range', live.range, base.range, starbaseTarget, 'range'),
            statRow('Fire rate', live.fireRate, base.fireRate, starbaseTarget, 'fireRate', '/s')
        ],

        upgrades: describeUpgrades(starbaseTarget),
        targeting: describeTargeting(getStarbaseTargeting()),

        // The starbase is the thing being defended. Selling it would be an
        // instant loss dressed up as a refund, so it has no sell value and
        // ui.js hides the button when this is absent.
        sellValue: null
    };
}

/**
 * Build one stat row, marking it as upgraded when it is above base.
 *
 * @param {string} label
 * @param {number} value - Current value
 * @param {number} baseValue
 * @param {object} target
 * @param {string} stat
 * @param {string} [suffix]
 * @returns {{label: string, value: string, upgraded: boolean}}
 */
function statRow(label, value, baseValue, target, stat, suffix = '') {
    const tier = getUpgradeTier(target, stat);

    // Round to at most two decimals, then let Number drop any trailing zeros.
    // toFixed alone would render a 1.2 fire rate as "1.20", which reads as
    // false precision on a stat the player is meant to compare at a glance.
    const shown = String(Number(value.toFixed(2)));

    return {
        label: tier > 0 ? `${label} (${'I'.repeat(tier)})` : label,
        value: `${shown}${suffix}`,
        upgraded: value > baseValue
    };
}

/**
 * laserBattery -> Laser Battery
 * @param {string} type
 * @returns {string}
 */
function formatName(type) {
    return type
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, character => character.toUpperCase());
}

// ==================== ACTIONS ====================

/**
 * Buy an upgrade for whatever is selected.
 *
 * The write-back differs between targets - a platform's stats live on the
 * platform object, the starbase's behind upgradeStarbase() - so the branch is
 * here rather than in upgrade.js, which stays purely about cost and tier maths.
 *
 * @param {string} stat - 'damage', 'range' or 'fireRate'
 */
function handleUpgrade(stat) {
    if (!selected || !UPGRADE_STATS.includes(stat)) return;

    let result;

    if (selected.isStarbase) {
        const base = CONFIG.starbase;

        result = purchaseUpgrade(starbaseTarget, stat, base, (upgradedStat, value) => {
            // upgradeStarbase() adds to the current value rather than setting
            // it, so hand it the difference from where the stat is now
            const current = getStarbaseStats()[upgradedStat];
            upgradeStarbase(upgradedStat, value - current);
        });
    } else {
        const base = getPlatformConfig(selected.type);

        result = purchaseUpgrade(selected, stat, base, (upgradedStat, value) => {
            selected[upgradedStat] = value;
        });

        applyUpgradeVisual(selected);
    }

    // Only on an upgrade that actually happened. purchaseUpgrade() refuses a
    // maxed stat or an unaffordable one, and a confirmation chime for a
    // purchase that was declined is worse than no sound at all.
    if (result && result.success) playSound('upgrade');

    refreshPanel();
}

/**
 * Make an upgraded platform look upgraded.
 *
 * Emissive intensity rises with total investment, so a tier-3 platform reads as
 * hotter than a fresh one from across the map. Without a visual tell, upgrades
 * are invisible outside the panel - and a player scanning the board has no way
 * to remember which positions they have already poured credits into.
 *
 * @param {object} platform
 */
function applyUpgradeVisual(platform) {
    const totalTiers = UPGRADE_STATS.reduce(
        (sum, stat) => sum + getUpgradeTier(platform, stat), 0
    );

    const boost = 1 + totalTiers * 0.32;

    platform.mesh.traverse((child) => {
        if (!child.material || !child.material.emissive) return;

        // Only the pieces that were already meant to glow. Raising emissive on
        // the hull plating would make the whole platform luminous rather than
        // making its weapon look charged.
        if (child.material.emissiveIntensity !== undefined) {
            child.material.emissiveIntensity = boost;
        }
    });

    // The accent pieces use MeshBasicMaterial with HDR colour and no emissive
    // property, so they scale by colour instead
    const accents = platform.mesh.getObjectByName('muzzle');
    if (accents && accents.material && accents.material.color) {
        accents.material.color.multiplyScalar(1 + totalTiers * 0.06);
    }
}

/**
 * Change the selected structure's targeting priority.
 *
 * The write-back differs between targets the same way upgrades do - a
 * platform's priority lives on the platform object, the starbase's behind a
 * module-scope variable - so the branch is here rather than in targeting.js,
 * which stays purely about choosing an enemy.
 *
 * @param {string} mode - One of TARGETING_MODES
 */
function handleTargeting(mode) {
    if (!selected) return;

    const applied = selected.isStarbase
        ? setStarbaseTargeting(mode)
        : setPlatformTargeting(selected, mode);

    if (!applied) return;

    playSound('uiClick');
    refreshPanel();
}

/**
 * Sell the selected platform.
 * @returns {number} Credits refunded
 */
function handleSell() {
    if (!selected || selected.isStarbase) return 0;

    const refund = sellPlatform(selected);
    if (refund > 0) playSound('sell');

    clearSelection();

    return refund;
}
