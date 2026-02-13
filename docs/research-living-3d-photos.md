# Research: Living 3D Photos — Video + Depth from a Single Image

## The Vision

Take a single 2D photo → generate subtle natural motion (wind, water, breathing) → add depth for stereoscopic 3D → produce a "living 3D photo" viewable in parallax, stereo, or VR.

This combines two independent capabilities:
1. **Image-to-video generation** — synthesizing realistic motion from a still image
2. **Video depth estimation** — getting temporally consistent depth maps for every frame

---

## Part 1: Image-to-Video Generation

### Open-Source Models (Self-Hosted)

| Model | Params | Min VRAM | Quality | Motion Type | License |
|-------|--------|----------|---------|-------------|---------|
| **Wan 2.2** (Alibaba) | 1.3B / 14B | 8 GB / 24 GB | Best open-source | Camera + subject | Apache 2.0 |
| **LTX-2** (Lightricks) | — | 8 GB (FP8) | Very good, native audio | Camera + subject | Open source |
| **Stable Video Diffusion** | — | 16 GB (8 GB w/ offload) | Good, older | Mostly camera | Stability license |
| **CogVideoX** | 2B / 5B | GTX 1080 Ti / RTX 3060 | Decent | Camera + subject | Open source |

**Wan 2.2 is the clear leader** for subtle, realistic motion. Reviewers note it handles "naturally rendering subtle actions like smiling and blinking" and "realistic wind effects" with high fidelity. The 14B model is significantly better than 1.3B for subtle effects.

### Commercial Services

| Service | Standout Feature | Relevance to "Living Photos" |
|---------|-----------------|------------------------------|
| **Runway Gen-4.5** | Motion Brush — paint 5 independent motion zones | Best for cinemagraph-style control (animate water, keep buildings still) |
| **Kling 2.6** | Best temporal coherence, no AI jitter | Best for subtle natural motion (hair, clothing physics) |
| **Pika 2.5** | Great with "subtle"/"gentle" prompts | Good for micro-movements, product shots |
| **Google Veo 3.1** | Native 4K, 60s+ | Overkill for short clips but highest fidelity |
| **Luma Dream Machine** | Smooth dolly/push-in camera moves | Best for pure camera motion (cinematic push-ins) |

### What Kind of Motion Do They Produce?

- **Camera motion only** (parallax/dolly/pan): Google Cinematic Photos, DepthFlow, Luma
- **Subject motion only** (wind, water, hair): Runway Motion Brush, Pika with "subtle" prompts
- **Both camera + subject**: Wan 2.2, Kling 2.6, Runway Gen-4.5, Sora 2

For "living photos", you typically want **subtle subject motion** with minimal or no camera motion, since the 3D depth effect already provides the parallax.

---

## Part 2: Video Depth Estimation

### The Temporal Consistency Problem

Running Depth Anything V2 frame-by-frame on a video produces visible flickering — each frame resolves depth ambiguity independently, causing shimmering, scale drift, and swimming edges. This is immediately noticeable and makes the output unusable for 3D video.

### Purpose-Built Video Depth Models

| Model | Architecture | Speed (per frame) | Temporal Consistency | GPU Memory |
|-------|-------------|-------------------|---------------------|------------|
| **Video Depth Anything** | DA2 + temporal attention head | 67ms (A100) | Best overall | ~24 GB (Large) |
| **FlashDepth** | DA2-Small + DA2-Large + Mamba 2 | 24 FPS at 2K | Very good | — |
| **DepthCrafter** (Tencent) | Video diffusion conditioned on RGB | 910ms | Excellent | High |
| **ChronoDepth** | Fine-tuned SVD | 840ms | Very good | High |
| **NVDS+** | Post-hoc stabilizer (any model input) | Moderate | Good | Moderate |

**Video Depth Anything** (CVPR 2025 Highlight) is the best overall — 13x faster than DepthCrafter with better accuracy. Processes 32-frame segments with 8-frame overlap for arbitrarily long videos. Three sizes: Small (28.4M, 7.5ms), Base (113.1M), Large (381.8M, 14ms).

### Temporal Smoothing Approaches (For Per-Frame Models)

If constrained to DA2-Small (e.g., browser), these help:

1. **EMA filtering**: `depth[t] = α * depth[t] + (1-α) * depth[t-1]`, α≈0.4-0.5 with delta threshold for edge reset. Trivial but causes ghosting.
2. **Optical-flow-guided EMA**: Warp previous smoothed depth using flow before blending. Much less ghosting.
3. **Global scale-shift alignment**: Fit scale/shift to a reference frame via least-squares. Critical pre-step.
4. **NVDS+**: Learned stabilization network, plug-and-play on any per-frame model output.

### Browser Feasibility

- **DA2-Small per-frame**: Yes, works today via ONNX/WebGPU (~5-15 FPS at 518px)
- **Video Depth Anything / DepthCrafter / FlashDepth**: No — too large, too much VRAM
- **Practical browser strategy**: DA2-Small per-frame + JS-based EMA with scale-shift alignment. Won't match server models but "good enough" for parallax

