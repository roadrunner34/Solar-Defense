/**
 * scene.js - The 3D stage
 *
 * Builds everything that is not gameplay: the star, the home planet, the
 * backdrop, the asteroid belt, the defence grid and the lighting rig.
 *
 * WHAT CHANGED AND WHY
 * ====================
 * This scene used to be flat-coloured MeshPhongMaterial under four lights. It
 * is now physically-based, lit by an environment map, and textured entirely
 * from procedurally generated canvases (see textures.js and environment.js).
 * Three decisions are worth knowing about before editing:
 *
 * 1. No shadow maps. A space scene has no ground plane, so there is nothing
 *    for a shadow to fall on - enabling them would cost a full depth pass per
 *    light and change nothing on screen. The sense of form comes from the
 *    environment map's directionality instead.
 *
 * 2. Two lights, not four. The old rig had a PointLight and a DirectionalLight
 *    at the *same position*, double-lighting everything from one apparent
 *    source, plus an AmbientLight flattening the result. The environment map
 *    now supplies the ambient term with direction, so ambient is gone and the
 *    duplicate directional went with it.
 *
 * 3. The starfield and nebula opt out of fog. The old fog ran from 50 to 200
 *    units while stars sat at 150-200, so every star was between half and
 *    fully faded into the background colour. That is why the sky used to look
 *    empty.
 */

import * as THREE from 'three';

import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

import { CONFIG } from './config.js';
import { createEnvironment } from './environment.js';
import {
    createPlanetMaps,
    createCloudTexture,
    createRockMaps,
    createStarSprite,
    createNebulaTexture
} from './textures.js';
import { getTierSettings } from './postprocessing.js';

// Exported so other modules can add objects and aim at the planet
export let scene;
export let sun;
export let homePlanet;

// Where the star sits.
//
// Chosen against the default camera position of (0, 40, 50): far enough to the
// left and high enough to rake across the play area, but still on the camera's
// side of the planet so the day/night terminator falls across the visible face.
// Directly behind the planet - which is where it used to be - meant the player
// only ever saw the night side, and all that surface detail went to waste.
const SUN_POSITION = new THREE.Vector3(-78, 34, 22);

// Animated pieces, stepped by updateScene()
let sunMaterial = null;
let cloudLayer = null;
let starMaterial = null;
let asteroidField = null;
let asteroidDrift = [];
let ringMaterials = [];
let planetShield = null;
let shieldMaterial = null;
let elapsed = 0;

// ==================== GLSL HELPERS ====================

/**
 * Cheap 3D value noise for the shaders below.
 *
 * Deliberately not a texture lookup. A star's surface needs to animate, and
 * scrolling a texture reads as a scrolling texture - the pattern slides rather
 * than churns. Evaluating noise per-pixel against a time-varying coordinate
 * gives convection that boils in place, which is what plasma actually does.
 */
const GLSL_NOISE = /* glsl */ `
    float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);

        return mix(
            mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z
        );
    }

    float fbm(vec3 p) {
        float total = 0.0;
        float amplitude = 0.5;

        for (int i = 0; i < 5; i++) {
            total += noise(p) * amplitude;
            p *= 2.02;
            amplitude *= 0.5;
        }

        return total;
    }
`;

// ==================== SCENE ROOT ====================

/**
 * Build the complete scene.
 *
 * @param {THREE.WebGLRenderer} [renderer] - Required for image-based lighting.
 *        Omitted in tests, which build the scene without lighting it.
 * @returns {THREE.Scene}
 */
export function createScene(renderer = null) {
    scene = new THREE.Scene();

    scene.background = new THREE.Color(0x03050e);

    // Gentle, and starting well beyond the play area. The old fog began at 50
    // units - inside the space enemies fly through - and swallowed the sky.
    scene.fog = new THREE.Fog(0x060a16, 110, 340);

    createNebula();
    createStarfield();
    createSun();
    createHomePlanet();
    createPlanetShield();
    createBackgroundPlanets();
    createAsteroidField();
    createOrbitalRings();
    setupLighting();

    // Must come last: it reads nothing from the scene, but assigning
    // scene.environment after the materials exist means they pick it up on
    // their next frame without needing needsUpdate flags.
    if (renderer) {
        createEnvironment(renderer, scene, SUN_POSITION);
    }

    return scene;
}

