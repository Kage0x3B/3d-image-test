# Viewing Modes Research

## Mode 1: Parallax Wiggle (Desktop/Mobile)

Subtle 3D effect by moving the camera based on mouse position or device orientation.

### Mouse-Based (Desktop)
- Track mouse position, map to ±MAX_OFFSET camera displacement
- Camera stays pointing at mesh center (`camera.lookAt(0,0,0)`)
- Typical MAX_OFFSET: 0.05 scene units (~3° at z=2 distance)
- Optional: auto-wiggle via sine wave when mouse is idle

### Gyroscope-Based (Mobile)
- `DeviceOrientationEvent`: `gamma` (tilt left/right, -90 to 90) and `beta` (tilt forward/back, -180 to 180)
- Map gamma/beta to camera X/Y offset
- iOS requires permission request: `DeviceOrientationEvent.requestPermission()`
- Fallback to touch-drag if gyroscope unavailable

### Implementation
- `requestAnimationFrame` render loop
- Smooth interpolation (lerp) between current and target camera position for fluid motion
- Limit displacement range to avoid disocclusion artifacts

## Mode 2: Stereoscopic Side-by-Side

Render the displacement mesh from two camera positions for left/right eye views.

### DIBR Principles (Depth Image Based Rendering)

Core formula: `disparity = (baseline * focal_length) / depth`

For relative depth maps, simplified to: `pixel_shift = depth_normalized * max_disparity`

### Implementation: Viewport Scissor Approach

Single WebGL canvas split into two halves using `renderer.setViewport` + `renderer.setScissor`:

```
┌─────────────────────────────────┐
│  Left Eye View  │  Right Eye View │
│  camera.x = -sep │ camera.x = +sep │
└─────────────────────────────────┘
```

- Eye separation: ~0.06 scene units (scaled from ~63mm real IPD)
- Both halves render the same scene, same mesh, different camera X
- **Parallel view**: left image on left, right on right
- **Cross-eye view**: swap (right image on left, left on right)

### Parameters
- **Eye separation**: adjustable slider (0.02 - 0.10)
- **Max disparity**: should not exceed ~1/30 of screen width for comfort
- **Convergence**: both cameras look at same point (mesh center)

## Mode 3: WebXR (Meta Quest)

Full VR stereoscopic rendering using Three.js WebXR API.

### Setup
```javascript
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local');
document.body.appendChild(VRButton.createButton(renderer));
renderer.setAnimationLoop(() => renderer.render(scene, camera));
```

### Key Differences from Normal Rendering
- Must use `renderer.setAnimationLoop()` instead of `requestAnimationFrame`
- Three.js automatically renders twice (once per eye) with proper projection matrices
- Head tracking updates camera position/rotation from headset
- HTTPS required (localhost exempted for development)

### Mesh Positioning in VR
- Place at comfortable distance: z = -1.5 to -2.0 meters
- Eye height: y = 1.5 meters
- Scale mesh to ~1-2 meters wide for natural viewing
- The displacement creates real geometric depth visible in stereo

### Meta Quest Specifics
- Quest 2, 3, 3S, Pro all support WebXR via built-in Chromium browser
- Supports: `immersive-vr`, `immersive-ar`, hand tracking, controllers
- For dev: access via LAN IP with `--host` flag, or ADB port forwarding
- **Immersive Web Emulator** Chrome extension for desktop testing

### Three.js Stereo Utilities (Non-VR Fallback)
- `THREE.StereoCamera` — separate stereo rendering with configurable IPD
- `StereoEffect` — side-by-side output for phone-based VR (Cardboard)

## nunif/iw3 Reference Pipeline

The [nunif/iw3](https://github.com/nagadomi/nunif/blob/master/iw3/README.md) project is a complete 2D-to-3D converter:

- Supports multiple depth models: Depth Anything V2, Depth Pro, ZoeDepth, DA3
- Uses `grid_sample` based lightweight model for stereo view synthesis
- Output formats: Full SBS, Half SBS, Top-Bottom, Cross-Eye, Anaglyph, VR180
- Key parameters: divergence (screen distance), convergence, IPD offset, foreground scale
- Temporal stability for video via EMA normalization + scene boundary detection
- Not browser-based but excellent reference for stereo generation parameters

## SvelteKit + Three.js Integration

### Pattern: onMount/onDestroy Lifecycle

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  let container;
  let renderer;

  onMount(() => {
    renderer = new THREE.WebGLRenderer({ canvas: ... });
    // setup scene
  });

  onDestroy(() => {
    renderer.dispose();
    // cleanup all Three.js resources
  });
</script>
<div bind:this={container}></div>
```

### Why Raw Three.js (not Threlte)
- Full control over render loop (critical for WebXR `setAnimationLoop`)
- Direct access to viewport/scissor for stereo mode
- Easier to follow Three.js examples and tutorials
- No abstraction layer to work around for custom shaders
- Threlte's `@threlte/xr` adds unnecessary dependency

## References

- [Three.js WebXR panorama depth example](https://github.com/mrdoob/three.js/blob/dev/examples/webxr_vr_panorama_depth.html)
- [Meta WebXR First Steps](https://github.com/meta-quest/webxr-first-steps)
- [VR Headsets for WebXR](https://threejsresources.com/vr/blog/best-vr-headsets-with-webxr-support-for-three-js-developers-2026)
- [DIBR explanation](https://noidh.github.io/pages/notes/ip/dibr/dibr.html)
- [nunif/iw3](https://github.com/nagadomi/nunif/blob/master/iw3/README.md)
- [Stereo and Disparity (John Lambert)](https://johnwlambert.github.io/stereo/)
