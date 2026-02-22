# Production Readiness TODO

## Task List (sorted by priority)

- [x] **1. Error handling: Add error recovery UI in +page.svelte** — Retry button, reset to upload on failure
- [x] **2. Error handling: Worker timeout wrappers** — 30s timeout on all worker communication to prevent hanging promises
- [x] **3. Error handling: Worker auto-reinitialize on crash** — Detect worker death and recreate singleton
- [x] **4. Error handling: Input validation** — File type, dimension limits, memory pre-check in ImageUploader
- [x] **5. Error handling: WebGL context loss recovery** — Handle context lost/restored events on Three.js renderer
- [x] **6. Error handling: Safe mode switching** — Try/catch around mode activation with fallback
- [x] **7. Memory: Full recursive Three.js scene disposal** — Dispose all geometries, materials, textures
- [x] **8. Memory: Canvas element cleanup** — Reuse/cleanup canvases created in +page.svelte
- [x] **9. Memory: GPU post-processor dispose on cleanup** — Call dispose on beforeunload + when resetting
- [x] **10. Memory: Cache processed depth data** — Avoid re-allocating Float32Array on every call
- [x] **11. Performance: Debounce ResizeObserver** — 100-150ms debounce in ViewerShell
- [x] **12. Performance: Dirty flag for parallax rendering** — Only render when camera position changes
- [x] **13. Performance: Reuse DataTexture in GPU post-processor** — Don't recreate when dimensions match
- [x] **14. Testing: Install Vitest and configure** — Add test framework, scripts, config
- [x] **15. Testing: Unit tests for post-process.ts** — Pure math functions are ideal test candidates
- [x] **16. Testing: Unit tests for auto-params.ts** — analyzeDepth, detectInversion, estimateNoise
- [x] **17. Testing: Unit tests for edge-detection.ts** — Sobel edge detection
- [x] **18. Type safety: Narrow ViewingModeConfig** — Discriminated union per mode instead of [key: string]: unknown
- [x] **19. Type safety: Replace non-null assertions** — Explicit null checks + error throws for getContext('2d')!
- [x] **20. Accessibility: ARIA labels on interactive elements** — Collapsible buttons, icon buttons, mode tabs
- [x] **21. Accessibility: Focus trap + Escape for mobile modal** — Mobile slide-up panel
- [x] **22. Accessibility: Processing overlay as live region** — role="status" aria-live="polite"
- [x] **23. Accessibility: prefers-reduced-motion** — Disable auto-wiggle, reduce animations
- [x] **24. Accessibility: Touch target sizing** — Increase to 44x44px minimum
- [x] **26. SEO: Meta tags** — Description, OG tags, theme-color, viewport-fit
- [x] **27. Edge cases: Guard 0-dimension containers** — Prevent NaN in camera calculations
- [x] **28. Edge cases: Validate mesh subdivision > 0** — mesh-builder guard
- [x] **29. Edge cases: Prevent double-activate in parallax** — Multiple rAF loop prevention

---

## Detailed Task Descriptions

### 1. Error handling: Add error recovery UI in +page.svelte
**File:** `src/routes/+page.svelte`

Currently, the catch block at line 243-246 logs the error and updates `processingMessage` but leaves the user stuck in `processing` stage with no way to retry or go back.

**Changes needed:**
- Add `error` field to appState to track error state
- Show a retry button and "Upload different image" button when error occurs
- In ProcessingOverlay, show error state with action buttons
- Clear error state on retry

### 2. Error handling: Worker timeout wrappers
**Files:** `src/lib/workers/depth-estimation-client.ts`, `src/lib/workers/inpainting-client.ts`

Worker promises can hang indefinitely if the worker crashes mid-operation. Add a configurable timeout wrapper (30s default for inference, 60s for model loading) that rejects the promise on timeout.

**Changes needed:**
- Create a `withTimeout<T>(promise, ms, message)` utility
- Wrap `initialize()` and `estimate()` in depth-estimation-client.ts
- Wrap `runTelea()`, `loadMigan()`, `runMigan()` in inpainting-client.ts

### 3. Error handling: Worker auto-reinitialize on crash
**Files:** `src/lib/workers/depth-estimation-client.ts`, `src/lib/workers/inpainting-client.ts`

If a worker dies (onerror event), the singleton doesn't reinitialize. Subsequent calls silently fail or hang.

**Changes needed:**
- Add `onerror` handler to workers that rejects pending promises and marks as unready
- Reset singleton to null on crash so next `get*Client()` call creates fresh instance
- Add `worker.onerror` in constructor

