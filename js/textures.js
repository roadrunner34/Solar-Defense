/**
 * textures.js - Procedurally generated textures
 *
 * The project ships no asset files, and this module is how it gets away with
 * that: every surface in the game is drawn onto an HTMLCanvasElement at load
 * time and handed to Three.js as a CanvasTexture. Nothing is downloaded,
 * nothing is committed, and the whole thing still works offline.
 *
 * WHY TEXTURES MATTER MORE THAN THEY LOOK LIKE THEY SHOULD
 * =======================================================
 * The game previously used flat colours on every object. A flat colour tells
 * the renderer nothing about a surface except its hue, so a planet, a hull
 * plate and a rock all shade identically - smooth, even, and plastic. What
 * reads as "detail" to the eye is mostly variation in *roughness*: which parts
 * of a surface scatter light and which reflect it. That is why every factory
 * here returns a roughness map alongside the colour map, and why the roughness
 * is usually the half doing the work.
 *
 * HEADLESS SAFETY
 * ===============
 * Vitest runs these modules under bare jsdom, which has no 2D canvas context.
 * Every factory funnels through createCanvas(), which returns null there, and
 * every factory returns a blank THREE.Texture() when it gets null. Scene
 * construction then succeeds in tests without anyone needing to mock canvas.
 * This mirrors the guard already used by the lensflare texture.
 */

import * as THREE from 'three';

// ==================== NOISE ====================
//
// A compact 3D value noise. Three dimensions rather than two because these
// textures wrap around spheres: sampling noise at the 3D direction of each
// pixel avoids both the vertical seam where longitude wraps and the pinching
// at the poles that a flat 2D noise field produces.

/**
 * Integer hash. Math.imul is used rather than plain `*` because JavaScript
 * numbers lose the low bits of a 32-bit multiply once the result exceeds 2^53,
 * which would make the hash correlate badly and show up as visible banding.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number} Pseudo-random value in 0..1
 */
function hash3(x, y, z) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * Smootherstep - Perlin's improved interpolant, 6t^5 - 15t^4 + 10t^3.
 * Its first *and* second derivatives are zero at the endpoints, so adjacent
 * noise cells meet without the faint grid creases that plain smoothstep leaves
 * behind when the result is used as a bump map.
 *
 * @param {number} t - 0..1
 * @returns {number}
 */
function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * 3D value noise.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number} Value in 0..1
 */
function noise3(x, y, z) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);

    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const zf = fade(z - zi);

    const lerp = (a, b, t) => a + (b - a) * t;

    const c000 = hash3(xi, yi, zi);
    const c100 = hash3(xi + 1, yi, zi);
    const c010 = hash3(xi, yi + 1, zi);
    const c110 = hash3(xi + 1, yi + 1, zi);
    const c001 = hash3(xi, yi, zi + 1);
    const c101 = hash3(xi + 1, yi, zi + 1);
    const c011 = hash3(xi, yi + 1, zi + 1);
    const c111 = hash3(xi + 1, yi + 1, zi + 1);

    const x00 = lerp(c000, c100, xf);
    const x10 = lerp(c010, c110, xf);
    const x01 = lerp(c001, c101, xf);
    const x11 = lerp(c011, c111, xf);

    return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
}

/**
 * Fractional Brownian motion: stacked octaves of noise, each one twice the
 * frequency and half the amplitude of the last. This is what turns a smooth
 * blobby field into something with both large landmasses and fine coastline.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} octaves
 * @param {number} [gain] - Amplitude falloff per octave
 * @returns {number} Value in roughly 0..1
 */
function fbm(x, y, z, octaves, gain = 0.5) {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let normalisation = 0;

    for (let i = 0; i < octaves; i++) {
        total += noise3(x * frequency, y * frequency, z * frequency) * amplitude;
        normalisation += amplitude;
        amplitude *= gain;
        frequency *= 2;
    }

    return total / normalisation;
}

/**
 * Ridged noise - fold the field at 0.5 and invert. Produces sharp crests
 * instead of rounded hills, which is what makes mountain ranges and the
 * filaments in a nebula read as structure rather than lumps.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} octaves
 * @returns {number} Value in 0..1
 */
