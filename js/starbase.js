class Starbase {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.rotation = 0;
        this.createStarbase();
        this.setupControls();
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

    update() {
        // Update starbase rotation using proper Three.js method
        this.body.rotation.z = this.rotation;
    }
} 