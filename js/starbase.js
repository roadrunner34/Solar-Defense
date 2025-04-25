class Starbase {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.rotation = 0;
        this.createStarbase();
        this.setupControls();
        
        // Shooting mechanics
        this.lastShotTime = 0;
        this.shotCooldown = 1000; // 1 second between shots (in milliseconds)
        this.projectiles = [];
        this.damage = 10;
    }

    createStarbase() {
        // Create the main starbase body
        const bodyGeometry = new THREE.CircleGeometry(30, 32);
        const bodyMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x4444ff,
            transparent: true,
            opacity: 0.8
        });
        this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.body.position.z = 0;
        this.scene.add(this.body);

        // Create the laser cannon
        const cannonGeometry = new THREE.BoxGeometry(10, 40, 5);
        const cannonMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff4444,
            transparent: true,
            opacity: 0.8
        });
        this.cannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
        this.cannon.position.y = 35; // Position at the top of the starbase
        this.body.add(this.cannon);

        // Add some decorative elements
        this.addDecorativeElements();
    }

    addDecorativeElements() {
        // Add energy shield effect
        const shieldGeometry = new THREE.CircleGeometry(35, 32);
        const shieldMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.2
        });
        this.shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
        this.shield.position.z = -1;
        this.body.add(this.shield);

        // Add some antennae
        const antennaGeometry = new THREE.CylinderGeometry(1, 1, 15, 8);
        const antennaMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
        
        for (let i = 0; i < 4; i++) {
            const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
            const angle = (i / 4) * Math.PI * 2;
            antenna.position.x = Math.cos(angle) * 25;
            antenna.position.y = Math.sin(angle) * 25;
            antenna.rotation.z = angle + Math.PI / 2;
            this.body.add(antenna);
        }
    }

    setupControls() {
        // Mouse control
        document.addEventListener('mousemove', (event) => {
            // Get the canvas element
            const canvas = this.game.renderer.domElement;
            
            // Get mouse position relative to the canvas
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            // Convert to world coordinates
            const worldX = (mouseX / rect.width) * this.game.camera.right * 2 - this.game.camera.right;
            const worldY = -(mouseY / rect.height) * this.game.camera.top * 2 + this.game.camera.top;
            
            // Calculate angle between starbase and mouse, adjusting for the 90-degree offset
            const angle = Math.atan2(worldY, worldX) - Math.PI / 2;
            
            // Update rotation
            this.rotation = angle;
        });

        // Keyboard control (optional)
        document.addEventListener('keydown', (event) => {
            const rotationSpeed = 0.1;
            if (event.key === 'ArrowLeft') {
                this.rotation -= rotationSpeed;
            } else if (event.key === 'ArrowRight') {
                this.rotation += rotationSpeed;
            }
        });
    }

    shoot() {
        const currentTime = Date.now();
        
        // Check if enough time has passed since the last shot
        if (currentTime - this.lastShotTime >= this.shotCooldown) {
            // Calculate the position at the end of the cannon
            const cannonLength = 40;
            const angle = this.rotation + Math.PI / 2; // Adjust for the 90-degree offset
            
            // Calculate the position at the end of the cannon
            const startX = this.body.position.x + Math.cos(angle) * cannonLength;
            const startY = this.body.position.y + Math.sin(angle) * cannonLength;
            
            // Create a new projectile
            const projectile = new Projectile(this.game, startX, startY, angle);
            this.projectiles.push(projectile);
            
            // Update last shot time
            this.lastShotTime = currentTime;
            
            // Create visual effect for shooting
            this.createShootingEffect(startX, startY, angle);
        }
    }
    
    createShootingEffect(x, y, angle) {
        // Create a flash effect
        const flashGeometry = new THREE.CircleGeometry(5, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.set(x, y, 0);
        this.scene.add(flash);
        
        // Animate the flash
        let opacity = 0.8;
        const animateFlash = () => {
            opacity -= 0.1;
            flashMaterial.opacity = opacity;
            
            if (opacity > 0) {
                requestAnimationFrame(animateFlash);
            } else {
                this.scene.remove(flash);
            }
        };
        
        animateFlash();
    }

    update() {
        // Update starbase rotation using proper Three.js method
        this.body.rotation.z = this.rotation;
        
        // Auto-fire
        this.shoot();
        
        // Update all projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            projectile.update();
            
            // Remove inactive projectiles
            if (!projectile.active) {
                this.projectiles.splice(i, 1);
            }
        }
    }
} 