function ridged(x, y, z, octaves) {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let normalisation = 0;

    for (let i = 0; i < octaves; i++) {
        const n = 1 - Math.abs(noise3(x * frequency, y * frequency, z * frequency) * 2 - 1);
        total += n * n * amplitude;
        normalisation += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return total / normalisation;
}

// ==================== CANVAS HELPERS ====================

/**
 * Create a drawing surface, or null when there is no DOM (tests).
 * @param {number} width
 * @param {number} height
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}|null}
 */
function createCanvas(width, height) {
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    return { canvas, ctx };
}

/**
 * Wrap a canvas as a texture with sane defaults for a sphere.
 * @param {HTMLCanvasElement} canvas
 * @param {boolean} [srgb] - True for colour data, false for data maps
 * @returns {THREE.CanvasTexture}
 */
function toTexture(canvas, srgb = true) {
    const texture = new THREE.CanvasTexture(canvas);

    // Colour maps carry perceptual values and must be decoded to linear before
    // lighting maths touches them. Roughness, bump and metalness maps carry raw
    // numbers and must not be - decoding them would silently change the value.
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 4;

    return texture;
}

/**
 * Convert an equirectangular pixel to a direction on the unit sphere.
 * @param {number} u - 0..1 across the texture
 * @param {number} v - 0..1 down the texture
 * @returns {{x: number, y: number, z: number}}
 */
function uvToDirection(u, v) {
    const theta = u * Math.PI * 2;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);

    return {
        x: sinPhi * Math.cos(theta),
        y: Math.cos(phi),
        z: sinPhi * Math.sin(theta)
    };
}

// ==================== PLANET ====================

/**
 * Build the home planet's full material set in a single pass.
 *
 * Colour, elevation, roughness and night lights all derive from the same two
 * noise fields, so they are generated together rather than in four separate
 * loops. That is not just a speed trick - it is what keeps them consistent.
 * Coastlines land in the same place on every map because every map is reading
 * the same height value, so the shoreline is smooth where the ocean is smooth
 * and the cities stop exactly where the water starts.
 *
 * @param {number} [width]
 * @param {number} [height]
 * @returns {{map: THREE.Texture, bumpMap: THREE.Texture,
 *            roughnessMap: THREE.Texture, emissiveMap: THREE.Texture}}
 */
