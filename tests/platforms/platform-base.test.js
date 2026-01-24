/**
 * platform-base.test.js - Tests for Base Platform Class Structure
 * 
 * This test file verifies that Task 1.2 is completed correctly:
 * - Platform class/object structure exists
 * - createPlatform() function works
 * - Platforms array tracks all platforms
 * - Platform renders correctly in scene
 * - Platform has correct properties (type, position, stats)
 */

import * as THREE from 'three';
import { createScene, scene } from '../../js/scene.js';
import { createPlatform, platforms, removePlatform, clearAllPlatforms } from '../../js/platform.js';
import { CONFIG, getPlatformConfig } from '../../js/config.js';

/**
 * Test suite for base platform structure
 * Run these tests to verify Task 1.2 is completed correctly
 * @returns {boolean} True if all tests pass, false otherwise
 */
export function runPlatformBaseTests() {
    const tests = [];
    let passed = 0;
    let failed = 0;

    // Initialize scene for testing (needed for platforms to be added)
    let sceneInitialized = false;
    try {
        createScene();
        sceneInitialized = true;
    } catch (error) {
        tests.push({ 
            name: 'Scene initialization', 
            passed: false, 
            error: `Failed to initialize scene: ${error.message}` 
        });
        failed++;
    }

    // Clear any existing platforms before testing
    if (sceneInitialized) {
        clearAllPlatforms();
    }

    // Test 1: createPlatform() function exists and is callable
    try {
        if (typeof createPlatform !== 'function') {
            throw new Error('createPlatform is not a function');
        }
        tests.push({ name: 'createPlatform() function exists', passed: true });
        passed++;
    } catch (error) {
        tests.push({ name: 'createPlatform() function exists', passed: false, error: error.message });
        failed++;
    }

    // Test 2: platforms array exists and is exported
    try {
        if (!Array.isArray(platforms)) {
            throw new Error('platforms is not an array');
        }
        tests.push({ name: 'platforms array exists', passed: true });
        passed++;
    } catch (error) {
        tests.push({ name: 'platforms array exists', passed: false, error: error.message });
        failed++;
    }

    // Test 3: Can create a laserBattery platform
    if (sceneInitialized) {
        try {
            const position = new THREE.Vector3(10, 0, 10);
            const platform = createPlatform('laserBattery', position);
            
            if (!platform) {
                throw new Error('createPlatform() returned null or undefined');
            }
            if (platform.type !== 'laserBattery') {
                throw new Error(`Expected type 'laserBattery', got '${platform.type}'`);
            }
            if (!platform.mesh) {
                throw new Error('Platform missing mesh property');
            }
            
            tests.push({ name: 'Can create laserBattery platform', passed: true });
            passed++;
        } catch (error) {
            tests.push({ name: 'Can create laserBattery platform', passed: false, error: error.message });
            failed++;
        }
    }

    // Test 4: Platform has correct stats from config
    if (sceneInitialized) {
        try {
            clearAllPlatforms();
            const position = new THREE.Vector3(15, 0, 15);
            const platform = createPlatform('laserBattery', position);
            const config = getPlatformConfig('laserBattery');
            
            if (platform.damage !== config.damage) {
                throw new Error(`Expected damage ${config.damage}, got ${platform.damage}`);
            }
            if (platform.range !== config.range) {
                throw new Error(`Expected range ${config.range}, got ${platform.range}`);
            }
            if (platform.fireRate !== config.fireRate) {
                throw new Error(`Expected fireRate ${config.fireRate}, got ${platform.fireRate}`);
            }
            if (platform.cost !== config.cost) {
                throw new Error(`Expected cost ${config.cost}, got ${platform.cost}`);
            }
            
            tests.push({ name: 'Platform has correct stats from config', passed: true });
            passed++;
        } catch (error) {
            tests.push({ name: 'Platform has correct stats from config', passed: false, error: error.message });
            failed++;
        }
    }

    // Test 5: Platform position is set correctly
    if (sceneInitialized) {
        try {
            clearAllPlatforms();
            const testPosition = new THREE.Vector3(20, 5, 25);
            const platform = createPlatform('laserBattery', testPosition);
            
            if (!platform.position.equals(testPosition)) {
                throw new Error(`Expected position ${testPosition}, got ${platform.position}`);
            }
            if (!platform.mesh.position.equals(testPosition)) {
                throw new Error(`Mesh position doesn't match: expected ${testPosition}, got ${platform.mesh.position}`);
            }
            
            tests.push({ name: 'Platform position is set correctly', passed: true });
            passed++;
        } catch (error) {
            tests.push({ name: 'Platform position is set correctly', passed: false, error: error.message });
            failed++;
        }
    }

    // Test 6: Platform is added to platforms array
    if (sceneInitialized) {
        try {
            clearAllPlatforms();
            const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
            
            if (platforms.length !== 1) {
                throw new Error(`Expected 1 platform in array, got ${platforms.length}`);
            }
            if (platforms[0] !== platform) {
                throw new Error('Platform not found in platforms array');
            }
            
            tests.push({ name: 'Platform is added to platforms array', passed: true });
            passed++;
        } catch (error) {
            tests.push({ name: 'Platform is added to platforms array', passed: false, error: error.message });
            failed++;
        }
    }

    // Test 7: Can create missileLauncher platform
    if (sceneInitialized) {
        try {
            clearAllPlatforms();
            const position = new THREE.Vector3(30, 0, 30);
            const platform = createPlatform('missileLauncher', position);
            
            if (platform.type !== 'missileLauncher') {
                throw new Error(`Expected type 'missileLauncher', got '${platform.type}'`);
            }
            
            const config = getPlatformConfig('missileLauncher');
            if (platform.damage !== config.damage) {
                throw new Error(`Expected damage ${config.damage}, got ${platform.damage}`);
            }
            
            tests.push({ name: 'Can create missileLauncher platform', passed: true });
            passed++;
        } catch (error) {
            tests.push({ name: 'Can create missileLauncher platform', passed: false, error: error.message });
            failed++;
        }
    }

    // Test 8: Platform mesh is visible in scene
    if (sceneInitialized) {
        try {
            clearAllPlatforms();
            const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
            
            if (!platform.mesh.visible) {
                throw new Error('Platform mesh is not visible');
            }
            if (platform.mesh.parent !== scene) {
                throw new Error('Platform mesh is not added to scene');
            }
            
            tests.push({ name: 'Platform mesh is visible in scene', passed: true });
            passed++;
        } catch (error) {
            tests.push({ name: 'Platform mesh is visible in scene', passed: false, error: error.message });
            failed++;
        }
    }

    // Test 9: Platform has required properties
    if (sceneInitialized) {
        try {
            clearAllPlatforms();
            const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
            
            const requiredProps = ['mesh', 'type', 'position', 'damage', 'range', 'fireRate', 'cost', 'id', 'alive'];
            const missingProps = requiredProps.filter(prop => !(prop in platform));
            
            if (missingProps.length > 0) {
                throw new Error(`Missing required properties: ${missingProps.join(', ')}`);
            }
            
            tests.push({ name: 'Platform has all required properties', passed: true });
            passed++;
        } catch (error) {
            tests.push({ name: 'Platform has all required properties', passed: false, error: error.message });
            failed++;
        }
    }

    // Test 10: removePlatform() function works
    if (sceneInitialized) {
        try {
            clearAllPlatforms();
            const platform = createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
            const initialCount = platforms.length;
            
            removePlatform(platform);
            
            if (platforms.length !== initialCount - 1) {
                throw new Error(`Expected ${initialCount - 1} platforms after removal, got ${platforms.length}`);
            }
            if (platform.alive !== false) {
                throw new Error('Platform should be marked as not alive after removal');
            }
            
            tests.push({ name: 'removePlatform() function works', passed: true });
            passed++;
        } catch (error) {
            tests.push({ name: 'removePlatform() function works', passed: false, error: error.message });
            failed++;
        }
    }

    // Test 11: clearAllPlatforms() function works
    if (sceneInitialized) {
        try {
            clearAllPlatforms();
            createPlatform('laserBattery', new THREE.Vector3(0, 0, 0));
            createPlatform('missileLauncher', new THREE.Vector3(10, 0, 10));
            
            if (platforms.length !== 2) {
                throw new Error(`Expected 2 platforms before clear, got ${platforms.length}`);
            }
            
            clearAllPlatforms();
            
            if (platforms.length !== 0) {
                throw new Error(`Expected 0 platforms after clear, got ${platforms.length}`);
            }
            
            tests.push({ name: 'clearAllPlatforms() function works', passed: true });
            passed++;
        } catch (error) {
            tests.push({ name: 'clearAllPlatforms() function works', passed: false, error: error.message });
            failed++;
        }
    }

    // Clean up
    if (sceneInitialized) {
        clearAllPlatforms();
    }

    // Print test results
    console.log('\n=== Base Platform Structure Tests (Task 1.2) ===');
    tests.forEach(test => {
        const status = test.passed ? '✓ PASS' : '✗ FAIL';
        console.log(`${status}: ${test.name}`);
        if (!test.passed && test.error) {
            console.log(`  Error: ${test.error}`);
        }
    });
    console.log(`\nResults: ${passed} passed, ${failed} failed, ${tests.length} total`);
    
    if (failed === 0) {
        console.log('✓ All tests passed! Task 1.2 is complete.\n');
        return true;
    } else {
        console.log('✗ Some tests failed. Please review the errors above.\n');
        return false;
    }
}

// Make it available globally for easy testing in browser console
if (typeof window !== 'undefined') {
    window.runPlatformBaseTests = runPlatformBaseTests;
}
