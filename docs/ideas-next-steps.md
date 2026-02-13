# Ideas & Next Steps

## High Priority

### Depth Estimation Improvements
- **Server-side depth estimation** — Add Python backend with Depth Anything V2 Large/Giant for much better quality. The `api-estimator.ts` stub is ready, just needs a `/api/depth` endpoint.
- **Model size selector** — Let users choose Small (fast, ~26MB) vs Base (~100MB) vs Large for quality/speed tradeoff.
- **WebGPU status indicator** — Show whether the model is running on WebGPU or WASM so users know if they're getting full speed.

### Rendering Quality
- **Inpainting for disocclusion** — At larger camera offsets, gaps appear behind foreground objects. Could use a simple texture-stretch or LaMa-based inpainting.
- **Edge feathering** — Soften depth discontinuity edges to reduce visible mesh stretching artifacts.
- **Anisotropic filtering** — Enable on photo texture for sharper rendering at oblique angles.
- **Anti-aliasing** — Add MSAA or FXAA post-processing pass.

### Viewing Modes
- **Anaglyph mode** — Red/cyan stereoscopic for users with anaglyph glasses (very easy with Three.js AnaglyphEffect).
- **Autostereoscopic / lenticular** — Generate multi-view strip for Looking Glass displays.
- **360° orbit** — Allow full orbit around the displaced mesh (with inpainting for back faces).
- **Focus point / tilt-shift** — Let users tap to set a focus point, blur everything else based on depth.

## Medium Priority

### Export & Sharing
- **Export as video** — Record a wiggle animation as MP4/WebM (MediaRecorder API on the canvas).
- **Export as GIF** — Generate animated GIF from wiggle loop (using gif.js or similar).
- **Export depth map** — Download the processed depth map as PNG.
- **Export as SBS image** — Save the stereo pair as a single side-by-side image.
- **Share link** — Upload image + depth to cloud storage and generate a shareable viewer URL.
- **glTF export** — Export the displaced mesh as a 3D model file.

### UX Improvements
- **Image gallery / history** — Keep previously processed images in IndexedDB so users can switch between them.
- **Undo/redo for depth settings** — Store parameter snapshots for quick comparison.
- **Preset depth profiles** — "Portrait", "Landscape", "Macro" presets that set post-processing defaults.
- **Before/after comparison** — Split-screen or slider comparing original 2D vs 3D effect.
- **Keyboard shortcuts** — Space for wiggle toggle, 1/2/3 for modes, F for fullscreen.
- **Drag-to-orbit in parallax mode** — Click-and-drag camera control as alternative to hover tracking.
- **Touch pinch-to-zoom** — Allow zooming into the 3D view on mobile.

### Performance
- **Web Worker depth processing** — Move post-processing (bilateral filter, gaussian blur) to a Web Worker to avoid blocking the UI thread.
- **Adaptive mesh subdivision** — Lower subdivision on mobile/low-end GPUs, higher on desktop.
- **Image downscaling** — Auto-downscale very large images before depth estimation (the model runs at 518px anyway).
- **Progressive loading** — Show a low-quality preview immediately, refine with better depth estimation.

## Lower Priority / Experimental

### Advanced Depth
- **Manual depth painting** — Let users paint/adjust the depth map manually with a brush tool.
- **Depth from stereo pair** — If user uploads a stereo pair, compute depth from stereo matching instead of AI.
- **Multi-frame depth** — Accept video input and compute temporally consistent depth across frames.
- **Metric depth** — Use Depth Anything V2 metric models for physically accurate depth (useful for VR scale).

### Multi-layer / Parallax
- **Layer decomposition** — Segment image into foreground/midground/background layers (SAM or similar), render as separate planes at different depths for a cleaner parallax effect.
- **Sprite-based parallax** — Alternative to mesh displacement: cut out foreground objects and float them in front.

### Social / Platform
- **Instagram-style 3D photo viewer** — Embed viewer in an iframe, host as a microservice.
- **Batch processing** — Upload multiple images, process all, create a 3D gallery.
- **Live camera 3D** — Use webcam feed with real-time depth estimation for live 3D effect.

### Technical Debt
- **Unit tests** — Add tests for depth post-processing functions (pure math, easy to test).
- **E2E tests** — Playwright tests for the upload → process → view flow.
- **Error boundaries** — Graceful fallback when WebGL context is lost or model fails to load.
- **Accessibility** — Screen reader descriptions, reduced-motion support, keyboard navigation.
- **PWA** — Add service worker + manifest for offline use (model cached locally).