export function createPlanetMaps(width = 1024, height = 512) {
    const albedo = createCanvas(width, height);
    const bump = createCanvas(width, height);
    const rough = createCanvas(width, height);
    const lights = createCanvas(width, height);

    if (!albedo || !bump || !rough || !lights) {
        return {
            map: new THREE.Texture(),
            bumpMap: new THREE.Texture(),
            roughnessMap: new THREE.Texture(),
            emissiveMap: new THREE.Texture()
        };
    }

    const albedoData = albedo.ctx.createImageData(width, height);
    const bumpData = bump.ctx.createImageData(width, height);
    const roughData = rough.ctx.createImageData(width, height);
    const lightData = lights.ctx.createImageData(width, height);

    const SEA_LEVEL = 0.5;

    // Colour ramp, ocean floor to mountain peak
    const DEEP_OCEAN = [6, 26, 58];
    const SHALLOW_OCEAN = [16, 76, 124];
    const BEACH = [176, 162, 120];
    const LOWLAND = [46, 92, 52];
    const FOREST = [30, 68, 42];
    const HIGHLAND = [92, 84, 66];
    const PEAK = [124, 122, 116];
    const ICE = [222, 233, 242];

    const mix = (a, b, t) => [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];

    for (let y = 0; y < height; y++) {
        const v = (y + 0.5) / height;

        for (let x = 0; x < width; x++) {
            const u = (x + 0.5) / width;
            const dir = uvToDirection(u, v);

            // Continents: low frequency, many octaves for a detailed coastline
            let elevation = fbm(dir.x * 2.1, dir.y * 2.1, dir.z * 2.1, 6);

            // Mountain ranges only where land already exists, so ridges follow
            // continent interiors instead of rising straight out of the sea
            if (elevation > SEA_LEVEL) {
                const range = ridged(dir.x * 4.3 + 11, dir.y * 4.3 + 11, dir.z * 4.3 + 11, 4);
                elevation += range * (elevation - SEA_LEVEL) * 0.55;
            }

            // Moisture decides forest vs scrub, offset so it does not correlate
            // with elevation and produce banded-looking biomes
            const moisture = fbm(dir.x * 3.4 + 57, dir.y * 3.4 + 57, dir.z * 3.4 + 57, 4);

            // Ice caps: latitude-driven, with a noisy edge so the boundary is
            // ragged rather than a drawn-on circle
            const latitude = Math.abs(dir.y);
            const iceNoise = fbm(dir.x * 6 + 91, dir.y * 6 + 91, dir.z * 6 + 91, 3);
            const iceAmount = Math.max(0, Math.min(1,
                (latitude - 0.72 + (iceNoise - 0.5) * 0.22) * 7
            ));

            let colour;
            let surfaceRoughness;
            let surfaceHeight;
            let cityGlow = 0;

            if (elevation < SEA_LEVEL) {
                // Water. Depth drives colour; roughness stays low throughout,
                // which is what gives the oceans their specular sheen.
                const depth = elevation / SEA_LEVEL;
                colour = mix(DEEP_OCEAN, SHALLOW_OCEAN, depth * depth);
                surfaceRoughness = 0.08 + depth * 0.1;
                surfaceHeight = 0.35;
            } else {
                const land = (elevation - SEA_LEVEL) / (1 - SEA_LEVEL);

                if (land < 0.04) {
                    colour = mix(BEACH, LOWLAND, land / 0.04);
                } else if (land < 0.45) {
                    const t = (land - 0.04) / 0.41;
                    colour = mix(mix(LOWLAND, FOREST, moisture), HIGHLAND, t * t);
                } else {
                    colour = mix(HIGHLAND, PEAK, (land - 0.45) / 0.55);
                }

                surfaceRoughness = 0.82 - moisture * 0.12;
                surfaceHeight = 0.35 + land * 0.65;

                // Settlements: a separate high-frequency field, hard-thresholded
                // so lights form scattered clusters rather than an even wash.
                // Kept off mountains and away from the ice, because nobody
                // builds a city on a glacier.
                if (land < 0.4 && iceAmount < 0.2) {
                    const density = fbm(dir.x * 22 + 7, dir.y * 22 + 7, dir.z * 22 + 7, 3);
                    if (density > 0.66) {
                        cityGlow = Math.min(1, (density - 0.66) / 0.2);
                    }
                }
            }

            if (iceAmount > 0) {
                colour = mix(colour, ICE, iceAmount);
                surfaceRoughness = surfaceRoughness + (0.45 - surfaceRoughness) * iceAmount;
                cityGlow *= 1 - iceAmount;
            }

            const i = (y * width + x) * 4;

            albedoData.data[i] = colour[0];
            albedoData.data[i + 1] = colour[1];
            albedoData.data[i + 2] = colour[2];
            albedoData.data[i + 3] = 255;

            const h = surfaceHeight * 255;
            bumpData.data[i] = h;
            bumpData.data[i + 1] = h;
            bumpData.data[i + 2] = h;
            bumpData.data[i + 3] = 255;

            const r = surfaceRoughness * 255;
            roughData.data[i] = r;
            roughData.data[i + 1] = r;
            roughData.data[i + 2] = r;
            roughData.data[i + 3] = 255;

            // Sodium-lamp orange, the colour cities actually glow from orbit
            lightData.data[i] = cityGlow * 255;
            lightData.data[i + 1] = cityGlow * 170;
            lightData.data[i + 2] = cityGlow * 90;
            lightData.data[i + 3] = 255;
        }
    }

    albedo.ctx.putImageData(albedoData, 0, 0);
    bump.ctx.putImageData(bumpData, 0, 0);
    rough.ctx.putImageData(roughData, 0, 0);
    lights.ctx.putImageData(lightData, 0, 0);

    return {
        map: toTexture(albedo.canvas, true),
        bumpMap: toTexture(bump.canvas, false),
        roughnessMap: toTexture(rough.canvas, false),
        emissiveMap: toTexture(lights.canvas, true)
    };
}

/**
 * Cloud layer for the home planet - white, with transparency carrying the shape.
 *
 * Cloud bands are stretched horizontally (the x and z inputs are scaled up
 * relative to y) because planetary rotation shears weather into latitudinal
 * bands. Sampling an unstretched field gives you evenly scattered blobs that
 * read as static, not as weather.
 *
 * @param {number} [width]
 * @param {number} [height]
 * @returns {THREE.Texture}
 */
