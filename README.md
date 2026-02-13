# 3D Photo Viewer

Browser-based 3D photo viewer that converts 2D images into 3D using AI depth estimation — entirely client-side, no server required.

Upload any photo, and [Depth Anything V2 Small](https://huggingface.co/onnx-community/depth-anything-v2-small) runs directly in your browser via [Transformers.js](https://huggingface.co/docs/transformers.js) (ONNX/WebGPU). The resulting depth map drives a displaced [Three.js](https://threejs.org/) mesh you can explore in three viewing modes:

- **Parallax** — Mouse, touch, or gyroscope-driven camera movement with optional auto-wiggle animation
- **Stereoscopic** — Side-by-side rendering for parallel or cross-eye 3D viewing
- **WebXR VR** — Immersive VR headset mode via the WebXR API

## How It Works

```
Upload → Depth Estimation (Web Worker) → Post-Processing (Web Worker) → 3D Viewing
```

1. **Upload** a photo via drag-and-drop or file picker
2. **Depth estimation** runs in a Web Worker — auto-selects WebGPU when available, falls back to WASM
3. **Post-processing** (bilateral filter, Gaussian blur, contrast/brightness) runs in a separate cancellable worker so you can tweak settings without blocking the UI
4. **3D viewing** renders the photo on a displaced Three.js mesh — same geometry, different camera strategies per mode

## Getting Started

**Prerequisites:** Node v24+, pnpm

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

The dev server binds to all interfaces (`--host`), so you can open it on your phone or VR headset on the same network.

### Other Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Production build |
| `pnpm check` | TypeScript / Svelte type checking |
| `pnpm check:watch` | Type checking in watch mode |

## Tech Stack

- **[SvelteKit](https://svelte.dev/)** — Svelte 5 with runes
- **[TypeScript](https://www.typescriptlang.org/)**
- **[Tailwind CSS v4](https://tailwindcss.com/)** — via Vite plugin
- **[Three.js](https://threejs.org/)** — 3D rendering, mesh displacement, WebXR
- **[Transformers.js](https://huggingface.co/docs/transformers.js)** — In-browser ML inference (ONNX runtime)

## Project Structure

```
src/
├── routes/+page.svelte          # Main orchestration (upload → processing → viewing)
├── lib/
│   ├── components/              # Svelte UI components
│   │   ├── ViewerShell.svelte   # Three.js mount, mode lifecycle, resize
│   │   ├── ControlPanel.svelte  # Settings for viewing modes & post-processing
│   │   ├── ImageUploader.svelte # Drag/drop + file picker
│   │   └── ProcessingOverlay.svelte
│   ├── depth/                   # Depth estimation & post-processing
│   │   ├── browser-estimator.ts # Transformers.js pipeline (WebGPU/WASM)
│   │   └── post-process.ts      # Bilateral filter, blur, contrast (DOM-free)
│   ├── workers/                 # Web Worker communication layer
│   │   ├── depth-estimation.worker.ts / client.ts
│   │   └── post-process.worker.ts / client.ts
│   ├── renderer/                # Three.js scene setup
│   │   ├── scene-manager.ts     # Scene, camera, lighting, displaced mesh
│   │   ├── mesh-builder.ts      # Subdivided PlaneGeometry with displacement
│   │   └── texture-utils.ts     # Canvas/image → Three.js texture helpers
│   ├── modes/                   # Viewing mode strategy pattern
│   │   ├── parallax-mode.ts     # Mouse/touch/gyroscope + auto-wiggle
│   │   ├── stereo-mode.ts       # Side-by-side via viewport scissor
│   │   └── webxr-mode.ts        # VR headset mode with VRButton
│   └── stores/
│       └── app-state.svelte.ts  # Svelte 5 runes-based app state
```

## Docs

The `docs/` directory contains research notes and planning documents:

- **[Research: Depth Estimation](docs/research-depth-estimation.md)** — Model comparison (Depth Anything V2, MiDaS, Depth Pro, etc.)
- **[Research: Rendering](docs/research-rendering.md)** — Approaches from shader UV displacement to mesh displacement to point clouds
- **[Research: Viewing Modes](docs/research-viewing-modes.md)** — Parallax, stereoscopic, and VR implementation details
- **[Research: Living 3D Photos](docs/research-living-3d-photos.md)** — Combining image-to-video generation with depth for animated 3D photos
- **[Research: References](docs/research-references.md)** — Links to models, papers, and related projects
- **[Ideas & Next Steps](docs/ideas-next-steps.md)** — Planned features: server-side depth, anaglyph mode, video/GIF export, glTF export, and more

## Browser Compatibility

Best experience in browsers with **WebGPU** support (Chrome 113+, Edge 113+) for fast depth inference. Falls back to WASM in browsers without WebGPU. WebXR VR mode requires a compatible browser and headset.
