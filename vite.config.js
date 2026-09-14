/**
 * vite.config.js - Build and test configuration
 *
 * Vite serves the game in development and bundles it for production.
 * It resolves the bare 'three' and 'gsap' imports from node_modules,
 * which is why index.html no longer needs an importmap.
 */

import { defineConfig } from 'vite';

export default defineConfig({
    // The repo root holds index.html, which is the entry point
    root: '.',

    build: {
        outDir: 'dist',
        emptyOutDir: true
    },

    test: {
        // Most modules are pure logic and run fastest without a DOM.
        // Files that genuinely need one opt in per-file with:
        //     // @vitest-environment jsdom
        environment: 'node',
        include: ['tests/**/*.test.js']
    }
});