export function createCloudTexture(width = 1024, height = 512) {
    const surface = createCanvas(width, height);
    if (!surface) return new THREE.Texture();

    const data = surface.ctx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
        const v = (y + 0.5) / height;

        for (let x = 0; x < width; x++) {
            const u = (x + 0.5) / width;
            const dir = uvToDirection(u, v);

            const density = fbm(dir.x * 4.5, dir.y * 9, dir.z * 4.5, 5, 0.55);
            const wisps = fbm(dir.x * 13 + 31, dir.y * 20 + 31, dir.z * 13 + 31, 3);

            // Thin the clouds toward the poles so the layer does not form a
            // solid white cap where the equirectangular projection crowds
            // texels together
            const polarFade = 1 - Math.pow(Math.abs(dir.y), 4);

            let alpha = (density * 0.75 + wisps * 0.25 - 0.5) * 2.8 * polarFade;
            alpha = Math.max(0, Math.min(1, alpha));

            const i = (y * width + x) * 4;
            data.data[i] = 255;
            data.data[i + 1] = 255;
            data.data[i + 2] = 255;
            data.data[i + 3] = alpha * 235;
        }
    }

    surface.ctx.putImageData(data, 0, 0);
    return toTexture(surface.canvas, true);
}

// ==================== ROCK ====================

/**
 * Asteroid surface: grey, pitted, uniformly rough.
 *
 * Tiles in both directions, so it is sampled with plain 2D noise wrapped by
 * modulo rather than the spherical projection used for planets - asteroids are
 * lumpy icosahedra whose UVs nobody will inspect closely.
 *
 * @param {number} [size]
 * @returns {{map: THREE.Texture, bumpMap: THREE.Texture, roughnessMap: THREE.Texture}}
 */
export function createRockMaps(size = 256) {
    const albedo = createCanvas(size, size);
    const bump = createCanvas(size, size);
    const rough = createCanvas(size, size);

    if (!albedo || !bump || !rough) {
        return {
            map: new THREE.Texture(),
            bumpMap: new THREE.Texture(),
            roughnessMap: new THREE.Texture()
        };
    }

    const albedoData = albedo.ctx.createImageData(size, size);
    const bumpData = bump.ctx.createImageData(size, size);
    const roughData = rough.ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = x / size;
            const v = y / size;

            // Sampling a torus in 3D makes the result tile seamlessly in both
            // directions without any mirroring artefacts
            const a = u * Math.PI * 2;
            const b = v * Math.PI * 2;
            const nx = Math.cos(a) * 1.6;
            const ny = Math.sin(a) * 1.6;
            const nz = Math.cos(b) * 1.6;

            const grain = fbm(nx * 3, ny * 3, nz * 3, 5);
            const craters = ridged(nx * 6 + 13, ny * 6 + 13, nz * 6 + 13, 3);

            const shade = 74 + grain * 66 - craters * 26;

            const i = (y * size + x) * 4;

            albedoData.data[i] = shade;
            albedoData.data[i + 1] = shade * 0.97;
            albedoData.data[i + 2] = shade * 0.92;
            albedoData.data[i + 3] = 255;

            const h = (grain * 0.7 + (1 - craters) * 0.3) * 255;
            bumpData.data[i] = h;
            bumpData.data[i + 1] = h;
            bumpData.data[i + 2] = h;
            bumpData.data[i + 3] = 255;

            // Rock is rough everywhere; the variation is what stops it looking
            // like a single moulded surface
            const r = (0.78 + grain * 0.2) * 255;
            roughData.data[i] = r;
            roughData.data[i + 1] = r;
            roughData.data[i + 2] = r;
            roughData.data[i + 3] = 255;
        }
    }

    albedo.ctx.putImageData(albedoData, 0, 0);
    bump.ctx.putImageData(bumpData, 0, 0);
    rough.ctx.putImageData(roughData, 0, 0);

    return {
        map: toTexture(albedo.canvas, true),
        bumpMap: toTexture(bump.canvas, false),
        roughnessMap: toTexture(rough.canvas, false)
    };
}

// ==================== HULL ====================