// ==================== BACKDROP ====================

/**
 * The nebula shell: a large inward-facing sphere carrying a procedural gas
 * cloud.
 *
 * Replaces a flat background colour. Deep space is not uniformly black - it
 * has structure, and even a very dim one gives the eye something to register
 * camera rotation against. Without it, orbiting the camera over a flat colour
 * feels like nothing is moving.
 */
function createNebula() {
    if (!getTierSettings().nebula) return;

    const geometry = new THREE.SphereGeometry(420, 32, 24);
    const material = new THREE.MeshBasicMaterial({
        map: createNebulaTexture(),
        side: THREE.BackSide,
        depthWrite: false,
        fog: false, // Sits far outside the fog range; fogging it would grey it out
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.85
    });

    const shell = new THREE.Mesh(geometry, material);
    shell.renderOrder = -2;
    scene.add(shell);
}

/**
 * The starfield.
 *
 * A ShaderMaterial rather than PointsMaterial, for three things PointsMaterial
 * cannot do: per-star colour, per-star size, and twinkle. Stars also come in
 * colours - hot blue-white through to cool orange - and a field of uniformly
 * white dots is one of those details that reads as "computer graphics" without
 * anyone being able to say why.
 *
 * Using a ShaderMaterial also sidesteps the fog problem for free: fog is only
 * applied to materials that ask for it.
 */
