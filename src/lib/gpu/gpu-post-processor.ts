import * as THREE from 'three';
import type { PostProcessOptions } from '$lib/depth/post-process';

import fullscreenVert from './shaders/fullscreen.vert?raw';
import invertContrastFrag from './shaders/invert-contrast.frag?raw';
import gaussianBlurFrag from './shaders/gaussian-blur.frag?raw';
import bilateralFrag from './shaders/bilateral.frag?raw';

export class GPUPostProcessor {
	private renderer: THREE.WebGLRenderer;
	private scene: THREE.Scene;
	private camera: THREE.OrthographicCamera;
	private quad: THREE.Mesh;
	private rtA: THREE.WebGLRenderTarget;
	private rtB: THREE.WebGLRenderTarget;
	private invertContrastMat: THREE.ShaderMaterial;
	private gaussianBlurMat: THREE.ShaderMaterial;
	private bilateralMat: THREE.ShaderMaterial;
	private depthTexture: THREE.DataTexture | null = null;
	private currentWidth = 0;
	private currentHeight = 0;

	constructor() {
		const canvas = document.createElement('canvas');
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: false,
			depth: false,
			stencil: false
		});
		this.renderer.toneMapping = THREE.NoToneMapping;
		this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

		this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
		this.scene = new THREE.Scene();

		const geo = new THREE.PlaneGeometry(2, 2);
		this.quad = new THREE.Mesh(geo);
		this.scene.add(this.quad);

		this.rtA = new THREE.WebGLRenderTarget(1, 1, {
			type: THREE.UnsignedByteType,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter
		});
		this.rtB = new THREE.WebGLRenderTarget(1, 1, {
			type: THREE.UnsignedByteType,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter
		});

		this.invertContrastMat = new THREE.ShaderMaterial({
			vertexShader: fullscreenVert,
			fragmentShader: invertContrastFrag,
			uniforms: {
				tDepth: { value: null },
				uInvert: { value: false },
				uContrast: { value: 1.0 },
				uBrightness: { value: 0.0 }
			}
		});

		this.gaussianBlurMat = new THREE.ShaderMaterial({
			vertexShader: fullscreenVert,
			fragmentShader: gaussianBlurFrag,
			uniforms: {
				tDepth: { value: null },
				uDirection: { value: new THREE.Vector2() },
				uSigma: { value: 0 }
			}
		});

		this.bilateralMat = new THREE.ShaderMaterial({
			vertexShader: fullscreenVert,
			fragmentShader: bilateralFrag,
			uniforms: {
				tDepth: { value: null },
				uSpatialSigma: { value: 3.0 },
				uRangeSigma: { value: 0.1 },
				uTexelSize: { value: new THREE.Vector2() }
			}
		});
	}

	process(
		depthData: Float32Array,
		width: number,
		height: number,
		options: PostProcessOptions
	): HTMLCanvasElement {
		this.ensureSize(width, height);
		this.uploadDepthTexture(depthData, width, height);

		// Pass 1: Invert + Contrast + Brightness → rtA
		this.invertContrastMat.uniforms.tDepth.value = this.depthTexture;
		this.invertContrastMat.uniforms.uInvert.value = options.invert;
		this.invertContrastMat.uniforms.uContrast.value = options.contrast;
		this.invertContrastMat.uniforms.uBrightness.value = options.brightness;
		this.renderPass(this.invertContrastMat, this.rtA);

		let readTarget = this.rtA;
		let writeTarget = this.rtB;

		// Pass 2-3: Gaussian blur (horizontal + vertical) if sigma > 0
		if (options.gaussianSigma > 0) {
			// Horizontal
			this.gaussianBlurMat.uniforms.tDepth.value = readTarget.texture;
			this.gaussianBlurMat.uniforms.uDirection.value.set(1.0 / width, 0);
			this.gaussianBlurMat.uniforms.uSigma.value = options.gaussianSigma;
			this.renderPass(this.gaussianBlurMat, writeTarget);
			[readTarget, writeTarget] = [writeTarget, readTarget];

			// Vertical
			this.gaussianBlurMat.uniforms.tDepth.value = readTarget.texture;
			this.gaussianBlurMat.uniforms.uDirection.value.set(0, 1.0 / height);
			this.renderPass(this.gaussianBlurMat, writeTarget);
			[readTarget, writeTarget] = [writeTarget, readTarget];
		}

		// Pass 4..N: Bilateral filter iterations (ping-pong)
		if (options.bilateralIterations > 0) {
			this.bilateralMat.uniforms.uSpatialSigma.value = options.bilateralSpatialSigma;
			this.bilateralMat.uniforms.uRangeSigma.value = options.bilateralRangeSigma;
			this.bilateralMat.uniforms.uTexelSize.value.set(1.0 / width, 1.0 / height);

			for (let i = 0; i < options.bilateralIterations; i++) {
				this.bilateralMat.uniforms.tDepth.value = readTarget.texture;
				this.renderPass(this.bilateralMat, writeTarget);
				[readTarget, writeTarget] = [writeTarget, readTarget];
			}
		}

		return this.readToCanvas(readTarget, width, height);
	}

	private ensureSize(width: number, height: number) {
		if (this.currentWidth !== width || this.currentHeight !== height) {
			this.rtA.setSize(width, height);
			this.rtB.setSize(width, height);
			this.renderer.setSize(width, height, false);
			this.currentWidth = width;
			this.currentHeight = height;
		}
	}

	private uploadDepthTexture(depthData: Float32Array, width: number, height: number) {
		const data = new Uint8Array(width * height * 4);
		for (let i = 0; i < depthData.length; i++) {
			const v = Math.round(Math.max(0, Math.min(1, depthData[i])) * 255);
			data[i * 4] = v;
			data[i * 4 + 1] = v;
			data[i * 4 + 2] = v;
			data[i * 4 + 3] = 255;
		}

		if (this.depthTexture) {
			this.depthTexture.dispose();
		}

		this.depthTexture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
		this.depthTexture.minFilter = THREE.NearestFilter;
		this.depthTexture.magFilter = THREE.NearestFilter;
		this.depthTexture.needsUpdate = true;
	}

	private renderPass(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget) {
		this.quad.material = material;
		this.renderer.setRenderTarget(target);
		this.renderer.render(this.scene, this.camera);
	}

	private readToCanvas(
		target: THREE.WebGLRenderTarget,
		width: number,
		height: number
	): HTMLCanvasElement {
		const buffer = new Uint8Array(width * height * 4);
		this.renderer.readRenderTargetPixels(target, 0, 0, width, height, buffer);
		this.renderer.setRenderTarget(null);

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d')!;
		const imgData = ctx.createImageData(width, height);

		// readRenderTargetPixels returns rows bottom-to-top (OpenGL convention).
		// DataTexture with flipY=false stores row 0 at the bottom, so the two
		// flips cancel and we can copy straight through.
		imgData.data.set(buffer);

		ctx.putImageData(imgData, 0, 0);
		return canvas;
	}

	dispose() {
		this.rtA.dispose();
		this.rtB.dispose();
		this.depthTexture?.dispose();
		this.invertContrastMat.dispose();
		this.gaussianBlurMat.dispose();
		this.bilateralMat.dispose();
		this.renderer.dispose();
	}
}

let singleton: GPUPostProcessor | null = null;

export function getGPUPostProcessor(): GPUPostProcessor {
	if (!singleton) {
		singleton = new GPUPostProcessor();
	}
	return singleton;
}