/**
 * Spacecraft hull plating for the starbase and platforms.
 *
 * Drawn with canvas primitives rather than noise, because what makes a surface
 * read as *manufactured* is straight lines at irregular intervals. Noise gives
 * you nature; rectangles give you engineering. The panel seams end up in the
 * roughness map as much as the colour map - a recessed seam catches grime and
 * scatters light, which is the cue the eye actually reads.
 *
 * A NOTE ON BRIGHTNESS
 * ====================
 * The colour map is deliberately near-white. In Three.js a material's `color`
 * is MULTIPLIED by its `map`, so a mid-grey map would darken every tint a
 * caller passes - a hull asking for 0x6a6a6a against a 0x8d95a3 map lands at
 * roughly 0x3b3f44, which is why the first pass at this came out nearly black.
 * Keeping the map bright leaves `color` in charge of the tone and lets the
 * texture do what it is actually for: variation.
 *
 * @param {number} [size]
 * @param {string} [tint] - Base plate colour, kept light on purpose
 * @returns {{map: THREE.Texture, roughnessMap: THREE.Texture, metalnessMap: THREE.Texture}}
 */
export function createHullMaps(size = 512, tint = '#d9dde5') {
    const albedo = createCanvas(size, size);
    const rough = createCanvas(size, size);
    const metal = createCanvas(size, size);

    if (!albedo || !rough || !metal) {
        return {
            map: new THREE.Texture(),
            roughnessMap: new THREE.Texture(),
            metalnessMap: new THREE.Texture()
        };
    }

    // Deterministic pseudo-random, so a reload produces the same hull rather
    // than reshuffling every panel on the ship
    let seed = 20260913;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    albedo.ctx.fillStyle = tint;
    albedo.ctx.fillRect(0, 0, size, size);

    rough.ctx.fillStyle = '#6b6b6b';
    rough.ctx.fillRect(0, 0, size, size);

    metal.ctx.fillStyle = '#d8d8d8';
    metal.ctx.fillRect(0, 0, size, size);

    // Plates of varying size, each very slightly off the base tone. Real
    // panelling is never uniform - batches differ, and sunlight ages them
    // unevenly.
    const plate = size / 8;
    for (let y = 0; y < size; y += plate) {
        for (let x = 0; x < size; x += plate) {
            const w = plate * (random() < 0.25 ? 2 : 1);
            const h = plate * (random() < 0.25 ? 2 : 1);
            const shift = (random() - 0.5) * 26;

            albedo.ctx.fillStyle = `rgba(${217 + shift}, ${221 + shift}, ${229 + shift}, 1)`;
            albedo.ctx.fillRect(x, y, w, h);

            const plateRough = 100 + random() * 70;
            rough.ctx.fillStyle = `rgb(${plateRough}, ${plateRough}, ${plateRough})`;
            rough.ctx.fillRect(x, y, w, h);
        }
    }

    // Seams. Dark in colour, rough in the roughness map, and non-metal in the
    // metalness map, because a gap between plates is shadow and grime, not steel.
    albedo.ctx.strokeStyle = 'rgba(28, 32, 40, 0.85)';
    albedo.ctx.lineWidth = Math.max(1, size / 256);
    rough.ctx.strokeStyle = 'rgb(215, 215, 215)';
    rough.ctx.lineWidth = albedo.ctx.lineWidth;
    metal.ctx.strokeStyle = 'rgb(40, 40, 40)';
    metal.ctx.lineWidth = albedo.ctx.lineWidth;

    for (let i = 0; i <= size; i += plate) {
        for (const ctx of [albedo.ctx, rough.ctx, metal.ctx]) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, size);
            ctx.moveTo(0, i);
            ctx.lineTo(size, i);
            ctx.stroke();
        }
    }

    // Rivets and vents: small marks that give the eye a sense of scale. Without
    // something of known size on it, a hull could be two metres or two hundred.
    for (let i = 0; i < 220; i++) {
        const x = random() * size;
        const y = random() * size;
        const r = 1 + random() * 2;

        albedo.ctx.fillStyle = 'rgba(60, 66, 78, 0.55)';
        albedo.ctx.beginPath();
        albedo.ctx.arc(x, y, r, 0, Math.PI * 2);
        albedo.ctx.fill();

        rough.ctx.fillStyle = 'rgb(190, 190, 190)';
        rough.ctx.beginPath();
        rough.ctx.arc(x, y, r, 0, Math.PI * 2);
        rough.ctx.fill();
    }

    // Scorch and wear streaks, always running the same way, as though something
    // has been venting along the hull for years
    for (let i = 0; i < 26; i++) {
        const x = random() * size;
        const y = random() * size;
        const length = 20 + random() * 90;

        const streak = albedo.ctx.createLinearGradient(x, y, x + length * 0.25, y + length);
        streak.addColorStop(0, 'rgba(20, 22, 28, 0.4)');
        streak.addColorStop(1, 'rgba(20, 22, 28, 0)');

        albedo.ctx.fillStyle = streak;
        albedo.ctx.fillRect(x, y, 3 + random() * 7, length);
    }

    const map = toTexture(albedo.canvas, true);
    const roughnessMap = toTexture(rough.canvas, false);
    const metalnessMap = toTexture(metal.canvas, false);

    for (const texture of [map, roughnessMap, metalnessMap]) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
    }

    return { map, roughnessMap, metalnessMap };
}

