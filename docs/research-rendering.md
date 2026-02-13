# Rendering Research: 2D Image + Depth Map to 3D

## Rendering Approaches (Simplest to Most Complex)

### Approach A: Fragment Shader UV Displacement (Simplest)

For each output pixel, offset UV sampling based on depth and camera offset:

```glsl
vec2 displaced_uv = uv + direction * texture2D(depthMap, uv).r * intensity;
vec4 color = texture2D(photo, displaced_uv);
```

- **Pros**: Real-time (60fps+), trivial to implement, no holes by design (backward warping)
- **Cons**: Not true parallax — distortion/stretching effect. Foreground "smears" rather than revealing background. Can't produce real stereo depth.
- **Used by**: Facebook 3D Photos, Codrops tutorials, DepthFlow

### Approach B: Mesh Displacement (Chosen)

Create a subdivided plane, displace vertices by depth, texture with original photo:

```javascript
const geometry = new THREE.PlaneGeometry(2, 1.5, 256, 256);
const material = new THREE.MeshStandardMaterial({
  map: photoTexture,
  displacementMap: depthTexture,
  displacementScale: 0.3,
});
```

- **Pros**: True 3D geometry, works for all viewing modes (parallax, stereo, WebXR). Natural stereoscopic depth when rendered from two viewpoints.
- **Cons**: Triangle stretching at depth discontinuities. Background behind foreground objects is missing.
- **Why chosen**: Most versatile — same mesh works across all three viewing modes by just repositioning the camera.

### Approach C: Point Cloud

Convert each pixel to a 3D point based on depth:

- **Pros**: No stretching artifacts. Natural density variation.
- **Cons**: Gaps between points. Requires careful point sizing.
- **Used by**: DepthAnything-on-Browser interactive mode

### Approach D: Layered Depth Image (LDI) + Inpainting (Most Complex)

Multi-layer representation with CNN-based inpainting of occluded regions:

1. Depth estimation → depth edge detection → LDI construction
2. CNN inpaints color + depth behind foreground objects
3. Complete mesh renderable from novel viewpoints

- **Used by**: Meta's "3D Photo Inpainting" (CVPR 2020)
- **Not needed for prototype**: Google's Cinematic Photos proves production quality is achievable without inpainting by limiting camera movement.

## The Disocclusion Problem

When shifting perspective, areas behind foreground objects become visible but have no source data.

### Why We Skip Inpainting

1. **Backward warping** (shader approach) has no holes by design
2. **Mesh displacement** stretches triangles at depth edges, naturally filling small gaps
3. **Limited camera movement** (±3-5°) keeps artifacts barely visible
4. **Google Cinematic Photos** proves this works at production scale without any inpainting

### If Needed Later: Gap-Filling Strategies

| Strategy | Complexity | Description |
|----------|-----------|-------------|
| Limit parallax | Trivial | Clamp camera to ±2-5° |
| Edge stretching | Very Low | Mesh triangles stretch background into gaps |
| Background blur | Low-Medium | Fill gaps with blurred nearby pixels |
| CNN inpainting | Very High | Full LDI + neural network (Meta approach) |

## Depth Map Post-Processing

- **Bilateral filter**: Smooths depth while preserving edges (recommended)
- **Normalization**: Scale to [0,1] for shader/displacement use
- **Optional Gaussian blur** (sigma 1-2px): Reduces micro-artifacts
- Resolution mismatch is fine — Three.js interpolates via UV mapping

## Three.js Displacement Map Notes

- `displacementMap` pushes vertices along normals (higher value = more displacement toward camera)
- Depth Anything V2: higher values = farther. May need inversion depending on desired effect.
- `displacementScale` controls intensity (0.3-0.5 typical for photos)
- Need sufficient subdivisions (256x256 = 65K vertices for smooth result)
- `colorSpace` on depth texture should be `LinearSRGBColorSpace` (not sRGB)

## References

- [Codrops: Fake 3D with WebGL](https://tympanus.net/codrops/2019/02/20/how-to-create-a-fake-3d-image-effect-with-webgl/)
- [Three.js Displacement Map Tutorial](https://sbcode.net/threejs/displacmentmap/)
- [Facebook 3D Photos Analysis](https://www.alanzucconi.com/2019/01/01/facebook-3d-photos/)
- [3D Photo Inpainting (CVPR 2020)](https://github.com/vt-vl-lab/3d-photo-inpainting)
- [Google Cinematic Photos](https://research.google/blog/the-technology-behind-cinematic-photos/)
- [DepthFlow](https://github.com/BrokenSource/DepthFlow)
- [depthmap-viewer-three](https://github.com/thygate/depthmap-viewer-three)
