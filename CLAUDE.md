# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based 3D photo viewer that converts 2D images to 3D using AI depth estimation. Users upload a photo, Depth Anything V2 Small runs in-browser via Transformers.js (ONNX/WebGPU), and the resulting depth map is used to create a displaced Three.js mesh viewable in three modes: parallax wiggle, stereoscopic side-by-side, and WebXR VR.

## Commands

- `pnpm dev` — start dev server (binds to all interfaces via `--host`)
- `pnpm build` — production build
- `pnpm check` — TypeScript/Svelte type checking
- `pnpm check:watch` — type checking in watch mode

Node v24, pnpm workspace, engine-strict.

## Tech Stack

SvelteKit (Svelte 5 with runes), TypeScript, Tailwind CSS v4 (via Vite plugin), Three.js, `@huggingface/transformers` for in-browser depth estimation. No test framework configured yet.

## Architecture

### Pipeline Flow

Upload → Depth Estimation (Web Worker) → Post-Processing (Web Worker) → 3D Viewing

The main orchestration lives in `src/routes/+page.svelte`. It drives a three-stage UI (`upload` → `processing` → `viewing`) tracked by `appState.stage`.

### Key Modules

**`src/lib/depth/`** — Depth estimation and post-processing
- `browser-estimator.ts` — Wraps Transformers.js `depth-estimation` pipeline with `onnx-community/depth-anything-v2-small`. Auto-selects WebGPU when available, falls back to WASM.
- `post-process.ts` — Pure-math bilateral filter, Gaussian blur, contrast/brightness, inversion on Float32Array depth data. DOM-free so it runs in both main thread and Web Workers.
- `index.ts` — Factory with `DepthProvider` abstraction (`'browser'` implemented, `'api'` stub for future server-side).

**`src/lib/workers/`** — Web Worker communication layer
- `depth-estimation.worker.ts` + `depth-estimation-client.ts` — Singleton worker client pair for depth inference. Transfers pixel data via `postMessage` with `Transferable` buffers.
- `post-process.worker.ts` + `post-process-client.ts` — Cancellable worker for depth post-processing. Supports task cancellation for responsive UI when user adjusts sliders.
- `messages.ts` — Typed message interfaces for both workers. All worker communication is defined here.

**`src/lib/renderer/`** — Three.js scene setup
- `scene-manager.ts` — Creates scene, camera, lighting, displaced mesh. `fitCameraToImage()` sizes the camera to fill viewport without upscaling beyond native resolution.
- `mesh-builder.ts` — Builds a subdivided `PlaneGeometry` with `displacementMap` from the depth canvas. Mesh is normalized to max 2 scene units.
- `texture-utils.ts` — Canvas/image to Three.js texture helpers.

**`src/lib/modes/`** — Viewing mode strategy pattern
- Each mode implements `ViewingMode` interface (`activate`, `deactivate`, `updateConfig`).
- `parallax-mode.ts` — Mouse/touch/gyroscope tracking with lerp smoothing. Optional auto-wiggle animation.
- `stereo-mode.ts` — Side-by-side rendering via viewport scissor. Supports parallel and cross-eye viewing.
- `webxr-mode.ts` — VR headset mode using Three.js WebXR with `VRButton`. Positions mesh at eye height.
- `index.ts` — Mode registry (singleton `Map`), accessed by `getMode(id)`.

**`src/lib/stores/app-state.svelte.ts`** — Single `$state` object for all app state (stage, depth data, viewing parameters). Not a Svelte store — uses Svelte 5 runes.

**`src/lib/components/`** — Svelte UI components
- `ViewerShell.svelte` — Mounts Three.js scene, manages mode lifecycle and resize. Exposes `handleModeChange`, `handleConfigChange`, `handleDepthUpdate` methods.
- `ControlPanel.svelte` — Settings UI for all viewing modes and post-processing.
- `ImageUploader.svelte` — Drag/drop + file picker.
- `ProcessingOverlay.svelte` — Progress bar during depth estimation.

### Design Decisions

- **Raw Three.js over Threlte** — Full control over render loop (critical for WebXR `setAnimationLoop`) and viewport/scissor for stereo mode.
- **Mesh displacement over shader UV displacement** — True 3D geometry works across all viewing modes. Same mesh, different camera positions.
- **Depth map as Float32Array** — Raw depth stored for lossless reprocessing when user changes post-processing settings. Converted to canvas only for Three.js texture upload.
- **Svelte $state proxy caution** — `PostProcessClient` uses `JSON.parse(JSON.stringify(options))` to unwrap Svelte 5 `$state` proxies before `postMessage` (proxies can't be cloned).

## Docs

`docs/` contains research notes on depth estimation models, rendering approaches, viewing modes, and a comprehensive ideas/next-steps list. Read `docs/ideas-next-steps.md` for planned features.