function createStarfield() {
    const starCount = getTierSettings().starCount;

    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const phases = new Float32Array(starCount);

    // Rough stellar classes, weighted toward the dim and cool - which is how
    // the real sky is distributed
    const CLASSES = [
        { color: [0.62, 0.72, 1.00], weight: 0.10, size: 2.6 }, // Blue-white
        { color: [1.00, 1.00, 1.00], weight: 0.30, size: 1.9 }, // White
        { color: [1.00, 0.94, 0.80], weight: 0.38, size: 1.5 }, // Yellow
        { color: [1.00, 0.76, 0.52], weight: 0.22, size: 1.2 }  // Orange
    ];

    for (let i = 0; i < starCount; i++) {
        // Even distribution over a sphere. acos(2r - 1) rather than a plain
        // random angle, which would crowd stars at the poles.
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 240 + Math.random() * 120;

        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);

        let roll = Math.random();
        let starClass = CLASSES[CLASSES.length - 1];

        for (const candidate of CLASSES) {
            if (roll < candidate.weight) {
                starClass = candidate;
                break;
            }
            roll -= candidate.weight;
        }

        // Brightness varies far more than colour does, so most stars are faint
        // and a handful are conspicuous
        const brightness = 0.35 + Math.pow(Math.random(), 2.2) * 0.65;

        colors[i * 3] = starClass.color[0] * brightness;
        colors[i * 3 + 1] = starClass.color[1] * brightness;
        colors[i * 3 + 2] = starClass.color[2] * brightness;

        sizes[i] = starClass.size * (0.6 + Math.random() * 0.9);
        phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('starSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    starMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            sprite: { value: createStarSprite() },
            // Guarded: two test files build the scene in Vitest's node
            // environment, where there is no window at all
            scale: { value: (typeof window === 'undefined' ? 900 : window.innerHeight) * 0.5 }
        },

        vertexShader: /* glsl */ `
            attribute vec3 starColor;
            attribute float starSize;
            attribute float phase;

            uniform float time;
            uniform float scale;

            varying vec3 vColor;

            void main() {
                vColor = starColor;

                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

                // Twinkle. Two frequencies that do not divide evenly, so the
                // field never falls into a visible collective rhythm.
                float twinkle = 0.82
                    + sin(time * 1.7 + phase) * 0.12
                    + sin(time * 3.1 + phase * 2.3) * 0.06;

                gl_PointSize = starSize * twinkle * (scale / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,

        fragmentShader: /* glsl */ `
            uniform sampler2D sprite;
            varying vec3 vColor;

            void main() {
                vec4 texel = texture2D(sprite, gl_PointCoord);
                if (texel.a < 0.01) discard;

                gl_FragColor = vec4(vColor * texel.rgb, texel.a);
            }
        `,

        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const stars = new THREE.Points(geometry, starMaterial);
    stars.renderOrder = -1;

    // The bounding sphere is computed from the positions, but points are drawn
    // larger than their vertex, so a star at the edge can be culled while still
    // partly on screen
    stars.frustumCulled = false;

    scene.add(stars);
}

// ==================== THE STAR ====================

/**
 * The sun: an animated plasma shader, a corona, a lensflare, and the key light.
 *
 * The surface is a shader rather than a texture because convection has to move.
 * Limb darkening - the edge of a star being dimmer than its centre, because
 * you are looking through more of its atmosphere at a shallower angle - is the
 * detail that makes a bright sphere read as a star rather than a light bulb.
 */
function createSun() {
    sunMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },

        vertexShader: /* glsl */ `
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec3 vViewDirection;

            void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = position;

                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewDirection = normalize(-mvPosition.xyz);

                gl_Position = projectionMatrix * mvPosition;
            }
        `,

        fragmentShader: /* glsl */ `
            uniform float time;

            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec3 vViewDirection;

            ${GLSL_NOISE}

            void main() {
                vec3 p = normalize(vPosition);

                // Two layers drifting at different speeds and scales. Granules
                // churn fast and small; the underlying convection cells are
                // slower and broader.
                float granules = fbm(p * 7.0 + vec3(0.0, time * 0.09, 0.0));
                float cells = fbm(p * 2.6 - vec3(time * 0.035, 0.0, time * 0.02));

                float heat = granules * 0.55 + cells * 0.65;

                // The colour ramp. All values are HDR - well above 1.0 - which
                // is what the bloom pass keys off. A star that peaks at 1.0
                // would glow no more than a white UI panel.
                vec3 deep  = vec3(1.6, 0.42, 0.05);
                vec3 mid   = vec3(3.4, 1.5,  0.22);
                vec3 hot   = vec3(6.2, 4.4,  1.9);

                vec3 color = mix(deep, mid, smoothstep(0.35, 0.68, heat));
                color = mix(color, hot, smoothstep(0.66, 0.92, heat));

                // Limb darkening: dim the edge, where the view grazes the surface
                float facing = max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0);
                color *= mix(0.45, 1.0, pow(facing, 0.55));

                gl_FragColor = vec4(color, 1.0);
            }
        `,

        fog: false
    });

    sun = new THREE.Mesh(new THREE.SphereGeometry(9, 64, 48), sunMaterial);
    sun.position.copy(SUN_POSITION);
    scene.add(sun);

    // Corona - a camera-facing sprite rather than the two nested glow spheres
    // this used to use. Spheres seen from the side show their own silhouette
    // edge; a sprite always presents the same soft falloff.
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createRadialTexture('rgba(255, 176, 74, 1)', 256),
        color: new THREE.Color(1.4, 0.72, 0.28),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        fog: false
    }));
    corona.scale.set(52, 52, 1);
    corona.position.copy(SUN_POSITION);
    scene.add(corona);

    // ---------- KEY LIGHT ----------
    // One light, where the star is. The old rig also had a DirectionalLight at
    // this exact position, which is the same light counted twice.
    const sunLight = new THREE.PointLight(0xffd9a8, 4.2, 620, 1.4);
    sunLight.position.copy(SUN_POSITION);
    scene.add(sunLight);

    // ---------- LENSFLARE ----------
    // Substantially smaller than before. The old main element was 600px, which
    // at any normal viewport covered most of a quadrant and washed the scene
    // out - visible in the fact that the top-left of the screen had no contrast
    // at all. A flare should suggest a bright source, not replace it.
    const lensflare = new Lensflare();

    lensflare.addElement(new LensflareElement(
        createRadialTexture('rgba(255, 236, 190, 1)', 256), 190, 0
    ));
    lensflare.addElement(new LensflareElement(
        createRadialTexture('rgba(255, 166, 96, 1)', 128), 46, 0.28
    ));
    lensflare.addElement(new LensflareElement(
        createRadialTexture('rgba(120, 190, 255, 1)', 128), 32, 0.5
    ));
    lensflare.addElement(new LensflareElement(
        createRadialTexture('rgba(255, 240, 150, 1)', 64), 22, 0.68
    ));
    lensflare.addElement(new LensflareElement(
        createRadialTexture('rgba(160, 220, 255, 1)', 64), 16, 0.88
    ));

    sunLight.add(lensflare);
}

/**
 * A soft radial gradient, used for the corona and every lensflare element.
 *
 * Keeps the headless guard the original lensflare texture had: bare jsdom has
 * no 2D context, and scene construction has to survive that for tests.
 *
 * @param {string} color - CSS colour for the centre
 * @param {number} size - Texture edge length, ideally a power of two
 * @returns {THREE.Texture}
 */
function createRadialTexture(color, size) {
    const canvas = typeof document !== 'undefined'
        ? document.createElement('canvas')
        : null;
    const ctx = canvas ? canvas.getContext('2d') : null;

    if (!ctx) return new THREE.Texture();

    canvas.width = size;
    canvas.height = size;

    const mid = size / 2;
    const gradient = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);

    const transparent = color.replace(/[\d.]+\)$/, '0)');

    gradient.addColorStop(0, color);
    gradient.addColorStop(0.14, color.replace(/[\d.]+\)$/, '0.72)'));
    gradient.addColorStop(0.38, color.replace(/[\d.]+\)$/, '0.22)'));
    gradient.addColorStop(1, transparent);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// ==================== HOME PLANET ====================

/**
 * The planet being defended: surface, clouds and atmosphere.
 *
 * Three shells rather than one. The surface carries the procedural continent
 * maps; the clouds are a separate sphere so they can rotate at their own rate
 * (weather does not move with the ground, and matching rates makes a planet
 * look painted); the atmosphere is a fresnel shell that only shows where the
 * view grazes the edge.
 */
function createHomePlanet() {
    const radius = CONFIG.path.planetRadius;
    const maps = createPlanetMaps();

    const surface = new THREE.MeshStandardMaterial({
        map: maps.map,
        bumpMap: maps.bumpMap,
        bumpScale: 0.35,
        roughnessMap: maps.roughnessMap,
        roughness: 1,      // Multiplied by the map, so the map has full control
        metalness: 0,

        // City lights. The emissive map is nearly black except over settled
        // land, so this only shows where the surface is unlit - which is
        // exactly the night side.
        emissiveMap: maps.emissiveMap,
        emissive: new THREE.Color(1, 0.72, 0.38),
        emissiveIntensity: 2.1
    });

    maskEmissiveToNightSide(surface);

    homePlanet = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), surface);
    homePlanet.position.set(0, 0, 0);
    scene.add(homePlanet);

    // ---------- CLOUDS ----------
    cloudLayer = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.015, 48, 32),
        new THREE.MeshStandardMaterial({
            map: createCloudTexture(),
            transparent: true,
            roughness: 0.95,
            metalness: 0,
            depthWrite: false
        })
    );
    scene.add(cloudLayer);

    // ---------- ATMOSPHERE ----------
    // Rendered on the inside of a slightly larger sphere. Facing away from the
    // camera means the shell's own front surface never occludes the planet, and
    // the fresnel term concentrates the glow at the limb where a real
    // atmosphere is thickest along the line of sight.
    const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.14, 48, 32),
        new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Color(0.28, 0.62, 1.35) }
            },

            vertexShader: /* glsl */ `
                varying vec3 vNormal;
                varying vec3 vViewDirection;

                void main() {
                    vNormal = normalize(normalMatrix * normal);

                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewDirection = normalize(-mvPosition.xyz);

                    gl_Position = projectionMatrix * mvPosition;
                }
            `,

            fragmentShader: /* glsl */ `
                uniform vec3 glowColor;

                varying vec3 vNormal;
                varying vec3 vViewDirection;

                void main() {
                    // BackSide flips the normal, so negate to get the outward
                    // direction the fresnel term expects
                    float facing = dot(normalize(-vNormal), normalize(vViewDirection));
                    float rim = pow(1.0 - abs(facing), 2.6);

                    gl_FragColor = vec4(glowColor * rim, rim);
                }
            `,

            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            fog: false
        })
    );

    scene.add(atmosphere);
}

/**
 * Show the planet's city lights only on the night side.
 *
 * Emissive is unconditional in every renderer: it means "this surface produces
 * light", so it is added after shading and is completely unaffected by where
 * the sun is. Left alone, that puts glowing cities across the daylit face too,
 * which reads as lava rather than civilisation.
 *
 * The fix is a small shader injection. Three.js builds its materials out of
 * named chunks, and onBeforeCompile hands you the assembled source before it
 * reaches the GPU - so a targeted string replacement can add behaviour to a
 * stock material without forking the whole shader. Here that means carrying the
 * world-space normal through to the fragment stage and using it to fade the
 * emissive term out wherever the surface faces the star.
 *
 * The smoothstep band is deliberately narrow and straddles zero, so the lights
 * come up through the dusk terminator instead of switching on at a hard line.
 *
 * @param {THREE.MeshStandardMaterial} material
 */
function maskEmissiveToNightSide(material) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.sunDirection = { value: SUN_POSITION.clone().normalize() };

        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>
                 varying vec3 vWorldNormal;`
            )
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                 // objectNormal is in scope by this point, set up by
                 // <beginnormal_vertex> further up the chunk list
                 vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>
                 uniform vec3 sunDirection;
                 varying vec3 vWorldNormal;`
            )
            .replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
                 float dayness = dot(normalize(vWorldNormal), sunDirection);
                 totalEmissiveRadiance *= 1.0 - smoothstep(-0.2, 0.1, dayness);`
            );
    };
}

