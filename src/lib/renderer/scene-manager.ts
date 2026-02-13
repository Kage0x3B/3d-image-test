import * as THREE from 'three';
import type { SceneContext, RendererConfig } from './types';
import { buildDisplacedMesh } from './mesh-builder';

export function createSceneContext(config: RendererConfig): SceneContext {
	const {
		container,
		photo,
		depthCanvas,
		displacementScale = 0.5,
		meshSubdivisions = 256
	} = config;

	const imageWidth = photo instanceof HTMLImageElement ? photo.naturalWidth : photo.width;
	const imageHeight = photo instanceof HTMLImageElement ? photo.naturalHeight : photo.height;

	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(container.clientWidth, container.clientHeight);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	container.appendChild(renderer.domElement);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x11111b);

	const camera = new THREE.PerspectiveCamera(
		50,
		container.clientWidth / container.clientHeight,
		0.1,
		100
	);
	camera.position.set(0, 0, 2);
	camera.lookAt(0, 0, 0);

	const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
	scene.add(ambientLight);
	const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
	directionalLight.position.set(1, 1, 2);
	scene.add(directionalLight);

	const { mesh, material } = buildDisplacedMesh({
		photo,
		depthCanvas,
		displacementScale,
		subdivisions: meshSubdivisions
	});
	scene.add(mesh);

	const ctx: SceneContext = {
		scene,
		renderer,
		camera,
		mesh,
		material,
		container,
		canvas: renderer.domElement,
		imageWidth,
		imageHeight
	};

	// Fit camera so image fills viewport without upscaling
	fitCameraToImage(ctx);

	return ctx;
}

/**
 * Adjusts camera Z so the mesh fills the viewport as large as possible
 * without exceeding the image's native pixel dimensions.
 */
export function fitCameraToImage(ctx: SceneContext, viewportWidth?: number): void {
	const { camera, mesh, container, imageWidth, imageHeight } = ctx;
	const containerW = viewportWidth ?? container.clientWidth;
	const containerH = container.clientHeight;
	const dpr = Math.min(window.devicePixelRatio, 2);

	const imageAspect = imageWidth / imageHeight;
	const viewAspect = containerW / containerH;

	// Mesh dimensions (set in mesh-builder: max dim = 2 units)
	const meshW = imageAspect >= 1 ? 2 : 2 * imageAspect;
	const meshH = imageAspect >= 1 ? 2 / imageAspect : 2;

	// Don't upscale: cap the effective display area to the image's native pixel size
	const maxDisplayW = Math.min(containerW, imageWidth / dpr);
	const maxDisplayH = Math.min(containerH, imageHeight / dpr);
	const effectiveAspect = maxDisplayW / maxDisplayH;

	camera.aspect = viewAspect;
	camera.updateProjectionMatrix();

	// Calculate distance so mesh fills the effective display area
	const fovRad = (camera.fov * Math.PI) / 180;
	let distance: number;

	if (effectiveAspect > imageAspect) {
		// Height-limited: fit mesh height to effective height
		const scale = maxDisplayH / containerH;
		distance = (meshH / 2) / Math.tan(fovRad / 2) / scale;
	} else {
		// Width-limited: fit mesh width to effective width
		const scale = maxDisplayW / containerW;
		const hFov = 2 * Math.atan(Math.tan(fovRad / 2) * viewAspect);
		distance = (meshW / 2) / Math.tan(hFov / 2) / scale;
	}

	camera.position.z = distance;
}

export function disposeSceneContext(ctx: SceneContext): void {
	ctx.renderer.setAnimationLoop(null);
	ctx.renderer.dispose();
	ctx.mesh.geometry.dispose();
	if (ctx.material.map) ctx.material.map.dispose();
	if (ctx.material.displacementMap) ctx.material.displacementMap.dispose();
	ctx.material.dispose();
	if (ctx.canvas.parentElement) {
		ctx.canvas.parentElement.removeChild(ctx.canvas);
	}
}

export function handleResize(ctx: SceneContext): void {
	const w = ctx.container.clientWidth;
	const h = ctx.container.clientHeight;
	ctx.camera.aspect = w / h;
	ctx.camera.updateProjectionMatrix();
	ctx.renderer.setSize(w, h);
	fitCameraToImage(ctx);
}
