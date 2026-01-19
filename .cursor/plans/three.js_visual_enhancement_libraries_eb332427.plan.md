---
name: three.js visual enhancement libraries
overview: Research and recommend open-source Three.js libraries that can enhance the visual quality of the Solar Defense game, including post-processing effects, particle systems, and animation libraries.
todos:
  - id: research-libraries
    content: Research and document available Three.js libraries for visual enhancement
    status: completed
  - id: analyze-current-state
    content: Analyze current game visuals and identify improvement areas
    status: completed
  - id: create-recommendations
    content: Create prioritized list of library recommendations with integration complexity
    status: completed
---

# Three.js Visual Enhancement Libraries for Solar Defense

## Current State Analysis

Your game currently uses:

- Basic Three.js materials (MeshPhongMaterial, MeshBasicMaterial)
- Simple lighting (PointLight, DirectionalLight, AmbientLight, HemisphereLight)
- Basic particle system (starfield using Points)
- Simple hit effects (expanding rings)
- Basic fog for depth

## Recommended Libraries

### 1. Post-Processing Effects (Highest Impact)

**Library: `postprocessing` by PMNDRS**

- **CDN**: `https://cdn.jsdelivr.net/npm/postprocessing@6.26.3/+esm`
- **What it improves**: Overall visual polish with bloom, color grading, depth of field, and more
- **Best for**: Making bright objects (sun, projectiles, explosions) glow and pop
- **Key features**:
- Bloom effect (glow around bright objects)
- Selective bloom (only glow specific objects like projectiles)
- Color grading (enhance space atmosphere)
- Vignette (darken edges for cinematic look)
- Performance optimized (merges passes efficiently)

**Why this first**: It's the most impactful single addition - will make your sun, projectiles, and hit effects look dramatically better with minimal code changes.

**Integration complexity**: Medium - requires EffectComposer setup but well-documented

---

### 2. Enhanced Particle Systems

**Option A: `three.quarks`** (Most Flexible)

- **CDN**: `https://cdn.jsdelivr.net/npm/three.quarks@latest/+esm`
- **What it improves**: Explosion effects, muzzle flashes, enemy death effects, trail effects
- **Best for**: Complex particle behaviors (fire, smoke, energy bursts)
- **Key features**:
- GPU-accelerated particles
- Visual editor available
- Multiple emitter shapes
- Behavior over lifetime (size, color, velocity changes)
- Trail rendering

**Option B: `wawa-vfx`** (Simpler, Good Performance)

- **CDN**: `https://cdn.jsdelivr.net/npm/wawa-vfx@latest/+esm`
- **What it improves**: Similar to three.quarks but simpler API
- **Best for**: If you want something easier to learn
- **Key features**:
- Instanced rendering (good performance)
- Works with vanilla Three.js
- Clean, declarative API

**Why consider**: Your current hit effects and muzzle flashes are very basic. A particle library would make explosions, weapon effects, and enemy deaths much more impressive.

**Integration complexity**: Medium-High - requires learning particle system concepts

---

### 3. Animation Libraries

**Library: `maath` by PMNDRS** (Recommended for Smooth Motion)

- **CDN**: `https://cdn.jsdelivr.net/npm/maath@latest/+esm`
- **What it improves**: Smoother camera movements, turret rotation, enemy movement
- **Best for**: Frame-rate independent smooth animations
- **Key features**:
- `damp` functions for vectors, colors, quaternions
- Better than basic lerp (frame-rate independent)
- Easing functions
- Math utilities for 3D

**Alternative: GSAP** (For Complex Sequences)

- **CDN**: `https://cdn.jsdelivr.net/npm/gsap@latest/+esm`
- **What it improves**: Wave transitions, UI animations, camera cuts
- **Best for**: Timed sequences and complex choreography
- **Key features**:
- Timeline control
- Many easing options
- Can animate any property

**Why consider**: Your turret rotation uses basic lerp. `maath` would make it smoother and frame-rate independent. GSAP would be better for wave announcements and transitions.

**Integration complexity**: Low-Medium - maath is simple drop-in, GSAP requires more setup

---

### 4. Additional Visual Enhancements

**Three.js Built-in Addons** (No External Library Needed)

- **UnrealBloomPass**: Already included in Three.js examples
- Path: `three/addons/postprocessing/UnrealBloomPass.js`
- Simpler than postprocessing library but less features
- **Lensflare**: For sun glow effect
- Path: `three/addons/objects/Lensflare.js`
- **Sky**: For better space backgrounds
- Path: `three/addons/objects/Sky.js`

**Why consider**: These are already available in your Three.js installation - no CDN needed, just import from the examples folder.

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Low Effort, High Impact)

1. **Postprocessing library - Bloom effect**

- Add glow to sun, projectiles, and hit effects
- Estimated improvement: 40% visual quality boost
- Time: 1-2 hours

2. **Three.js Lensflare** (built-in)

- Enhance sun appearance
- Time: 30 minutes

### Phase 2: Medium Impact (Moderate Effort)

3. **maath for smooth animations**

- Improve turret rotation and camera movement
- Time: 1 hour

4. **Enhanced particle system** (three.quarks or wawa-vfx)

- Better explosion and hit effects
- Time: 3-4 hours

### Phase 3: Polish (Higher Effort)

5. **GSAP for UI/transitions**

- Smooth wave announcements and screen transitions
- Time: 2-3 hours

6. **Postprocessing - Additional effects**

- Color grading, vignette, depth of field
- Time: 2-3 hours

---

## Specific Improvements for Your Game

### Projectiles

- **Current**: Simple cylinder with point light
- **With Bloom**: Glowing energy beams that leave trails
- **With Particles**: Energy particles along the beam path

### Hit Effects

- **Current**: Simple expanding ring
- **With Particles**: Explosion with debris, sparks, and energy burst
- **With Bloom**: Glowing explosion that lights up nearby objects

### Sun

- **Current**: Basic sphere with glow sphere
- **With Lensflare**: Realistic lens flare effect
- **With Bloom**: Enhanced glow that affects nearby objects

### Enemy Deaths

- **Current**: Just disappears
- **With Particles**: Explosion with colored particles matching enemy type
- **With Bloom**: Glowing death effect

### Starbase Muzzle Flash

- **Current**: Simple expanding sphere
- **With Particles**: Muzzle flash with sparks and smoke
- **With Bloom**: Glowing flash effect

---

## Learning Resources

Each library has good documentation:

- **postprocessing**: https://pmndrs.github.io/postprocessing/
- **three.quarks**: https://docs.quarks.art/
- **maath**: https://github.com/pmndrs/maath
- **GSAP**: https://gsap.com/docs/

---

## Performance Considerations

- **Postprocessing**: Adds ~5-15% GPU overhead depending on effects
- **Particle systems**: Performance depends on particle count (your current 200 asteroids + particles should be fine)
- **maath**: Negligible overhead (just math functions)
- **GSAP**: Very lightweight for simple animations

Your game currently runs well, so these additions should be fine. You can always disable effects on lower-end devices.

---

## Next Steps

1. Start with **postprocessing bloom** - biggest visual impact
2. Test performance with bloom enabled
3. Add **maath** for smoother animations
4. Enhance **hit effects** with particle system
5. Add **lensflare** to sun

Would you like me to help implement any of these? I'd recommend starting with the postprocessing bloom effect as it provides the most dramatic visual improvement with relatively simple integration.