// ==================== PLANET SHIELD ====================

/**
 * The defensive shield bubble around the home planet.
 *
 * This is the visible form of the integrity system. Previously a single leaked
 * enemy ended the run with nothing on screen to explain why; now each breach
 * flares the shield at the point of impact and leaves it visibly weaker, so the
 * player can see how much protection is left without reading the HUD.
 *
 * The shader is a fresnel rim plus a hex pattern that only appears where the
 * shield is being struck - a solid bubble would hide the planet, and an
 * always-visible grid would compete with the atmosphere for the same silhouette.
 */
function createPlanetShield() {
    shieldMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },

            // 1 at full integrity, falling toward 0. Drives both brightness and
            // how unstable the surface looks.
            strength: { value: 1 },

            // Spikes to 1 on a hit and decays, driving the impact flare
            impact: { value: 0 },

            // Where the last breach happened, in local space, so the flare is
            // brightest at the point of contact
            impactPoint: { value: new THREE.Vector3(0, 1, 0) },

            shieldColor: { value: new THREE.Color(0.25, 0.72, 1.4) }
        },

        vertexShader: /* glsl */ `
            varying vec3 vNormal;
            varying vec3 vLocal;
            varying vec3 vViewDirection;

            void main() {
                vNormal = normalize(normalMatrix * normal);
                vLocal = normalize(position);

                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewDirection = normalize(-mvPosition.xyz);

                gl_Position = projectionMatrix * mvPosition;
            }
        `,

        fragmentShader: /* glsl */ `
            uniform float time;
            uniform float strength;
            uniform float impact;
            uniform vec3  impactPoint;
            uniform vec3  shieldColor;

            varying vec3 vNormal;
            varying vec3 vLocal;
            varying vec3 vViewDirection;

            ${GLSL_NOISE}

            void main() {
                // Rim term: the shield is only really visible where the surface
                // turns away from the viewer, which is how a thin shell reads
                float facing = abs(dot(normalize(vNormal), normalize(vViewDirection)));
                float rim = pow(1.0 - facing, 3.0);

                // Slow churn, so the shell looks energised rather than painted
                float churn = fbm(vLocal * 5.0 + vec3(0.0, time * 0.25, 0.0));

                // Impact flare, concentrated around the breach point
                float proximity = max(dot(vLocal, normalize(impactPoint)), 0.0);
                float flare = impact * pow(proximity, 6.0);

                // A weakened shield flickers. As strength falls the churn is
                // allowed to punch through, so instability is visible before
                // the shield fails rather than only afterwards.
                float instability = (1.0 - strength) * churn * 0.5;

                float alpha = rim * (0.16 + strength * 0.2)
                            + flare * 0.85
                            + instability * rim;

                vec3 color = shieldColor * (0.5 + strength * 0.5)
                           + vec3(1.4, 0.9, 0.6) * flare;

                if (alpha < 0.005) discard;

                gl_FragColor = vec4(color * alpha, alpha);
            }
        `,

        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        fog: false
    });

    planetShield = new THREE.Mesh(
        new THREE.SphereGeometry(CONFIG.planet.shieldRadius, 48, 32),
        shieldMaterial
    );

    scene.add(planetShield);
}

