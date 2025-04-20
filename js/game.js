// Main Game Class

class Game {
    constructor() {
        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.canvas = null;
        
        // Game elements
        this.starbase = null;
        this.planet = null;
        this.enemies = [];
        this.projectiles = [];
        this.friendlyFighters = [];
        
        // Game state
        this.isGameRunning = false;
        this.credits = CONFIG.startingCredits;
        this.currentLevel = null;
        this.planetHealth = 100;
        
        // Input state
        this.rotatingLeft = false;
        this.rotatingRight = false;
        
        // UI
        this.ui = null;
        
        // Animation
        this.lastFrameTime = 0;
        this.animationFrame = null;
    }

    init() {
        // Initialize Three.js scene
        this.initScene();
        
        // Create game objects
        this.createPlanet();
        this.createStarbase();
        this.createLights();
        
        // Initialize UI
        this.ui = new UI(this);
        this.ui.init();
        
        // Start animation loop
        this.lastFrameTime = performance.now();
        this.animate(this.lastFrameTime);
    }

    initScene() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 200, 200);
        this.camera.lookAt(0, 0, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        
        // Add renderer to DOM
        this.canvas = this.renderer.domElement;
        document.getElementById('game-canvas').appendChild(this.canvas);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // Add space background
        this.createSpaceBackground();
    }

    createSpaceBackground() {
        // Create starfield
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1 });
        
        const starsVertices = [];
        for (let i = 0; i < 2000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            starsVertices.push(x, y, z);
        }
        
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const starField = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(starField);
    }

    createPlanet() {
        // Create planet mesh
        const geometry = new THREE.SphereGeometry(CONFIG.world.planetRadius, 32, 32);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x0066aa,
            specular: 0x333333,
            shininess: 5,
            map: this.createPlanetTexture()
        });
        
        this.planet = new THREE.Mesh(geometry, material);
        this.planet.castShadow = true;
        this.planet.receiveShadow = true;
        this.scene.add(this.planet);
    }

    createPlanetTexture() {
        // Create a simple procedural texture for the planet
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        // Fill with base color
        context.fillStyle = '#0066aa';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some random details
        for (let i = 0; i < 1000; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 4 + 1;
            const alpha = Math.random() * 0.5 + 0.2;
            
            context.beginPath();
            context.arc(x, y, size, 0, Math.PI * 2);
            context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            context.fill();
        }
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    createStarbase() {
        // Create starbase entity
        this.starbase = new Starbase(this.scene, this);
        this.starbase.init();
    }

    createLights() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x333333);
        this.scene.add(ambientLight);
        
        // Add directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffcc, 1);
        sunLight.position.set(500, 300, 500);
        sunLight.castShadow = true;
        
        // Configure shadow properties
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 1000;
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        
        this.scene.add(sunLight);
    }

    startGame() {
        this.isGameRunning = true;
        this.credits = CONFIG.startingCredits;
        this.ui.updateCredits(this.credits);
        
        // Start at level 1
        this.currentLevel = new Level(this, 1);
        this.currentLevel.init();
        
        // Start animation loop
        this.lastFrameTime = performance.now();
        this.animate();
    }

    animate(currentTime) {
        // Calculate delta time
        const deltaTime = (currentTime - this.lastFrameTime) / 1000; // in seconds
        this.lastFrameTime = currentTime;
        
        // Limit delta time to prevent large jumps
        const cappedDeltaTime = Math.min(deltaTime, 0.1);
        
        // Update game state if game is running
        if (this.isGameRunning) {
            this.update(cappedDeltaTime);
        } else {
            // Even when game is not running, we still want to animate the scene
            // Rotate planet
            if (this.planet) {
                this.planet.rotation.y += 0.005 * cappedDeltaTime;
            }
            
            // Rotate starbase around planet
            if (this.starbase && this.starbase.isAlive) {
                this.starbase.angle += 0.01 * cappedDeltaTime;
                this.starbase.position.x = Math.cos(this.starbase.angle) * CONFIG.world.starbaseOrbitRadius;
                this.starbase.position.z = Math.sin(this.starbase.angle) * CONFIG.world.starbaseOrbitRadius;
                this.starbase.mesh.position.copy(this.starbase.position);
            }
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Continue animation loop
        this.animationFrame = requestAnimationFrame(this.animate.bind(this));
    }

    update(deltaTime) {
        // Update current level
        if (this.currentLevel) {
            this.currentLevel.update(deltaTime);
        }
        
        // Update starbase
        if (this.starbase && this.starbase.isAlive) {
            // Handle manual rotation
            if (this.rotatingLeft) {
                this.starbase.targetAngle -= this.starbase.rotationSpeed * deltaTime * 2;
            }
            if (this.rotatingRight) {
                this.starbase.targetAngle += this.starbase.rotationSpeed * deltaTime * 2;
            }
            
            this.starbase.update(deltaTime);
        }
        
        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].isAlive) {
                this.enemies[i].update(deltaTime);
            } else {
                this.enemies.splice(i, 1);
            }
        }
        
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            if (this.projectiles[i].isAlive) {
                this.projectiles[i].update(deltaTime);
                this.checkProjectileCollisions(this.projectiles[i]);
            } else {
                this.projectiles.splice(i, 1);
            }
        }
        
        // Update friendly fighters
        for (let i = this.friendlyFighters.length - 1; i >= 0; i--) {
            if (this.friendlyFighters[i].isAlive) {
                this.friendlyFighters[i].update(deltaTime);
            } else {
                this.friendlyFighters.splice(i, 1);
            }
        }
        
        // Rotate planet
        if (this.planet) {
            this.planet.rotation.y += 0.005 * deltaTime;
        }
    }

    checkProjectileCollisions(projectile) {
        // Check for collisions with enemies
        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            
            // Skip destroyed enemies
            if (!enemy.isAlive) continue;
            
            // Calculate distance and check collision
            const distance = projectile.position.distanceTo(enemy.position);
            if (distance < enemy.size + projectile.size) {
                // Hit enemy
                const destroyed = enemy.takeDamage(projectile.damage);
                projectile.destroy();
                
                if (destroyed && this.currentLevel) {
                    this.currentLevel.onEnemyDestroyed();
                }
                
                return; // Projectile can only hit one enemy
            }
        }
    }

    findClosestEnemy(entity) {
        let closest = null;
        let closestDistance = Infinity;
        
        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            
            // Skip destroyed enemies
            if (!enemy.isAlive) continue;
            
            const distance = entity.distanceTo(enemy);
            
            // Check if within range and closer than previous closest
            if (entity === this.starbase) {
                // Starbase has a range limit
                if (distance <= entity.cannonRange && distance < closestDistance) {
                    closest = enemy;
                    closestDistance = distance;
                }
            } else {
                // Other entities just find the absolute closest
                if (distance < closestDistance) {
                    closest = enemy;
                    closestDistance = distance;
                }
            }
        }
        
        return closest;
    }

    findEnemyByTargetMode(targetMode) {
        if (this.enemies.length === 0) return null;
        
        switch (targetMode) {
            case 'closest':
                return this.findClosestEnemy(this.starbase);
                
            case 'highest-health':
                return this.enemies.reduce((highest, current) => {
                    return (!highest || (current.isAlive && current.health > highest.health)) ? current : highest;
                }, null);
                
            case 'farthest':
                return this.enemies.reduce((farthest, current) => {
                    const currentDist = this.starbase.distanceTo(current);
                    const farthestDist = farthest ? this.starbase.distanceTo(farthest) : 0;
                    return (!farthest || (current.isAlive && currentDist > farthestDist)) ? current : farthest;
                }, null);
                
            case 'highest-armor':
                return this.enemies.reduce((highest, current) => {
                    return (!highest || (current.isAlive && current.armor > highest.armor)) ? current : highest;
                }, null);
                
            case 'lowest-armor':
                return this.enemies.reduce((lowest, current) => {
                    return (!lowest || (current.isAlive && current.armor < lowest.armor)) ? current : lowest;
                }, null);
                
            default:
                return this.findClosestEnemy(this.starbase);
        }
    }

    rotateStarbaseLeft(isActive) {
        if (!CONFIG.upgrades.autoAim.acquired) {
            this.rotatingLeft = isActive;
        }
    }

    rotateStarbaseRight(isActive) {
        if (!CONFIG.upgrades.autoAim.acquired) {
            this.rotatingRight = isActive;
        }
    }

    setStarbaseTargetAngle(angle) {
        if (!CONFIG.upgrades.autoAim.acquired && this.starbase) {
            this.starbase.targetAngle = angle;
        }
    }

    addCredits(amount) {
        this.credits += amount;
        this.ui.updateCredits(this.credits);
    }

    spendCredits(amount) {
        this.credits -= amount;
        this.ui.updateCredits(this.credits);
    }

    clearEnemies() {
        // Remove all enemies from scene
        for (let i = 0; i < this.enemies.length; i++) {
            this.enemies[i].destroy();
        }
        this.enemies = [];
        
        // Clear projectiles
        for (let i = 0; i < this.projectiles.length; i++) {
            this.projectiles[i].destroy();
        }
        this.projectiles = [];
        
        // Clear friendly fighters
        for (let i = 0; i < this.friendlyFighters.length; i++) {
            this.friendlyFighters[i].destroy();
        }
        this.friendlyFighters = [];
    }

    onLevelComplete() {
        this.ui.showLevelCompleteScreen();
        this.isGameRunning = false;
        cancelAnimationFrame(this.animationFrame);
    }

    startNextLevel() {
        const nextLevel = this.currentLevel.nextLevel();
        
        if (nextLevel) {
            this.currentLevel = nextLevel;
            this.currentLevel.init();
            this.isGameRunning = true;
            this.lastFrameTime = performance.now();
            this.animate();
        } else {
            // No more levels, player has won the game
            // Could show a victory screen here
            alert('Congratulations! You have completed all levels and saved your planet!');
            this.resetGame();
            this.ui.showStartScreen();
        }
    }

    onPlanetHit() {
        this.planetHealth -= 10;
        
        if (this.planetHealth <= 0) {
            this.gameOver();
        }
    }

    gameOver() {
        this.isGameRunning = false;
        cancelAnimationFrame(this.animationFrame);
        this.ui.showGameOverScreen();
    }

    resetGame() {
        this.clearEnemies();
        this.credits = CONFIG.startingCredits;
        this.planetHealth = 100;
        
        // Reset upgrades
        CONFIG.upgrades.autoAim.acquired = false;
        CONFIG.upgrades.cannonDamage.level = 1;
        CONFIG.upgrades.cannonRange.level = 1;
        CONFIG.upgrades.missileLauncher.acquired = false;
        CONFIG.upgrades.missileDamage.level = 0;
        CONFIG.upgrades.missileRange.level = 0;
        CONFIG.upgrades.missileTarget.acquired = false;
        CONFIG.upgrades.missileTarget.currentTarget = 'closest';
        CONFIG.upgrades.launchBay.count = 0;
        
        // Reset starbase
        if (this.starbase) {
            this.scene.remove(this.starbase.mesh);
        }
        this.createStarbase();
        
        // Update UI
        this.ui.updateCredits(this.credits);
    }
}

// Start the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
}); 