---

## Part 3: Combining Video Generation + Depth for 3D

### The Full Pipeline

```
Still Photo
    │
    ▼
┌─────────────────────────┐
│ Image-to-Video Model    │  Wan 2.2, SVD, Kling, etc.
│ (generate 2-8s motion)  │  → short video with subtle motion
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ Video Depth Estimation  │  Video Depth Anything or DepthCrafter
│ (per-frame depth maps)  │  → temporally consistent depth sequence
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ Stereo Conversion       │  StereoCrafter, nunif/iw3, or custom
│ (depth-based warping)   │  → side-by-side 3D video
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ Encode / Render         │  MV-HEVC (Apple), SBS (VR), WebXR
│ (target format)         │
└─────────────────────────┘
```

### Key Open-Source Tools for This Pipeline

**StereoCrafter** (Tencent ARC) — Most complete mono-to-stereo video converter:
1. Depth estimation on input video
2. Depth-based forward warping (left→right view) + occlusion mask
3. Fine-tuned SVD model inpaints the disoccluded regions
4. Overlapping segments for long videos
- GitHub: [TencentARC/StereoCrafter](https://github.com/TencentARC/StereoCrafter)

**nunif/iw3** — Practical 2D→SBS converter:
- Supports DA2, Depth Pro, Video Depth Anything as depth backends
- Uses trained ML model for warping (smoother than projective math)
- Real-time desktop streaming mode
- GitHub: [nagadomi/nunif](https://github.com/nagadomi/nunif)

**DepthFlow** — Fast parallax animation from single image + depth:
- GLSL shader, up to 8K50fps on RTX 3060
- Seamless loops with lens distortion and DoF effects
- Good for the camera-motion-only variant
- GitHub: [BrokenSource/DepthFlow](https://github.com/BrokenSource/DepthFlow)

### Google's Cinematic Photos (Reference Architecture)

Google's approach (no generative model, runs on-phone):
1. CNN estimates depth from single image
2. DeepLab segmentation refines person boundaries
3. RGB extruded onto depth map → 3D mesh
4. Virtual camera path optimized to minimize stretching artifacts
5. Rendered as short parallax animation

This produces **camera motion only** (no subject motion) but is very fast and lightweight. The same technique powers `3d-ken-burns` (open source).

### Apple's Approaches

- **SHARP** (Dec 2025, open source): Single feedforward pass → 3D Gaussian Splatting in <1 second. Predicts per-pixel depth + Gaussian parameters. Best for nearby viewpoint synthesis. [apple/ml-sharp](https://github.com/apple/ml-sharp)
- **Spatial Scenes** (iOS 26): Generative AI separates subjects/backgrounds, generates up to 256 depth layers, parallax responds to device tilt. Runs on-device.

---

## Part 4: 4D Generation (3D + Time, Frontier)

Single image → full 3D scene with motion over time. This is the bleeding edge:

| Project | Approach | Status |
|---------|----------|--------|
| **DimensionX** | Decoupled spatial/temporal LoRAs on video diffusion → 3DGS optimization | Open source, ICCV 2025 |
| **Diff4Splat** | Single forward pass → deformable 3D Gaussian field | 30 seconds per scene |
| **Lyra** (NVIDIA) | Feed-forward 3D/4D from single image, self-distillation | ICLR 2026, open source |
| **Diffusion as Shader** | 3D-aware video diffusion with point cloud conditioning | SIGGRAPH 2025, open source |
| **SplatDiff** (Disney) | Pixel-splatting-guided video diffusion for novel views | SIGGRAPH 2025 |

These are research-grade but advancing fast. DimensionX is the most accessible with full code + checkpoints.

---

## Part 5: Practical Strategies for This Project

### Strategy A: Browser-Only (Camera Motion, No Subject Motion)

What we already have, extended to short looping animations:

1. Depth Anything V2 Small in browser (already working)
2. Animate camera on a programmatic path (sine wave, figure-8, Ken Burns)
3. Record canvas as video via MediaRecorder API
4. **Pros**: Zero infrastructure, instant, runs anywhere
5. **Cons**: No subject motion — only parallax/camera movement

This is essentially what Google Cinematic Photos does, and it's already very close to what the current app produces.

### Strategy B: Server-Side Video Generation + Browser Viewing

Add a backend that generates "living" video from the uploaded photo:

1. User uploads photo → browser sends to server
2. Server runs **Wan 2.2** (1.3B or 14B) to generate 3-5s video with subtle motion
3. Server runs **Video Depth Anything** on the generated video → per-frame depth
4. Server returns video frames + depth frames to browser
5. Browser renders each frame as a displaced mesh (existing Three.js pipeline), advancing frame-by-frame synced to playback
6. All viewing modes (parallax, stereo, WebXR) work on the video

**GPU requirements**: RTX 4090 (24GB) handles both Wan 2.2 14B and Video Depth Anything Large. RTX 3060 (12GB) can run Wan 1.3B + VDA Small.

**Latency**: Wan 2.2 generation takes ~2-5 minutes for a 5s clip on RTX 4090. Video depth ~5-10s. Total ~3-6 minutes server-side processing.

### Strategy C: API-Based Video Generation + Browser Viewing

Same as B but using cloud APIs instead of self-hosted:

1. User uploads photo → server proxies to **Replicate** / **fal.ai** / **Runway API**
2. API returns generated video
3. Run Video Depth Anything server-side (or use DepthCrafter API)
4. Return to browser for 3D rendering

**Pros**: No GPU infrastructure needed. Pay-per-use.
**Cons**: Latency (API calls), cost ($0.01-0.10 per generation), dependency on external services.

### Strategy D: Hybrid — Browser Parallax + Server Motion

Best of both worlds for progressive enhancement:

1. **Immediate** (browser): Depth estimation + parallax animation (existing pipeline, <10s)
2. **Enhanced** (server, async): Generate motion video + video depth in background
3. When server result arrives, upgrade the viewer from static parallax to animated 3D video
4. User sees instant result that progressively improves

### Rendering Video Depth in the Existing Three.js Pipeline

The current app renders a single displaced mesh. For video, two approaches:

**Approach 1: Texture Animation** (simpler)
- Keep the existing displaced mesh
- Each frame, update `material.map` (color texture) and `material.displacementMap` (depth texture)
- Three.js re-displaces vertices each frame
- Need ~30 texture uploads/second — feasible with `CanvasTexture` or `DataTexture`

**Approach 2: Pre-built Geometry per Frame** (smoother but more memory)
- Pre-compute displaced geometry for each frame
- Swap geometries each frame (morph targets or geometry replacement)
- Higher memory usage but avoids per-frame texture upload

Approach 1 is much simpler and likely fast enough for 24-30fps on modern GPUs.

---

## Recommended Starting Point

For extending the current project, **Strategy D (Hybrid)** makes the most sense:

1. **Short term**: Add programmatic camera path animation (Ken Burns / figure-8) to the existing static 3D photo. Record as video via MediaRecorder. This is purely browser-side and gives "living photo" camera motion immediately.

2. **Medium term**: Add a server endpoint using Wan 2.2 (1.3B) + Video Depth Anything for generating actual motion. The `api-estimator.ts` stub is already in the codebase. Return frame sequences to the browser and animate the displaced mesh.

3. **Long term**: Explore StereoCrafter or nunif/iw3 for high-quality stereo conversion, 4D approaches like DimensionX, or Apple SHARP for instant 3DGS.

---

## Key References

### Video Depth
- [Video Depth Anything](https://github.com/DepthAnything/Video-Depth-Anything) — CVPR 2025, best video depth model
- [DepthCrafter](https://github.com/Tencent/DepthCrafter) — CVPR 2025, diffusion-based video depth
- [FlashDepth](https://github.com/Eyeline-Labs/FlashDepth) — ICCV 2025, real-time 2K streaming depth
- [ChronoDepth](https://github.com/jiahao-shao1/ChronoDepth) — CVPR 2025, SVD-based temporal depth

### Image-to-Video
- [Wan 2.2](https://github.com/Wan-Video/Wan2.2) — Best open-source image-to-video
- [LTX-2](https://github.com/Lightricks/LTX-Video) — Open source, native audio, runs on 8GB
- [CogVideoX](https://github.com/zai-org/CogVideo) — Runs on older GPUs

### Stereo / 3D Conversion
- [StereoCrafter](https://github.com/TencentARC/StereoCrafter) — Mono video → stereo 3D with inpainting
- [nunif/iw3](https://github.com/nagadomi/nunif) — Practical 2D→SBS converter
- [DepthFlow](https://github.com/BrokenSource/DepthFlow) — Fast parallax animation from depth

### Novel View / 4D
- [Apple SHARP](https://github.com/apple/ml-sharp) — Single image → 3DGS in <1s
- [DimensionX](https://github.com/wenqsun/DimensionX) — Single image → 3D/4D via LoRA video diffusion
- [SplatDiff](https://arxiv.org/abs/2502.12752) — Disney, pixel-splatting-guided novel view synthesis
- [Diffusion as Shader](https://github.com/IGL-HKUST/DiffusionAsShader) — SIGGRAPH 2025, 3D-aware video diffusion
- [Lyra](https://github.com/nv-tlabs/lyra) — NVIDIA, feed-forward 3D/4D generation

### Other
- [Google Cinematic Photos](https://research.google/blog/the-technology-behind-cinematic-photos/) — On-device parallax animation
- [3D Ken Burns](https://github.com/sniklaus/3d-ken-burns) — Open source Ken Burns effect with depth
- [NVDS+](https://github.com/RaymondWang987/NVDS) — Post-hoc depth video stabilization
- [Video Depth Estimation Rankings](https://github.com/AIVFI/Video-Depth-Estimation-Rankings-and-Stereo-Video-Conversion-Rankings)
