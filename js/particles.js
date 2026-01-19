/**
 * particles.js - Enhanced Particle Effects System
 * 
 * This module provides beautiful, GPU-efficient particle effects for the game.
 * Particles are small, short-lived visual elements that add "juice" to the game:
 * - Explosions when enemies die
 * - Muzzle flash sparks
 * - Trail effects for projectiles
 * - Impact sparks
 * 
 * HOW IT WORKS:
 * =============
 * Instead of creating a new mesh for each particle (expensive!), we use
 * THREE.Points with BufferGeometry. This lets the GPU handle thousands of
 * particles efficiently by updating just the position data each frame.
 * 
 * Each "emitter" manages a pool of particles that can be reused.
 */

import * as THREE from 'three';
import { scene } from './scene.js';

// ==================== PARTICLE POOL ====================
// We maintain pools of particles for different effects to avoid
// constantly creating and destroying objects (which is slow)

// Active particle systems
const activeEmitters = [];

// Shared geometries for efficiency
let explosionParticleSystem = null;
let sparkParticleSystem = null;
let trailParticleSystem = null;

// Maximum particles per system type
const MAX_EXPLOSION_PARTICLES = 500;
const MAX_SPARK_PARTICLES = 200;
const MAX_TRAIL_PARTICLES = 300;

/**
 * Initialize the particle systems
 * Creates the shared particle geometries and materials
 */
export function initParticles() {
    // Create explosion particle system
    explosionParticleSystem = createParticleSystem(
        MAX_EXPLOSION_PARTICLES,
        new THREE.Color(2, 1.5, 0.3), // Bright orange-yellow (HDR for bloom!)
        2.0  // Base size
    );
    scene.add(explosionParticleSystem.points);
    
    // Create spark particle system (smaller, faster)
    sparkParticleSystem = createParticleSystem(
        MAX_SPARK_PARTICLES,
        new THREE.Color(0, 2, 2.5), // Bright cyan (HDR for bloom!)
        1.0
    );
    scene.add(sparkParticleSystem.points);
    
    // Create trail particle system
    trailParticleSystem = createParticleSystem(
        MAX_TRAIL_PARTICLES,
        new THREE.Color(0, 1.5, 2), // Softer cyan
        0.8
    );
    scene.add(trailParticleSystem.points);
    
    console.log('Particle systems initialized');
}

/**
 * Creates a particle system with pooled particles
 * 
 * @param {number} maxParticles - Maximum number of particles
 * @param {THREE.Color} color - Base color for particles
 * @param {number} baseSize - Base size of particles
 * @returns {object} Particle system object
 */
