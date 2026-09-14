/**
 * materials.js - Shared surface definitions
 *
 * One place to decide what metal looks like in this game, so the starbase, the
 * platforms and anything added later agree without copying numbers around.
 *
 * WHY THIS EXISTS AS A FACTORY RATHER THAN A CONSTANT
 * ==================================================
 * The starbase and the two platform types between them build around twenty
 * materials, each with slightly different colour and finish. Sharing one
 * material object would flatten all that variation; hand-writing twenty
 * MeshStandardMaterial literals would scatter the same six properties across
 * two files and guarantee they drift apart.
 *
 * The factory takes the *intent* - "this is dark, fairly polished metal" - and
 * owns the translation into PBR parameters, including the two traps below.
 *
 * TRAP 1: MAPS MULTIPLY, THEY DO NOT REPLACE
 * ==========================================
 * When a roughnessMap is present, the final roughness is
 * `material.roughness * roughnessMap.g`, not the map alone. Set roughness to
 * the value you actually want and a map averaging 0.6 silently makes every
 * surface 40% shinier than intended. The factory divides through by the map's
 * average so the number a caller passes is the number they get.
 *
 * TRAP 2: SHININESS AND ROUGHNESS RUN IN OPPOSITE DIRECTIONS
 * ==========================================================
 * Phong's `shininess` counts up toward glossy; PBR's `roughness` counts up
 * toward matte. Callers migrated from Phong can keep passing shininess and the
 * factory inverts it, which is what let the conversion of both weapon files be
 * a mechanical rename rather than twenty judgement calls.
 */

import * as THREE from 'three';

import { createHullMaps } from './textures.js';

// Average brightness of the generated maps, used to undo the multiply
// described in TRAP 1 above. Kept as constants rather than measured, because
// measuring would mean reading pixels back off the canvas on every startup.
const ROUGHNESS_MAP_AVERAGE = 0.6;
const METALNESS_MAP_AVERAGE = 0.85;

let hullMaps = null;

/**
 * Generate the hull maps once and share them.
 *
 * Every hull material in the game samples the same plating. That is realistic -
 * a fleet is built in the same yards from the same stock - and it means the
 * 512x512 canvas work happens once per session rather than twenty times.
 *
 * @returns {{map: THREE.Texture, roughnessMap: THREE.Texture, metalnessMap: THREE.Texture}}
 */
function getHullMaps() {
    if (!hullMaps) hullMaps = createHullMaps(512);
    return hullMaps;
}

/**
 * Build a hull material.
 *
 * Accepts the option names the Phong materials used, so converting a call site
 * is a rename. Anything not listed is passed straight through to
 * MeshStandardMaterial.
 *
 * @param {object} [options]
 * @param {number|THREE.Color} [options.color] - Base tint
 * @param {number} [options.shininess] - Phong-style gloss, inverted to roughness
 * @param {number} [options.roughness] - Takes precedence over shininess
 * @param {number} [options.metalness]
 * @param {boolean} [options.flatShading]
 * @param {boolean} [options.plated] - False for small parts that should stay smooth
 * @returns {THREE.MeshStandardMaterial}
 */
export function createHullMaterial(options = {}) {
    const {
        color = 0x8d95a3,
        shininess,
        roughness,
        metalness = 0.6,
        plated = true,
        ...rest
    } = options;

    // Invert Phong gloss into PBR roughness. The 140 divisor maps the range the
    // old materials actually used (shininess 0-40) onto a believable metal
    // finish rather than a mirror.
    const intendedRoughness = roughness !== undefined
        ? roughness
        : (shininess !== undefined
            ? Math.max(0.16, Math.min(0.95, 1 - shininess / 140))
            : 0.58);

    // TRAP 3: THE SAME HEX READS DARKER UNDER PBR
    //
    // These colours were originally picked against Phong, which adds a specular
    // highlight on top of whatever diffuse colour you give it. Metal under PBR
    // has almost no diffuse term at all - what you see is reflection - so the
    // identical hex comes out markedly darker. Lifting the base tone toward
    // white restores the intent without needing to re-pick twenty colours by
    // hand across two files.
    const albedo = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35);

    const material = new THREE.MeshStandardMaterial({
        color: albedo,
        ...rest
    });

    if (plated) {
        const maps = getHullMaps();

        material.map = maps.map;
        material.roughnessMap = maps.roughnessMap;
        material.metalnessMap = maps.metalnessMap;

        // Undo the map multiply so the caller's number survives (TRAP 1)
        material.roughness = Math.min(1, intendedRoughness / ROUGHNESS_MAP_AVERAGE);
        material.metalness = Math.min(1, metalness / METALNESS_MAP_AVERAGE);
    } else {
        material.roughness = intendedRoughness;
        material.metalness = metalness;
    }

    return material;
}

/**
 * Build an enemy hull.
 *
 * Enemies read by colour - that is how a player tells a fast one from an
 * armoured one at a glance - but a flat saturated solid reads as a game token
 * rather than a craft. So the body goes dark and metallic, and the type colour
 * moves into the emissive term where it glows instead of merely being coloured.
 * Silhouette and glow carry the identification; the hull carries the material.
 *
 * The emissive property is left as the thing the hit flash writes to, so
 * flashEnemy() in enemy.js keeps working untouched.
 *
 * @param {number} color - The type's identifying colour
 * @returns {THREE.MeshStandardMaterial}
 */
export function createEnemyMaterial(color) {
    const base = new THREE.Color(color);

    return new THREE.MeshStandardMaterial({
        // A dark version of the type colour, so even unlit facets still hint at
        // which enemy this is
        color: base.clone().multiplyScalar(0.28),

        emissive: base.clone().multiplyScalar(0.55),
        emissiveIntensity: 1,

        metalness: 0.7,
        roughness: 0.34,

        // Kept from the original materials: hard facet edges are what make
        // three primitives read as three distinct ship classes
        flatShading: true
    });
}

/**
 * Release the shared hull maps. Used by tests and teardown.
 */
export function disposeMaterials() {
    if (!hullMaps) return;

    Object.values(hullMaps).forEach((texture) => texture.dispose());
    hullMaps = null;
}
