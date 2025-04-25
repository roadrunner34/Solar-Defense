class Projectile {
    constructor(game, x, y, angle, speed = 10) {
        this.game = game;
        this.scene = game.scene;
        this.speed = speed;
        this.lifetime = 0;
        this.maxLifetime = 200; // Maximum lifetime in frames
        this.damage = 10;
        this.active = true;
        
        // Create the projectile mesh
        this.createProjectile();
        
        // Set initial position and rotation
        this.mesh.position.set(x, y, 0);
        this.mesh.rotation.z = angle;
        
        // Calculate velocity based on angle and speed
        this.velocity = {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        };
        
        // Add to scene
        this.scene.add(this.mesh);
    }
    
    createProjectile() {
        // Create a laser beam
        const geometry = new THREE.BoxGeometry(2, 10, 1);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8
        });
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Add a glow effect
        const glowGeometry = new THREE.BoxGeometry(4, 12, 0.5);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff5500,
            transparent: true,
            opacity: 0.3
        });
        this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.glow.position.z = -0.5;
        this.mesh.add(this.glow);
    }
    
    update() {
        if (!this.active) return;
        
        // Update position based on velocity
        this.mesh.position.x += this.velocity.x;
        this.mesh.position.y += this.velocity.y;
        
        // Increment lifetime
        this.lifetime++;
        
        // Check if projectile is out of bounds or expired
        const bounds = this.game.camera;
        if (
            this.mesh.position.x < bounds.left - 50 ||
            this.mesh.position.x > bounds.right + 50 ||
            this.mesh.position.y < bounds.bottom - 50 ||
            this.mesh.position.y > bounds.top + 50 ||
            this.lifetime > this.maxLifetime
        ) {
            this.destroy();
        }
    }
    
    destroy() {
        this.active = false;
        this.scene.remove(this.mesh);
    }
} 