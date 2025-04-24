// Game initialization
class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(
            window.innerWidth / -2,
            window.innerWidth / 2,
            window.innerHeight / 2,
            window.innerHeight / -2,
            1,
            1000
        );
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: true
        });
        
        this.init();
    }

    init() {
        // Set up renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000);

        // Position camera
        this.camera.position.z = 5;

        // Create solar system background
        this.createSolarSystemBackground();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Start animation loop
        this.animate();
    }

    createSolarSystemBackground() {
        // Create stars (background)
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xFFFFFF,
            size: 0.1
        });

        const starsVertices = [];
        for (let i = 0; i < 1000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = -500;
            starsVertices.push(x, y, z);
        }

        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);

        // Create a distant sun (glow effect)
        const sunGeometry = new THREE.CircleGeometry(100, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.3
        });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        sun.position.set(0, 0, -400);
        this.scene.add(sun);

        // Add some distant planets (decorative)
        const planetColors = [0x4444ff, 0xff4444, 0x44ff44];
        for (let i = 0; i < 3; i++) {
            const planetGeometry = new THREE.CircleGeometry(20 + i * 10, 32);
            const planetMaterial = new THREE.MeshBasicMaterial({
                color: planetColors[i],
                transparent: true,
                opacity: 0.2
            });
            const planet = new THREE.Mesh(planetGeometry, planetMaterial);
            planet.position.set(
                (Math.random() - 0.5) * 800,
                (Math.random() - 0.5) * 800,
                -450
            );
            this.scene.add(planet);
        }
    }

    onWindowResize() {
        this.camera.left = window.innerWidth / -2;
        this.camera.right = window.innerWidth / 2;
        this.camera.top = window.innerHeight / 2;
        this.camera.bottom = window.innerHeight / -2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game when the window loads
window.addEventListener('load', () => {
    const game = new Game();
}); 