/**
 * Flare the shield where something got through, and weaken it.
 *
 * @param {THREE.Vector3} position - World position of the breach
 * @param {number} remainingFraction - Integrity left, 0-1
 */
export function hitPlanetShield(position, remainingFraction) {
    if (!shieldMaterial) return;

    shieldMaterial.uniforms.impact.value = 1;
    shieldMaterial.uniforms.strength.value = Math.max(0, remainingFraction);

    // The planet sits at the origin, so a world position is already the
    // direction from its centre
    if (position) {
        shieldMaterial.uniforms.impactPoint.value.copy(position).normalize();
    }
}

/**
 * Restore the shield to full. Called when a run restarts.
 */
export function resetPlanetShield() {
    if (!shieldMaterial) return;

    shieldMaterial.uniforms.strength.value = 1;
    shieldMaterial.uniforms.impact.value = 0;
}

// ==================== BACKGROUND PLANETS ====================

/**
 * Decorative worlds, sharing one set of rock maps between them.
 *
 * One gets a ring system. A ringed planet is the single most legible "this is
 * space" silhouette there is, and it costs one extra RingGeometry.
 */
function createBackgroundPlanets() {
    const rock = createRockMaps(256);

    const worlds = [
        {
            color: 0xc9703c, size: 3.4, roughness: 0.9, metalness: 0.05,
            position: new THREE.Vector3(46, 12, -34), ring: false
        },
        {
            color: 0x6fa88b, size: 2.2, roughness: 0.75, metalness: 0.1,
            position: new THREE.Vector3(-34, -7, 54), ring: false
        },
        {
            color: 0xb8a06a, size: 4.6, roughness: 0.62, metalness: 0.05,
            position: new THREE.Vector3(56, -17, 44), ring: true
        }
    ];

    worlds.forEach((world) => {
        const planet = new THREE.Mesh(
            new THREE.SphereGeometry(world.size, 32, 24),
            new THREE.MeshStandardMaterial({
                color: world.color,
                map: rock.map,
                bumpMap: rock.bumpMap,
                bumpScale: 0.12,
                roughness: world.roughness,
                metalness: world.metalness
            })
        );

        planet.position.copy(world.position);
        planet.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        scene.add(planet);

        if (!world.ring) return;

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(world.size * 1.45, world.size * 2.3, 64),
            new THREE.MeshStandardMaterial({
                color: 0xd8c79c,
                roughness: 0.9,
                metalness: 0,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.62
            })
        );

        ring.rotation.x = Math.PI / 2.6;
        ring.rotation.z = 0.35;
        ring.position.copy(world.position);
        scene.add(ring);
    });
}

