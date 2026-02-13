# Depth Estimation Research

## Model Landscape

| Model | Params | Speed | Quality | Metric? | Browser-Ready? |
|-------|--------|-------|---------|---------|----------------|
| **Depth Anything V2** | 24.8M-1.3B | Fast | Excellent | Relative + Metric variants | Yes (ONNX, Transformers.js) |
| **Depth Anything V1** | 24.8M-335M | Fast | Very Good | Relative | Yes (ONNX) |
| **MiDaS v3.1** | Various | Fast-Moderate | Good | Relative only | Yes (TF.js) |
| **Depth Pro (Apple)** | Large | 0.3s on GPU | Best boundaries | Yes (metric) | No (Python/GPU) |
| **Depth Anything 3** | Large | Moderate | State-of-art | Yes | No (Python/GPU) |
| **ZoeDepth** | MiDaS-based | Moderate | Good | Yes | Partial |
| **Marigold** | 948M (diffusion) | Slow (5.2s) | Excellent edges | Relative | No |

## Chosen: Depth Anything V2 Small (Browser)

- **Model**: `onnx-community/depth-anything-v2-small` on Hugging Face
- **Size**: ~26MB (quantized), ~97MB (base)
- **Architecture**: DINOv2 + DPT
- **Published**: NeurIPS 2024
- **Input**: Images resized so shorter side = 518px
- **Output**: Relative depth map (higher value = farther), same resolution as processed input

### Browser Integration via Transformers.js

```javascript
import { pipeline } from '@huggingface/transformers';

const depthEstimator = await pipeline(
  'depth-estimation',
  'onnx-community/depth-anything-v2-small',
  { device: navigator.gpu ? 'webgpu' : undefined }
);
const result = await depthEstimator(imageUrl);
// result.depth is a RawImage with depth values
```

### Compute Backends

| Backend | Default? | Speed | Browser Support |
|---------|----------|-------|-----------------|
| **WASM** (CPU) | Yes | Baseline | ~100% |
| **WebGPU** (GPU) | Opt-in | Up to ~100x faster | ~70%+ (Chrome 113+, Firefox 141+, Safari macOS Tahoe) |

WebGPU is enabled with `{ device: 'webgpu' }`. Auto-detection: `navigator.gpu ? 'webgpu' : undefined`.

Meta Quest Browser supports WebGPU for compute, but WebXR+WebGPU bindings are not yet available (WebGL is used for rendering anyway).

### Depth Map Characteristics

- Output is relative depth (not metric/absolute)
- Needs normalization to [0,1] range
- Common artifacts: edge bleeding, flat region noise, missing fine detail (hair, fences)
- Recommended post-processing: light bilateral filter for edge-preserving smoothing
- Depth map resolution doesn't need to match source image — GPU interpolates via UV mapping

## Alternative: Python Backend (Future)

For higher quality, a Python FastAPI service could run:
- **Depth Anything V2 Large/Giant** (335M-1.3B params) with GPU
- **Depth Pro** (Apple) for best boundary accuracy
- **Depth Anything 3** for state-of-the-art results

## References

- [Depth Anything V2 GitHub](https://github.com/DepthAnything/Depth-Anything-V2)
- [ONNX models on HuggingFace](https://huggingface.co/onnx-community/depth-anything-v2-small)
- [Transformers.js docs](https://huggingface.co/docs/transformers.js/guides/webgpu)
- [DepthAnything-on-Browser](https://github.com/akbartus/DepthAnything-on-Browser)
- [Depth Pro (Apple)](https://github.com/apple/ml-depth-pro)
- [Depth Anything 3](https://github.com/ByteDance-Seed/Depth-Anything-3)