function createParticleSystem(maxParticles, color, baseSize) {
    // Create buffer geometry to hold particle positions
    const geometry = new THREE.BufferGeometry();
    
    // Position array: x, y, z for each particle
    const positions = new Float32Array(maxParticles * 3);
    
    // Size array: individual size for each particle
    const sizes = new Float32Array(maxParticles);
    
    // Alpha/opacity array for fading
    const alphas = new Float32Array(maxParticles);
    
    // Initialize all particles at origin with zero size (invisible)
    for (let i = 0; i < maxParticles; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        sizes[i] = 0;
        alphas[i] = 0;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    
    // Custom shader material for particles with per-particle size and alpha
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: color },
            baseSize: { value: baseSize }
        },
        vertexShader: `
            attribute float size;
            attribute float alpha;
            varying float vAlpha;
            uniform float baseSize;
            
            void main() {
                vAlpha = alpha;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                // Size attenuates with distance (closer = bigger)
                gl_PointSize = size * baseSize * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            varying float vAlpha;
            
            void main() {
                // Create circular particles with soft edges
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                
                // Soft falloff from center
                float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
                
                if (alpha < 0.01) discard; // Discard nearly invisible pixels
                
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false, // Particles don't write to depth (allows transparency)
        blending: THREE.AdditiveBlending // Additive blending = glowing effect!
    });
    
    const points = new THREE.Points(geometry, material);
    
    // Particle pool - tracks state of each particle
    const particles = [];
    for (let i = 0; i < maxParticles; i++) {
        particles.push({
            index: i,
            active: false,
            life: 0,
            maxLife: 1,
            velocity: new THREE.Vector3(),
            position: new THREE.Vector3(),
            size: 1,
            startSize: 1,
            endSize: 0
        });
    }
    
    return {
        points,
        geometry,
        particles,
        positions: geometry.attributes.position.array,
        sizes: geometry.attributes.size.array,
        alphas: geometry.attributes.alpha.array,
        nextIndex: 0
    };
}

/**
 * Get the next available particle from a system
 * @param {object} system - The particle system
 * @returns {object|null} A particle object or null if none available
 */
function getParticle(system) {
    // Try to find an inactive particle
    for (let i = 0; i < system.particles.length; i++) {
        const idx = (system.nextIndex + i) % system.particles.length;
        if (!system.particles[idx].active) {
            system.nextIndex = (idx + 1) % system.particles.length;
            return system.particles[idx];
        }
    }
    
    // If all particles are active, reuse the oldest one
    const oldest = system.particles[system.nextIndex];
    system.nextIndex = (system.nextIndex + 1) % system.particles.length;
    return oldest;
}

/**
 * Create an explosion effect at a position
 * 
 * Perfect for enemy deaths - creates a burst of particles that expand outward
 * and fade away. With bloom, this creates a satisfying glowing explosion!
 * 
 * @param {THREE.Vector3} position - Where the explosion occurs
 * @param {THREE.Color} color - Optional color override
 * @param {number} count - Number of particles (default 30)
 * @param {number} speed - Initial velocity (default 8)
 */
export function createExplosion(position, color = null, count = 30, speed = 8) {
    if (!explosionParticleSystem) return;
    
    // Update material color if custom color provided
    if (color) {
        explosionParticleSystem.points.material.uniforms.color.value.copy(color);
    } else {
        // Default explosion color (bright orange)
        explosionParticleSystem.points.material.uniforms.color.value.set(2, 1.5, 0.3);
    }
    
    for (let i = 0; i < count; i++) {
        const particle = getParticle(explosionParticleSystem);
        
        // Initialize particle
        particle.active = true;
        particle.life = 0;
        particle.maxLife = 0.5 + Math.random() * 0.5; // 0.5-1 second lifetime
        
        // Position at explosion center
        particle.position.copy(position);
        
        // Random velocity in sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const velocityMagnitude = speed * (0.5 + Math.random() * 0.5);
        
        particle.velocity.set(
            Math.sin(phi) * Math.cos(theta) * velocityMagnitude,
            Math.sin(phi) * Math.sin(theta) * velocityMagnitude,
            Math.cos(phi) * velocityMagnitude
        );
        
        // Size variation
        particle.startSize = 1 + Math.random() * 2;
        particle.endSize = 0;
        particle.size = particle.startSize;
    }
}

/**
 * Create spark effects at a position
 * 
 * Great for muzzle flashes and impacts - small, fast particles
 * 
 * @param {THREE.Vector3} position - Where to create sparks
 * @param {THREE.Vector3} direction - Optional main direction
 * @param {number} count - Number of sparks (default 10)
 */
export function createSparks(position, direction = null, count = 10) {
    if (!sparkParticleSystem) return;
    
    for (let i = 0; i < count; i++) {
        const particle = getParticle(sparkParticleSystem);
        
        particle.active = true;
        particle.life = 0;
        particle.maxLife = 0.2 + Math.random() * 0.3; // Short lived
        
        particle.position.copy(position);
        
        // Velocity - either random or biased toward direction
        if (direction) {
            // Cone of sparks in direction
            const spread = 0.5;
            particle.velocity.set(
                direction.x + (Math.random() - 0.5) * spread,
                direction.y + (Math.random() - 0.5) * spread,
                direction.z + (Math.random() - 0.5) * spread
            ).normalize().multiplyScalar(15 + Math.random() * 10);
        } else {
            // Random direction
            particle.velocity.set(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            );
        }
        
        particle.startSize = 0.5 + Math.random();
        particle.endSize = 0;
        particle.size = particle.startSize;
    }
}

/**
 * Create a trail particle at a position
 * 
 * Used for projectile trails - creates particles that fade behind moving objects
 * 
 * @param {THREE.Vector3} position - Where to create trail particle
 */
export function createTrailParticle(position) {
    if (!trailParticleSystem) return;
    
    const particle = getParticle(trailParticleSystem);
    
    particle.active = true;
    particle.life = 0;
    particle.maxLife = 0.3; // Short trail life
    
    particle.position.copy(position);
    particle.velocity.set(0, 0, 0); // Trails don't move
    
    particle.startSize = 0.5;
    particle.endSize = 0;
    particle.size = particle.startSize;
}

/**
 * Update all particle systems
 * Call this every frame in your game loop
 * 
 * @param {number} deltaTime - Time since last frame in seconds
 */
export function updateParticles(deltaTime) {
    updateParticleSystem(explosionParticleSystem, deltaTime);
    updateParticleSystem(sparkParticleSystem, deltaTime);
    updateParticleSystem(trailParticleSystem, deltaTime);
}

/**
 * Update a single particle system
 * 
 * @param {object} system - The particle system to update
 * @param {number} deltaTime - Time since last frame
 */
function updateParticleSystem(system, deltaTime) {
    if (!system) return;
    
    let needsUpdate = false;
    
    for (const particle of system.particles) {
        if (!particle.active) continue;
        
        // Update life
        particle.life += deltaTime;
        
        // Check if particle should die
        if (particle.life >= particle.maxLife) {
            particle.active = false;
            // Reset to invisible
            system.sizes[particle.index] = 0;
            system.alphas[particle.index] = 0;
            needsUpdate = true;
            continue;
        }
        
        // Calculate life progress (0 to 1)
        const lifeProgress = particle.life / particle.maxLife;
        
        // Update position
        particle.position.add(
            particle.velocity.clone().multiplyScalar(deltaTime)
        );
        
        // Apply some drag to slow particles over time
        particle.velocity.multiplyScalar(0.98);
        
        // Interpolate size (shrink as particle dies)
        particle.size = particle.startSize + (particle.endSize - particle.startSize) * lifeProgress;
        
        // Calculate alpha (fade out near end of life)
        const alpha = 1 - Math.pow(lifeProgress, 2); // Quadratic fade
        
        // Update buffers
        const idx = particle.index;
        system.positions[idx * 3] = particle.position.x;
        system.positions[idx * 3 + 1] = particle.position.y;
        system.positions[idx * 3 + 2] = particle.position.z;
        system.sizes[idx] = particle.size;
        system.alphas[idx] = alpha;
        
        needsUpdate = true;
    }
    
    // Tell Three.js to update the GPU buffers
    if (needsUpdate) {
        system.geometry.attributes.position.needsUpdate = true;
        system.geometry.attributes.size.needsUpdate = true;
        system.geometry.attributes.alpha.needsUpdate = true;
    }
}

/**
 * Create an enemy death explosion with colored particles
 * 
 * Automatically chooses color based on enemy type
 * 
 * @param {THREE.Vector3} position - Where enemy died
 * @param {string} enemyType - Type of enemy ('basic', 'fast', 'armored')
 */
export function createEnemyDeathEffect(position, enemyType) {
    // Color based on enemy type
    const colors = {
        basic: new THREE.Color(2, 0.5, 0.5),    // Bright red
        fast: new THREE.Color(2, 2, 0.3),       // Bright yellow
        armored: new THREE.Color(1.5, 0.5, 2)   // Bright purple
    };
    
    const color = colors[enemyType] || colors.basic;
    const count = enemyType === 'armored' ? 50 : 30;
    const speed = enemyType === 'fast' ? 12 : 8;
    
    createExplosion(position, color, count, speed);
}

/**
 * Create a weapon fire effect (muzzle sparks)
 * 
 * @param {THREE.Vector3} position - Barrel position
 * @param {THREE.Vector3} direction - Firing direction
 */
export function createMuzzleSparks(position, direction) {
    createSparks(position, direction, 8);
}

/**
 * Dispose of all particle systems (cleanup)
 */
export function disposeParticles() {
    if (explosionParticleSystem) {
        scene.remove(explosionParticleSystem.points);
        explosionParticleSystem.geometry.dispose();
        explosionParticleSystem.points.material.dispose();
    }
    if (sparkParticleSystem) {
        scene.remove(sparkParticleSystem.points);
        sparkParticleSystem.geometry.dispose();
        sparkParticleSystem.points.material.dispose();
    }
    if (trailParticleSystem) {
        scene.remove(trailParticleSystem.points);
        trailParticleSystem.geometry.dispose();
        trailParticleSystem.points.material.dispose();
    }
}