// ==================== ASTEROID BELT ====================

/**
 * The asteroid belt, as a single InstancedMesh.
 *
 * This used to be one Mesh per asteroid - 200 separate objects, each costing
 * its own draw call. They shared a geometry and a material, which saves memory
 * but not draw calls: the GPU still had to be told about each one individually.
 * An InstancedMesh sends the geometry once and the per-object transforms as a
 * buffer, turning 200+ draw calls into one.
 *
 * That is what makes the belt affordable enough to also give it more members
 * on the high tier than the old scene had in total.
 */
function createAsteroidField() {
    const count = getTierSettings().asteroidCount;
    const rock = createRockMaps(256);

    // Detail level 1 rather than 0: still cheap, but enough facets that a
    // rotating asteroid reads as an irregular body instead of a spinning die
    const geometry = new THREE.IcosahedronGeometry(0.5, 1);

    const material = new THREE.MeshStandardMaterial({
        map: rock.map,
        bumpMap: rock.bumpMap,
        bumpScale: 0.3,
        roughnessMap: rock.roughnessMap,
        roughness: 1,
        metalness: 0.08,
        flatShading: true
    });

    asteroidField = new THREE.InstancedMesh(geometry, material, count);
    asteroidField.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    asteroidDrift = [];

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 86 + Math.random() * 78;

        // Cube the vertical spread so most of the belt sits near the orbital
        // plane with a few strays above and below, rather than filling a slab
        const height = Math.pow(Math.random() * 2 - 1, 3) * 26;

        position.set(
            Math.cos(angle) * distance,
            height,
            Math.sin(angle) * distance
        );

        euler.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        quaternion.setFromEuler(euler);

        const size = 0.35 + Math.pow(Math.random(), 2.4) * 2.6;
        scale.set(size, size * (0.7 + Math.random() * 0.6), size);

        matrix.compose(position, quaternion, scale);
        asteroidField.setMatrixAt(i, matrix);

        asteroidDrift.push({
            position: position.clone(),
            quaternion: quaternion.clone(),
            scale: scale.clone(),
            spin: new THREE.Vector3(
                (Math.random() - 0.5) * 0.22,
                (Math.random() - 0.5) * 0.22,
                (Math.random() - 0.5) * 0.22
            ),
            orbit: (Math.random() - 0.5) * 0.012
        });
    }

    asteroidField.instanceMatrix.needsUpdate = true;
    scene.add(asteroidField);
}

