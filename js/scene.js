/**
 * scene.js - Three.js Scene Setup
 * 
 * This module creates and manages the 3D scene - the "stage" where
 * all our game objects will exist. It includes:
 * - The sun (light source)
 * - The home planet (what we're defending)
 * - Background planets and asteroid field
 * - Orbital rings for visual effect
 */

import * as THREE from 'three';

// Import Lensflare for sun effect
// Lensflares simulate the light artifacts you see in cameras when pointing at bright lights
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

// We'll export these so other modules can add objects to the scene
export let scene;
export let sun;
export let homePlanet;

/**
 * Creates the complete game scene
 * @returns {THREE.Scene} The configured scene
 */
export function createScene() {
    // Create the scene - this is the container for all 3D objects
    scene = new THREE.Scene();
    
    // Set a dark space background
    scene.background = new THREE.Color(0x000011);
    
    // Add fog for depth effect (objects fade into distance)
    scene.fog = new THREE.Fog(0x000011, 50, 200);
    
    // Create all the scene elements
    createSun();
    createHomePlanet();
    createBackgroundPlanets();
    createAsteroidField();
    createOrbitalRings();
    createStarfield();
    setupLighting();
    
    return scene;
}

/**
 * Creates the sun - our main light source
 * The sun is positioned off to one side so it casts dramatic shadows
 * 
 * With bloom post-processing, we use bright colors (values > 1) to make
 * objects glow. The bloom effect picks up these bright areas and makes
 * them "bleed" light into the surrounding pixels.
 * 
 * We also add a Lensflare effect - those streaks of light you see in movies
 * when the camera points at a bright light source. It makes the sun feel
 * more cinematic and realistic!
 */
function createSun() {
    // Create sun geometry (a sphere)
    const sunGeometry = new THREE.SphereGeometry(8, 32, 32);
    
    // Sun material - using MeshBasicMaterial with a bright color
    // The color value can exceed 1.0 to make it extra bright for bloom!
    // We use a bright yellow-orange that will glow nicely
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(2, 1.5, 0.3) // HDR color - values > 1 glow more!
    });
    
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(-60, 20, -40); // Off to the side and up
    
    // Add a point light at sun position (increased intensity for better lighting)
    const sunLight = new THREE.PointLight(0xffeecc, 3, 300);
    sunLight.position.copy(sun.position);
    scene.add(sunLight);
    
    // ==================== LENSFLARE EFFECT ====================
    // Lensflares are those beautiful light streaks you see in photos/movies
    // when pointing at bright lights. They're created by light bouncing
    // inside camera lenses, and adding them makes scenes feel cinematic!
    
    // Create lensflare and add elements (each element is a different "flare")
    const lensflare = new Lensflare();
    
    // Main flare - the big glow around the sun
    // Parameters: color, size, distance (0 = at light, 1 = opposite side of screen)
    lensflare.addElement(new LensflareElement(
        createFlareTexture(0xffffaa, 256), // Light yellow-white
        600,  // Size
        0     // Distance (0 = at the light source)
    ));
    
    // Secondary flares - smaller elements that appear across the screen
    // These create that classic "lens artifact" look
    lensflare.addElement(new LensflareElement(
        createFlareTexture(0xffaa66, 128), // Orange
        150,
        0.2
    ));
    
    lensflare.addElement(new LensflareElement(
        createFlareTexture(0x88ccff, 128), // Blue
        80,
        0.4
    ));
    
    lensflare.addElement(new LensflareElement(
        createFlareTexture(0xffff88, 64), // Yellow
        50,
        0.6
    ));
    
    lensflare.addElement(new LensflareElement(
        createFlareTexture(0xaaddff, 64), // Light blue
        40,
        0.8
    ));
    
    // Add lensflare to the sun light (it follows the light position)
    sunLight.add(lensflare);
    
    // Inner glow layer - creates a softer gradient around the sun
    const innerGlowGeometry = new THREE.SphereGeometry(10, 32, 32);
    const innerGlowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.5, 1, 0.2), // Bright but slightly dimmer than core
        transparent: true,
        opacity: 0.6
    });
    const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
    innerGlow.position.copy(sun.position);
    scene.add(innerGlow);
    
    // Outer glow layer - even softer, spreads the glow wider
    const outerGlowGeometry = new THREE.SphereGeometry(14, 32, 32);
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.0, 0.6, 0.1), // Dimmer orange glow
        transparent: true,
        opacity: 0.3
    });
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    outerGlow.position.copy(sun.position);
    scene.add(outerGlow);
    
    scene.add(sun);
}

/**
 * Creates a simple radial gradient texture for lensflare elements
 * 
 * Normally you'd load image files for lensflare textures, but we can
 * create simple ones programmatically using Canvas. This keeps our
 * game self-contained without needing external image files.
 * 
 * @param {number} color - Hex color for the flare
 * @param {number} size - Size of the texture (should be power of 2)
 * @returns {THREE.CanvasTexture} The generated texture
 */