// ==================== STARS AND NEBULA ====================

/**
 * A single star: a soft core with a faint four-point flare.
 *
 * Real stars are point sources; what you see is your eye and the camera lens
 * spreading them. Drawing that spread explicitly is what separates a starfield
 * from a scattering of single lit pixels, which is how the old PointsMaterial
 * with no sprite read.
 *
 * @param {number} [size]
 * @returns {THREE.Texture}
 */
export function createStarSprite(size = 64) {
    const surface = createCanvas(size, size);
    if (!surface) return new THREE.Texture();

    const ctx = surface.ctx;
    const mid = size / 2;

    ctx.clearRect(0, 0, size, size);

    const glow = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glow.addColorStop(0.12, 'rgba(255, 255, 255, 0.92)');
    glow.addColorStop(0.32, 'rgba(255, 255, 255, 0.28)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    // The diffraction spikes
    const spike = ctx.createLinearGradient(0, mid, size, mid);
    spike.addColorStop(0, 'rgba(255, 255, 255, 0)');
    spike.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    spike.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = spike;
    ctx.fillRect(0, mid - size / 64, size, size / 32);

    ctx.save();
    ctx.translate(mid, mid);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-mid, -mid);
    ctx.fillRect(0, mid - size / 64, size, size / 32);
    ctx.restore();

    const texture = new THREE.CanvasTexture(surface.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

/**
 * Nebula backdrop, wrapped onto a large inward-facing sphere.
 *
 * Uses ridged noise rather than plain fbm because gas clouds have filaments -
 * sharp bright threads running through soft volume. Plain fbm gives you fog.
 *
 * The output is deliberately dim. It sits behind everything else in the game
 * and its job is to stop the background reading as flat black, not to be
 * looked at.
 *
 * @param {number} [width]
 * @param {number} [height]
 * @returns {THREE.Texture}
 */
export function createNebulaTexture(width = 1024, height = 512) {
    const surface = createCanvas(width, height);
    if (!surface) return new THREE.Texture();

    const data = surface.ctx.createImageData(width, height);

    // Two clouds of different hue, so the sky has a warm side and a cool side
    // rather than one uniform colour cast
    const COOL = [38, 72, 150];
    const WARM = [128, 54, 96];

    for (let y = 0; y < height; y++) {
        const v = (y + 0.5) / height;

        for (let x = 0; x < width; x++) {
            const u = (x + 0.5) / width;
            const dir = uvToDirection(u, v);

            const volume = fbm(dir.x * 1.7, dir.y * 1.7, dir.z * 1.7, 5, 0.58);
            const filament = ridged(dir.x * 3.6 + 17, dir.y * 3.6 + 17, dir.z * 3.6 + 17, 4);
            const hueMix = fbm(dir.x * 1.1 + 63, dir.y * 1.1 + 63, dir.z * 1.1 + 63, 3);

            // Threshold hard: most of the sky should be empty, with the gas
            // concentrated into a few regions
            let density = (volume - 0.46) * 2.4;
            density = Math.max(0, density);
            density = density * (0.55 + filament * 0.75);
            density = Math.min(1, density) * 0.5;

            const colour = [
                COOL[0] + (WARM[0] - COOL[0]) * hueMix,
                COOL[1] + (WARM[1] - COOL[1]) * hueMix,
                COOL[2] + (WARM[2] - COOL[2]) * hueMix
            ];

            const i = (y * width + x) * 4;
            data.data[i] = colour[0] * density;
            data.data[i + 1] = colour[1] * density;
            data.data[i + 2] = colour[2] * density;
            data.data[i + 3] = 255;
        }
    }

    surface.ctx.putImageData(data, 0, 0);
    return toTexture(surface.canvas, true);
}

// Exposed for tests and for anyone wanting to build further maps
export { fbm, ridged, noise3 };
