/**
 * camera.js - Camera System
 * 
 * Manages the game camera - the player's view into the 3D world.
 * We use OrbitControls to let players rotate and zoom the view,
 * but with limits to keep the game playable.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Import smooth animation utilities for camera transitions
import { dampVector3, easeInOutCubic } from './mathUtils.js';

export let camera;
export let controls;

// Camera shake state (for impact effects)
let shakeIntensity = 0;
let shakeDecay = 5; // How fast shake fades

/**
 * Creates and configures the game camera
 * @param {THREE.WebGLRenderer} renderer - The renderer (needed for controls)
 * @returns {THREE.PerspectiveCamera} The configured camera
 */
export function createCamera(renderer) {
    // PerspectiveCamera mimics human eye - objects farther away appear smaller
    // Parameters: Field of View, Aspect Ratio, Near Clip, Far Clip
    camera = new THREE.PerspectiveCamera(
        60,                                           // FOV in degrees
        window.innerWidth / window.innerHeight,       // Aspect ratio
        0.1,                                          // Near clipping plane
        500                                           // Far clipping plane
    );
    
    // Position camera above and behind the planet, looking down at an angle
    // This gives a good overview of the play area
    camera.position.set(0, 40, 50);
    camera.lookAt(0, 0, 0);
    
    // Set up orbit controls - allows rotating view with mouse
    setupControls(renderer);
    
    return camera;
}

/**
 * Sets up OrbitControls for camera manipulation
 * OrbitControls let users:
 * - Left-drag to rotate view
 * - Right-drag to pan (we disable this)
 * - Scroll to zoom in/out
 */
function setupControls(renderer) {
    controls = new OrbitControls(camera, renderer.domElement);
    
    // Configure control behavior
    controls.enableDamping = true;       // Smooth camera movement
    controls.dampingFactor = 0.05;       // How much smoothing
    
    controls.enablePan = false;          // Disable panning - keep focus on planet
    
    controls.minDistance = 20;           // Can't zoom in closer than this
    controls.maxDistance = 100;          // Can't zoom out farther than this
    
    controls.minPolarAngle = 0.2;        // Limit how high camera can go
    controls.maxPolarAngle = Math.PI / 2 - 0.1;  // Can't go below horizon
    
    // Set initial target (what the camera orbits around)
    controls.target.set(0, 0, 0);        // Look at center (the planet)
    
    controls.update();
}

/**
 * Updates camera controls - must be called each frame for damping to work
 * Also handles camera shake effects
 * @param {number} deltaTime - Time since last frame (optional, for shake)
 */
export function updateCamera(deltaTime = 0.016) {
    if (controls) {
        controls.update();
    }
    
    // Apply camera shake if active
    if (shakeIntensity > 0 && camera) {
        // Random offset based on intensity
        const shakeX = (Math.random() - 0.5) * shakeIntensity;
        const shakeY = (Math.random() - 0.5) * shakeIntensity;
        const shakeZ = (Math.random() - 0.5) * shakeIntensity * 0.5;
        
        // Apply shake (relative to current position)
        camera.position.x += shakeX;
        camera.position.y += shakeY;
        camera.position.z += shakeZ;
        
        // Decay the shake over time
        shakeIntensity = Math.max(0, shakeIntensity - shakeDecay * deltaTime);
    }
}

/**
 * Handles window resize - adjusts camera to new dimensions
 * @param {number} width - New window width
 * @param {number} height - New window height
 */
export function handleResize(width, height) {
    if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();  // Apply the new aspect ratio
    }
}

/**
 * Gets the camera's forward direction (where it's pointing)
 * Useful for determining what the player can see
 * @returns {THREE.Vector3} Normalized direction vector
 */
export function getCameraDirection() {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    return direction;
}

/**
 * Smoothly move camera to a specific position
 * Used for cinematic moments or resetting view
 * 
 * Uses easing for a professional, polished feel
 * 
 * @param {THREE.Vector3} targetPosition - Where to move camera
 * @param {number} duration - How long the transition takes (seconds)
 */
export function setCameraPosition(targetPosition, duration = 1) {
    if (!camera) return;
    
    const startPosition = camera.position.clone();
    const startTime = performance.now();
    
    function animateCamera() {
        const elapsed = (performance.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easing for smooth acceleration/deceleration
        const easedProgress = easeInOutCubic(progress);
        
        // Interpolate position
        camera.position.lerpVectors(startPosition, targetPosition, easedProgress);
        
        if (controls) {
            controls.update();
        }
        
        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        }
    }
    
    animateCamera();
}

/**
 * Trigger a camera shake effect
 * 
 * Great for:
 * - Big explosions
 * - Enemy reaching the planet
 * - Powerful weapon fire
 * 
 * @param {number} intensity - How strong the shake is (0.5 = subtle, 2 = intense)
 * @param {number} decay - How fast shake fades (default 5)
 * 
 * @example
 * // Big explosion
 * shakeCamera(1.5);
 * 
 * // Small impact
 * shakeCamera(0.3, 8);
 */
export function shakeCamera(intensity = 1, decay = 5) {
    shakeIntensity = intensity;
    shakeDecay = decay;
}