// ==================== DEFENCE GRID ====================

/**
 * The orbital rings, re-read as a defence perimeter.
 *
 * These used to be plain translucent bands. They now carry a moving tick
 * pattern, which does two jobs: it makes them read as instrumentation rather
 * than decoration, and a moving reference on the orbital plane gives the eye
 * a sense of scale and direction that a static ring does not.
 *
 * The ticks are computed from the fragment's angle around the ring rather than
 * from UVs, because RingGeometry lays its UVs out planar - deriving the angle
 * with atan on the local position is both simpler and resolution-independent.
 */
function createOrbitalRings() {
    const rings = [
        { radius: 15, ticks: 48, speed: 0.05, opacity: 0.45 },
        { radius: 25, ticks: 72, speed: -0.035, opacity: 0.34 },
        { radius: 40, ticks: 96, speed: 0.022, opacity: 0.24 }
    ];

    ringMaterials = [];

    rings.forEach((config) => {
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                ringColor: { value: new THREE.Color(0.24, 0.78, 1.25) },
                ticks: { value: config.ticks },
                speed: { value: config.speed },
                baseOpacity: { value: config.opacity }
            },

            vertexShader: /* glsl */ `
                varying vec2 vLocal;

                void main() {
                    vLocal = position.xy;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,

            fragmentShader: /* glsl */ `
                uniform float time;
                uniform vec3  ringColor;
                uniform float ticks;
                uniform float speed;
                uniform float baseOpacity;

                varying vec2 vLocal;

                const float TAU = 6.28318530718;

                void main() {
                    float angle = atan(vLocal.y, vLocal.x);

                    // Sawtooth around the circumference, scrolled by time
                    float sweep = fract(angle / TAU * ticks + time * speed * ticks);

                    // Short bright tick, long dim gap
                    float tick = smoothstep(0.0, 0.08, sweep) * (1.0 - smoothstep(0.16, 0.3, sweep));

                    float intensity = baseOpacity * (0.35 + tick * 1.9);

                    gl_FragColor = vec4(ringColor * intensity, intensity);
                }
            `,

            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false
        });

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(config.radius - 0.09, config.radius + 0.09, 180),
            material
        );

        ring.rotation.x = Math.PI / 2;
        scene.add(ring);

        ringMaterials.push(material);
    });
}

// ==================== LIGHTING ====================

/**
 * The lighting rig - what little of it is left.
 *
 * The environment map created in environment.js does the ambient work, and
 * does it with direction, which is why there is no AmbientLight here. What
 * remains is the key (added alongside the sun geometry) and one hemisphere
 * light acting as a rim from the galactic plane.
 */
function setupLighting() {
    // Cool from above, warmer bounce from below where the planet sits. At this
    // intensity it is doing separation work, not illumination - it keeps the
    // top and bottom of an object from being the same value.
    const hemisphere = new THREE.HemisphereLight(0x5c86c8, 0x1a2138, 0.55);
    scene.add(hemisphere);
}

// ==================== PER-FRAME ====================

/**
 * Animate the scene.
 *
 * @param {number} deltaTime - Seconds since the last frame
 */
export function updateScene(deltaTime) {
    elapsed += deltaTime;

    // The planet turns, and its weather turns slightly faster. Matching the two
    // rates is what makes a cloud layer look like a decal instead of an
    // atmosphere.
    if (homePlanet) homePlanet.rotation.y += deltaTime * 0.035;
    if (cloudLayer) cloudLayer.rotation.y += deltaTime * 0.052;

    if (sunMaterial) sunMaterial.uniforms.time.value = elapsed;
    if (starMaterial) starMaterial.uniforms.time.value = elapsed;

    ringMaterials.forEach((material) => {
        material.uniforms.time.value = elapsed;
    });

    if (shieldMaterial) {
        shieldMaterial.uniforms.time.value = elapsed;

        // Exponential decay rather than a linear countdown: the flare should
        // be bright immediately and fade off, which is how a real discharge
        // looks. Raising the decay to the power of deltaTime keeps the fade
        // the same duration regardless of frame rate.
        shieldMaterial.uniforms.impact.value *= Math.pow(0.02, deltaTime);
    }

    updateAsteroids(deltaTime);
}

/**
 * Tumble and slowly orbit the belt.
 *
 * Recomposing every instance matrix each frame is affordable because it is
 * pure CPU maths against a buffer - no draw calls are involved. A static belt
 * is one of those things nobody consciously notices until it moves.
 *
 * @param {number} deltaTime
 */
function updateAsteroids(deltaTime) {
    if (!asteroidField || deltaTime === 0) return;

    const matrix = new THREE.Matrix4();
    const spin = new THREE.Quaternion();
    const euler = new THREE.Euler();

    for (let i = 0; i < asteroidDrift.length; i++) {
        const rock = asteroidDrift[i];

        euler.set(
            rock.spin.x * deltaTime,
            rock.spin.y * deltaTime,
            rock.spin.z * deltaTime
        );
        spin.setFromEuler(euler);
        rock.quaternion.multiply(spin);

        // Orbit about the scene centre. Each rock carries its own rate, so the
        // belt shears over time rather than rotating as a rigid disc.
        const angle = rock.orbit * deltaTime;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = rock.position.x;
        const z = rock.position.z;

        rock.position.x = x * cos - z * sin;
        rock.position.z = x * sin + z * cos;

        matrix.compose(rock.position, rock.quaternion, rock.scale);
        asteroidField.setMatrixAt(i, matrix);
    }

    asteroidField.instanceMatrix.needsUpdate = true;
}

/**
 * @returns {THREE.Vector3} A copy of the star's position
 */
export function getSunPosition() {
    return SUN_POSITION.clone();
}
