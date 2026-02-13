# References and Resources

## Depth Estimation Models

| Resource | Description | Link |
|----------|-------------|------|
| Depth Anything V2 | State-of-the-art monocular depth (NeurIPS 2024) | [GitHub](https://github.com/DepthAnything/Depth-Anything-V2) |
| Depth Anything V2 ONNX | Browser-ready ONNX models | [HuggingFace](https://huggingface.co/onnx-community/depth-anything-v2-small) |
| Depth Anything 3 | Latest generation, mono + multi-view | [GitHub](https://github.com/ByteDance-Seed/Depth-Anything-3) |
| Depth Pro (Apple) | Best boundary accuracy, metric depth | [GitHub](https://github.com/apple/ml-depth-pro) |
| MiDaS v3.1 | Robust depth estimation, many variants | [GitHub](https://github.com/isl-org/MiDaS) |
| Marigold | Diffusion-based, excellent edges (CVPR 2024) | [GitHub](https://github.com/prs-eth/Marigold) |
| ZoeDepth | Metric depth with adaptive binning | [GitHub](https://github.com/isl-org/ZoeDepth) |

## Browser ML Frameworks

| Resource | Description | Link |
|----------|-------------|------|
| Transformers.js | HuggingFace models in the browser (ONNX) | [GitHub](https://github.com/huggingface/transformers.js) |
| Transformers.js WebGPU Guide | How to enable WebGPU acceleration | [Docs](https://huggingface.co/docs/transformers.js/guides/webgpu) |
| DepthAnything-on-Browser | Complete browser depth + 3D viewer | [GitHub](https://github.com/akbartus/DepthAnything-on-Browser) |
| MiDaS TF.js Demo | Browser depth with TensorFlow.js | [GitHub](https://github.com/timmh/monocular_depth_estimation_demo) |

## 3D Photo / Stereo Conversion

| Resource | Description | Link |
|----------|-------------|------|
| 3D Photo Inpainting | CVPR 2020, LDI + neural inpainting | [GitHub](https://github.com/vt-vl-lab/3d-photo-inpainting) |
| nunif/iw3 | Complete 2D-to-SBS converter with multiple depth models | [GitHub](https://github.com/nagadomi/nunif/blob/master/iw3/README.md) |
| 2D-to-Stereoscopic | Modified 3D Photo Inpainting for SBS output | [GitHub](https://github.com/Genji-MS/2D-to-Stereoscopic) |
| Google Cinematic Photos | No-inpainting approach, optimized camera paths | [Blog](https://research.google/blog/the-technology-behind-cinematic-photos/) |
| SHARP (Apple, 2025) | 3D Gaussian Splatting from single image in <1s | [Article](https://9to5mac.com/2025/12/17/apple-sharp-ai-model-turns-2d-photos-into-3d-views/) |

## Browser 3D Photo Effects

| Resource | Description | Link |
|----------|-------------|------|
| Codrops Fake 3D Tutorial | WebGL shader displacement from depth map | [Tutorial](https://tympanus.net/codrops/2019/02/20/how-to-create-a-fake-3d-image-effect-with-webgl/) |
| Facebook 3D Photos Analysis | How FB parallax shader works | [Blog](https://www.alanzucconi.com/2019/01/01/facebook-3d-photos/) |
| DepthFlow | GLSL shader 3D photo effect, video output | [GitHub](https://github.com/BrokenSource/DepthFlow) |
| Depthy | Web-based depth photo viewer | [GitHub](https://github.com/panrafal/depthy) |
| depthmap-viewer-three | Three.js displacement mesh viewer | [GitHub](https://github.com/thygate/depthmap-viewer-three) |
| Three.js Displacement Tutorial | Step-by-step displacement maps | [Tutorial](https://sbcode.net/threejs/displacmentmap/) |
| Fake 3D Shader Gist | Minimal WebGL depth parallax | [Gist](https://gist.github.com/bozzin/5895d97130e148e66b88ff4c92535b59) |

## WebXR / VR

| Resource | Description | Link |
|----------|-------------|------|
| Three.js WebXR Panorama Depth | Official example: displacement mesh in VR | [GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webxr_vr_panorama_depth.html) |
| Meta WebXR First Steps | Getting started with WebXR on Quest | [GitHub](https://github.com/meta-quest/webxr-first-steps) |
| WebXR Device API | W3C spec | [Spec](https://www.w3.org/TR/webxr/) |
| Immersive Web Emulator | Chrome extension for testing WebXR on desktop | [Chrome Web Store](https://chromewebstore.google.com/detail/immersive-web-emulator) |

## Stereoscopic / DIBR

| Resource | Description | Link |
|----------|-------------|------|
| DIBR Explanation | Depth Image Based Rendering theory | [Article](https://noidh.github.io/pages/notes/ip/dibr/dibr.html) |
| Stereo and Disparity | Math behind stereo vision | [Article](https://johnwlambert.github.io/stereo/) |
| Filling Disoccluded Areas | Academic survey of hole-filling methods | [Paper](https://www.researchgate.net/publication/228658811) |

## Meta / Instagram 3D

| Resource | Description | Link |
|----------|-------------|------|
| Instagram 3D Photos on Quest | Meta blog post on the feature | [Blog](https://www.meta.com/blog/instagram-3d-photos-spatial-medianavigator-meta-quest-test/) |
| Quest 3D Video Conversion | UploadVR coverage of video-to-3D | [Article](https://www.uploadvr.com/quest-instagram-app-now-ai-converts-videos-to-3d-too/) |

## Commercial Tools (Reference)

| Tool | Description | Link |
|------|-------------|------|
| Immersity AI (LeiaPix) | Polished 2D-to-3D converter with API | [Website](https://immersity.ai/) |
| ScopeVR | Quest app for 2D-to-3D on device | [Meta Store](https://www.meta.com/experiences/scopevr-convert-2d-to-3d-spatial-ai/6767319019991390/) |