function createFlareTexture(color, size) {
    // Create an HTML canvas to draw on
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Create a radial gradient (bright in center, fades to transparent)
    const gradient = ctx.createRadialGradient(
        size / 2, size / 2, 0,           // Inner circle: center, radius 0
        size / 2, size / 2, size / 2     // Outer circle: center, radius = half width
    );
    
    // Convert hex color to RGB for gradient
    const r = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const b = color & 255;
    
    // Gradient: bright center fading to transparent edge
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    gradient.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, 0.8)`);
    gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.4)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    
    // Fill with the gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Convert canvas to Three.js texture
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

/**
 * Creates the home planet - what the player is defending
 * This sits at the center of the scene
 */
function createHomePlanet() {
    // Earth-like planet
    const planetGeometry = new THREE.SphereGeometry(5, 32, 32);
    const planetMaterial = new THREE.MeshPhongMaterial({
        color: 0x4488ff,
        emissive: 0x112244,
        shininess: 10
    });
    
    homePlanet = new THREE.Mesh(planetGeometry, planetMaterial);
    homePlanet.position.set(0, 0, 0); // Center of scene
    
    // Add some surface detail with a second layer
    const cloudGeometry = new THREE.SphereGeometry(5.1, 32, 32);
    const cloudMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3
    });
    const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    homePlanet.add(clouds); // Attach clouds to planet
    
    scene.add(homePlanet);
}

/**
 * Creates background planets for visual interest
 * These are decorative - enemies don't interact with them
 */
function createBackgroundPlanets() {
    const planetConfigs = [
        { color: 0xff8844, size: 3, position: new THREE.Vector3(40, 10, -30) },
        { color: 0x88ff88, size: 2, position: new THREE.Vector3(-30, -5, 50) },
        { color: 0xff44ff, size: 4, position: new THREE.Vector3(50, -15, 40) }
    ];
    
    planetConfigs.forEach(config => {
        const geometry = new THREE.SphereGeometry(config.size, 24, 24);
        const material = new THREE.MeshPhongMaterial({
            color: config.color,
            emissive: new THREE.Color(config.color).multiplyScalar(0.2)
        });
        const planet = new THREE.Mesh(geometry, material);
        planet.position.copy(config.position);
        scene.add(planet);
    });
}

/**
 * Creates an asteroid field around the play area
 * These add visual depth but don't affect gameplay in Sprint 1
 */
function createAsteroidField() {
    const asteroidCount = 200;
    
    // Create a geometry that all asteroids will share (instancing is more efficient)
    const asteroidGeometry = new THREE.IcosahedronGeometry(0.5, 0);
    const asteroidMaterial = new THREE.MeshPhongMaterial({
        color: 0x666666,
        flatShading: true
    });
    
    for (let i = 0; i < asteroidCount; i++) {
        const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
        
        // Position asteroids in a ring around the play area
        const angle = Math.random() * Math.PI * 2;
        const distance = 70 + Math.random() * 50; // Between 70 and 120 units out
        const height = (Math.random() - 0.5) * 40; // Spread vertically
        
        asteroid.position.set(
            Math.cos(angle) * distance,
            height,
            Math.sin(angle) * distance
        );
        
        // Random rotation for variety
        asteroid.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        
        // Random scale for variety
        const scale = 0.3 + Math.random() * 1.2;
        asteroid.scale.set(scale, scale, scale);
        
        scene.add(asteroid);
    }
}

/**
 * Creates orbital rings around the home planet
 * These show the "defense perimeter" visually
 * 
 * With bloom, we give them a slight glow to look more sci-fi
 */
function createOrbitalRings() {
    const ringRadii = [15, 25, 40]; // Different ring distances
    
    ringRadii.forEach((radius, index) => {
        const ringGeometry = new THREE.RingGeometry(radius - 0.1, radius + 0.1, 64);
        // Use slightly bright cyan color for a subtle glow effect
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.3, 0.8, 1.2), // Slightly HDR cyan for glow
            transparent: true,
            opacity: 0.25 - index * 0.05, // Outer rings are more transparent
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2; // Lay flat on XZ plane
        scene.add(ring);
    });
}

/**
 * Creates a starfield background
 * Uses points (particles) for efficiency
 */
function createStarfield() {
    const starCount = 1000;
    const positions = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount; i++) {
        // Distribute stars on a large sphere around the scene
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 150 + Math.random() * 50;
        
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
        sizeAttenuation: true
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

/**
 * Sets up scene lighting
 * We use multiple lights for a polished look
 */
function setupLighting() {
    // Ambient light - provides base illumination so shadows aren't pitch black
    const ambientLight = new THREE.AmbientLight(0x333344, 0.5);
    scene.add(ambientLight);
    
    // Directional light - simulates distant sun, creates shadows
    const directionalLight = new THREE.DirectionalLight(0xffffee, 1);
    directionalLight.position.set(-60, 20, -40); // Same direction as sun
    scene.add(directionalLight);
    
    // Hemisphere light - sky/ground lighting for more natural look
    const hemisphereLight = new THREE.HemisphereLight(0x6688cc, 0x222244, 0.3);
    scene.add(hemisphereLight);
}

/**
 * Animate scene elements (called each frame)
 * @param {number} deltaTime - Time since last frame in seconds
 */
export function updateScene(deltaTime) {
    // Slowly rotate the home planet
    if (homePlanet) {
        homePlanet.rotation.y += deltaTime * 0.1;
    }
}