### 4. Error handling: Input validation
**File:** `src/lib/components/ImageUploader.svelte`, `src/routes/+page.svelte`

Zero-dimension images, oversized files (8K+), or unsupported formats can crash the pipeline.

**Changes needed:**
- Validate file size (e.g., max 50MB)
- After Image loads, validate dimensions (min 10x10, max 8192x8192)
- Show user-friendly error messages
- Estimate memory requirement based on dimensions

### 5. Error handling: WebGL context loss recovery
**File:** `src/lib/renderer/scene-manager.ts`, `src/lib/components/ViewerShell.svelte`

WebGL context loss is not handled — renderer becomes unusable.

**Changes needed:**
- Listen for `webglcontextlost` and `webglcontextrestored` events on the renderer's canvas
- On context lost, pause rendering and show overlay message
- On context restored, recreate scene and resume

### 6. Error handling: Safe mode switching
**File:** `src/lib/components/ViewerShell.svelte`

If mode activation fails after deactivation, no mode is active but UI shows one.

**Changes needed:**
- Wrap `activateMode()` in try/catch
- On failure, try to reactivate previous mode
- If that also fails, fall back to parallax mode

### 7. Memory: Full recursive Three.js scene disposal
**File:** `src/lib/renderer/scene-manager.ts`

`disposeSceneContext()` disposes `map` and `displacementMap` but not all textures. No recursive scene traversal.

**Changes needed:**
- Add `disposeObject3D(obj)` recursive helper that traverses the scene graph
- Dispose all geometries, materials (including all texture properties), and textures

### 8. Memory: Canvas element cleanup
**File:** `src/routes/+page.svelte`

Canvases created via `document.createElement('canvas')` at lines 63, 138, 181 are never explicitly cleaned up.

**Changes needed:**
- Set canvas width/height to 0 when no longer needed (frees GPU backing)
- Null references in resetState()
- Clean up inpainting result canvas on re-upload

### 9. Memory: GPU post-processor dispose on cleanup
**File:** `src/lib/gpu/gpu-post-processor.ts`, `src/routes/+page.svelte`

The GPU post-processor singleton has a `dispose()` method but it's never called.

**Changes needed:**
- Call `dispose()` in resetState() when user uploads new image
- Add `beforeunload` listener to dispose on page close
- Reset singleton reference after dispose

### 10. Memory: Cache processed depth data
**File:** `src/routes/+page.svelte`

`getProcessedDepthData()` allocates a new Float32Array every call (~16MB for 4K). Called multiple times during mesh rebuilds.

**Changes needed:**
- Cache the result and invalidate only when depthCanvas changes
- Store in a module-level variable, clear on new upload

### 11. Performance: Debounce ResizeObserver
**File:** `src/lib/components/ViewerShell.svelte`

ResizeObserver fires dozens of times during window drag with no debounce.

**Changes needed:**
- Wrap the resize callback in a debounce (100-150ms)
- Use `requestAnimationFrame` or `setTimeout` for debouncing

### 12. Performance: Dirty flag for parallax rendering
**File:** `src/lib/modes/parallax-mode.ts`

Currently renders every frame via rAF even when camera hasn't moved and auto-wiggle is off.

**Changes needed:**
- Track previous camera position
- Only call `renderer.render()` if position has changed beyond a small epsilon
- Always render when auto-wiggle is active

### 13. Performance: Reuse DataTexture in GPU post-processor
**File:** `src/lib/gpu/gpu-post-processor.ts`

`uploadDepthTexture()` creates and disposes a new DataTexture on every call.

**Changes needed:**
- If dimensions match, reuse existing texture and just update `.image.data`
- Only create new texture when dimensions change

### 14. Testing: Install Vitest and configure
**Files:** `package.json`, new `vitest.config.ts`

No test framework exists.

**Changes needed:**
- Install vitest as dev dependency
- Create vitest.config.ts
- Add `test` and `test:watch` scripts to package.json

### 15. Testing: Unit tests for post-process.ts
**File:** new `src/lib/depth/post-process.test.ts`

Pure math functions on Float32Array — ideal for unit tests.

**Test cases:**
- postProcessDepthData with invert=true flips values
- Contrast adjustment stretches range
- Brightness shifts values
- Gaussian blur reduces high-frequency variation
- Bilateral filter preserves edges while smoothing flat areas
- depthDataToCanvas/extractDepthFromCanvas roundtrip

