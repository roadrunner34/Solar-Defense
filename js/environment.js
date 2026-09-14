/**
 * environment.js - Image-based lighting
 *
 * This module builds the single thing that was missing most from the old look.
 *
 * THE PROBLEM IT SOLVES
 * =====================
 * Swapping MeshPhongMaterial for MeshStandardMaterial does not, on its own,
 * make anything look better. It usually makes things look worse.
 *
 * Phong fakes a shiny surface with a specular highlight: a bright blob facing
 * the light, computed from nothing but the light's position. It is wrong, but
 * it is always *there*. Physically-based materials do not fake anything - a
 * metal surface has essentially no diffuse colour at all, and almost everything
 * you see on it is a reflection of its surroundings. Put a metal hull in a
 * scene with no environment to reflect and it reflects nothing, which renders
 * as flat, dead grey. That is the classic "why does my PBR scene look worse
 * than my Phong scene" trap.
 *
 * The fix is to give the renderer an environment to reflect. Here that is a
 * throwaway scene - a hot sphere where the sun is, a cool fill opposite it,
 * a dark surround - captured to a cubemap and pre-filtered by PMREMGenerator
 * so rough surfaces sample a blurrier version of it than smooth ones do.
 *
 * Assigning the result to scene.environment lights every PBR material in the
 * game at once, and it also removes the need for a separate AmbientLight: the
 * environment IS the ambient term, and unlike a flat ambient it has direction,
 * so the shadowed side of a hull picks up cool blue rather than turning grey.
 */

import * as THREE from 'three';

let environmentTexture = null;

/**
 * Build the environment map and attach it to the scene.
 *
 * @param {THREE.WebGLRenderer} renderer - Needed to render the cubemap
 * @param {THREE.Scene} scene - The scene to light
 * @param {THREE.Vector3} sunPosition - Where the key light sits
 * @returns {THREE.Texture|null} The generated environment texture
 */
export function createEnvironment(renderer, scene, sunPosition) {
    // PMREMGenerator needs a real WebGL context, which bare jsdom does not
    // provide. Tests build scenes without lighting them, so bail quietly.
    if (!renderer || typeof renderer.getContext !== 'function') return null;

    const pmrem = new THREE.PMREMGenerator(renderer);

    // Compiling the equirectangular shader up front avoids a frame-long hitch
    // the first time fromScene runs
    pmrem.compileEquirectangularShader();

    const environmentScene = buildEnvironmentScene(sunPosition);

    // sigma blurs the source before filtering. A small amount softens the hard
    // edges of the stand-in geometry so hulls reflect a gradient rather than a
    // recognisable sphere.
    const target = pmrem.fromScene(environmentScene, 0.04);

    environmentTexture = target.texture;
    scene.environment = environmentTexture;

    // How strongly PBR materials pick the environment up.
    //
    // Metal takes nearly all of its appearance from reflections, so this is
    // effectively the brightness control for every hull in the game. The first
    // pass used 0.65 and the starbase came out almost black - there simply was
    // not enough environment for a metallic surface to reflect. At 1.0 the
    // hulls read as lit metal while the void behind them stays dark, because
    // the environment itself is mostly dark; the intensity scales what is
    // there rather than adding a flat ambient wash.
    scene.environmentIntensity = 1.0;

    disposeEnvironmentScene(environmentScene);
    pmrem.dispose();

    return environmentTexture;
}

/**
 * A tiny scene standing in for "what surrounds the play area".
 *
 * Nothing here is ever seen directly. It exists only to be reflected, so the
 * geometry can be crude - what matters is that the light arriving from each
 * direction is roughly right.
 *
 * @param {THREE.Vector3} sunPosition
 * @returns {THREE.Scene}
 */
function buildEnvironmentScene(sunPosition) {
    const environmentScene = new THREE.Scene();

    // The void. Not pure black: even interstellar space has a faint glow, and
    // pure black here would make every shadowed surface crush to zero.
    const voidGeometry = new THREE.BoxGeometry(100, 100, 100);
    const voidMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.012, 0.016, 0.032),
        side: THREE.BackSide
    });
    environmentScene.add(new THREE.Mesh(voidGeometry, voidMaterial));

    // The key: a hot, blown-out sphere where the sun is. HDR values well above
    // 1 so it dominates the reflection the way a real star would.
    const sunDirection = sunPosition.clone().normalize();

    const keyGeometry = new THREE.SphereGeometry(9, 16, 16);
    const keyMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(9, 6.4, 3.2)
    });
    const key = new THREE.Mesh(keyGeometry, keyMaterial);
    key.position.copy(sunDirection).multiplyScalar(34);
    environmentScene.add(key);

    // A wide, dim, cool fill opposite the key. This is the half of the lighting
    // that stops shadowed surfaces going black, and its blue is what makes the
    // hulls read as metal sitting in space rather than in a grey room.
    const fillGeometry = new THREE.SphereGeometry(30, 16, 16);
    const fillMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.1, 0.19, 0.42)
    });
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.position.copy(sunDirection).multiplyScalar(-40);
    environmentScene.add(fill);

    // Bounce from the home planet below. Subtle, but it is the difference
    // between an object that is floating above a world and one that is
    // floating in a vacuum.
    const bounceGeometry = new THREE.SphereGeometry(22, 16, 16);
    const bounceMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.07, 0.12, 0.26)
    });
    const bounce = new THREE.Mesh(bounceGeometry, bounceMaterial);
    bounce.position.set(0, -34, 0);
    environmentScene.add(bounce);

    return environmentScene;
}

/**
 * Release the stand-in geometry once the cubemap has been captured.
 * @param {THREE.Scene} environmentScene
 */
function disposeEnvironmentScene(environmentScene) {
    environmentScene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
    });
}

/**
 * @returns {THREE.Texture|null} The active environment map
 */
export function getEnvironmentTexture() {
    return environmentTexture;
}

/**
 * Release the environment map.
 */
export function disposeEnvironment() {
    if (environmentTexture) {
        environmentTexture.dispose();
        environmentTexture = null;
    }
}