### 16. Testing: Unit tests for auto-params.ts
**File:** new `src/lib/depth/auto-params.test.ts`

**Test cases:**
- Flat depth map → minimal processing suggested
- High-noise depth map → more smoothing suggested
- Center-bright depth map → no inversion
- Edge-bright depth map → inversion suggested
- Narrow histogram → high contrast suggested

### 17. Testing: Unit tests for edge-detection.ts
**File:** new `src/lib/inpainting/edge-detection.test.ts`

**Test cases:**
- Flat depth map → no edges detected
- Sharp depth step → edge detected at boundary
- Threshold sensitivity
- Border pixel handling

### 18. Type safety: Narrow ViewingModeConfig
**File:** `src/lib/modes/types.ts`

`[key: string]: unknown` allows arbitrary keys — typos silently ignored.

**Changes needed:**
- Define specific config interfaces per mode (ParallaxConfig, StereoConfig, WebXRConfig)
- Use discriminated union or intersection type for ViewingModeConfig
- Update activate() signatures in each mode

### 19. Type safety: Replace non-null assertions
**Files:** Multiple files with `!` assertions on `getContext('2d')`.

**Changes needed:**
- Replace `ctx.getContext('2d')!` with explicit null check + throw
- Apply in: post-process.ts, +page.svelte, depth-estimation-client.ts, gpu-post-processor.ts

### 20. Accessibility: ARIA labels on interactive elements
**File:** `src/lib/components/ControlPanel.svelte`

No ARIA labels on collapsible buttons, icon buttons, mode tabs.

**Changes needed:**
- `aria-expanded` + `aria-controls` on collapsible section buttons
- `aria-label` on all icon-only buttons (fullscreen, settings, close)
- `role="tablist"` + `role="tab"` + `aria-selected` on mode buttons

### 21. Accessibility: Focus trap + Escape for mobile modal
**File:** `src/routes/+page.svelte`

Mobile slide-up modal has no focus trap or Escape-to-close.

**Changes needed:**
- Add keydown handler for Escape to close modal
- Trap focus within the modal when open
- Return focus to trigger button on close

### 22. Accessibility: Processing overlay as live region
**File:** `src/lib/components/ProcessingOverlay.svelte`

Progress not announced to screen readers.

**Changes needed:**
- Add `role="status"` and `aria-live="polite"` to the overlay container
- Add `aria-label` describing the current progress

### 23. Accessibility: prefers-reduced-motion
**Files:** `src/lib/modes/parallax-mode.ts`, `src/routes/+page.svelte`

No respect for `prefers-reduced-motion`.

**Changes needed:**
- Check `matchMedia('(prefers-reduced-motion: reduce)')`
- Disable auto-wiggle animation when reduced motion preferred
- Reduce or disable slide-up animation

### 24. Accessibility: Touch target sizing
**File:** `src/routes/+page.svelte`

Desktop buttons are 40x40px (w-10 h-10), below 44x44px minimum.

**Changes needed:**
- Increase to w-11 h-11 (44px) for desktop buttons
- Mobile buttons already 48px (w-12 h-12) — OK

### 26. SEO: Meta tags
**File:** `src/app.html`

Only `<title>` exists.

**Changes needed:**
- `<meta name="description" content="...">`
- `<meta name="theme-color" content="#11111b">`
- `<meta name="color-scheme" content="dark">`
- Open Graph tags (og:title, og:description, og:type)
- `viewport-fit=cover` for notched devices

### 27. Edge cases: Guard 0-dimension containers
**File:** `src/lib/renderer/scene-manager.ts`

`container.clientWidth` or `clientHeight` of 0 causes NaN in camera aspect and division by zero in `fitCameraToImage`.

**Changes needed:**
- Guard `handleResize()` and `fitCameraToImage()` against 0-dimension containers
- Use `Math.max(1, ...)` for aspect ratio divisors

### 28. Edge cases: Validate mesh subdivision > 0
**File:** `src/lib/renderer/mesh-builder.ts`

No guard against 0 subdivisions.

**Changes needed:**
- Clamp subdivisions to minimum of 1 in buildDisplacedMesh

### 29. Edge cases: Prevent double-activate in parallax
**File:** `src/lib/modes/parallax-mode.ts`

If `activate()` is called without `deactivate()`, multiple rAF loops stack up.

**Changes needed:**
- Cancel existing animation frame at start of activate()
- Remove existing event listeners before adding new ones
