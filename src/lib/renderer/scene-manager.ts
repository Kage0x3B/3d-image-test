import * as THREE from 'three';
import type { SceneContext, RendererConfig } from './types';
import { buildDisplacedMesh } from './mesh-builder';
import { buildTornMesh } from './torn-mesh-builder';

export function createSceneContext(config: RendererConfig): SceneContext {
	const {
		container,
		photo,
		depthCanvas,
		displacementScale = 0.5,
		meshSubdivisions = 256,
		renderingMethod = 'simple'
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

	let mesh: THREE.Mesh;
	let material: THREE.MeshStandardMaterial;
	let fillMesh: THREE.Mesh | null = null;
	let fillMaterial: THREE.MeshStandardMaterial | null = null;

	if (renderingMethod === 'torn-mesh' && config.depthData) {
		const result = buildTornMesh({
			photo,
			inpaintedPhoto: config.inpaintedPhoto,
			depthData: config.depthData,
			depthWidth: config.depthWidth ?? config.depthData.length,
			depthHeight: config.depthHeight ?? 1,
			displacementScale,
			subdivisions: meshSubdivisions,
			edgeThreshold: config.edgeThreshold ?? 0.15,
			depthCanvas
		});
		mesh = result.mesh;
		material = result.material;
		fillMesh = result.fillMesh;
		fillMaterial = result.fillMaterial;
	} else {
		const result = buildDisplacedMesh({
			photo,
			depthCanvas,
			displacementScale,
			subdivisions: meshSubdivisions
		});
		mesh = result.mesh;
		material = result.material;
	}

	scene.add(mesh);
	if (fillMesh) scene.add(fillMesh);

	const ctx: SceneContext = {
		scene,
		renderer,
		camera,
		mesh,
		material,
		fillMesh,
		fillMaterial,
		container,
		canvas: renderer.domElement,
		imageWidth,
		imageHeight,
		renderingMethod
	};

	// Fit camera so image fills viewport without upscaling
	fitCameraToImage(ctx);

	return ctx;
}

/**
 * Rebuild the mesh in-place (remove old, build new) without recreating the entire scene.
 */
export function rebuildMesh(ctx: SceneContext, config: RendererConfig): void {
	// Remove old mesh
	ctx.scene.remove(ctx.mesh);
	ctx.mesh.geometry.dispose();
	if (ctx.material.map) ctx.material.map.dispose();
	if (ctx.material.displacementMap) ctx.material.displacementMap.dispose();
	ctx.material.dispose();

	// Remove old fill mesh
	disposeFillMesh(ctx);

	const renderingMethod = config.renderingMethod ?? 'simple';
	const displacementScale = config.displacementScale ?? 0.5;
	const meshSubdivisions = config.meshSubdivisions ?? 256;

	let mesh: THREE.Mesh;
	let material: THREE.MeshStandardMaterial;
	let fillMesh: THREE.Mesh | null = null;
	let fillMaterial: THREE.MeshStandardMaterial | null = null;

	if (renderingMethod === 'torn-mesh' && config.depthData) {
		const result = buildTornMesh({
			photo: config.photo,
			inpaintedPhoto: config.inpaintedPhoto,
			depthData: config.depthData,
			depthWidth: config.depthWidth ?? config.depthData.length,
			depthHeight: config.depthHeight ?? 1,
			displacementScale,
			subdivisions: meshSubdivisions,
			edgeThreshold: config.edgeThreshold ?? 0.15,
			depthCanvas: config.depthCanvas
		});
		mesh = result.mesh;
		material = result.material;
		fillMesh = result.fillMesh;
		fillMaterial = result.fillMaterial;
	} else {
		const result = buildDisplacedMesh({
			photo: config.photo,
			depthCanvas: config.depthCanvas,
			displacementScale,
			subdivisions: meshSubdivisions
		});
		mesh = result.mesh;
		material = result.material;
	}

	ctx.scene.add(mesh);
	if (fillMesh) ctx.scene.add(fillMesh);

	ctx.mesh = mesh;
	ctx.material = material;
	ctx.fillMesh = fillMesh;
	ctx.fillMaterial = fillMaterial;
	ctx.renderingMethod = renderingMethod;

	fitCameraToImage(ctx);
}

function disposeFillMesh(ctx: SceneContext): void {
	if (ctx.fillMesh) {
		ctx.scene.remove(ctx.fillMesh);
		ctx.fillMesh.geometry.dispose();
	}
	if (ctx.fillMaterial) {
		if (ctx.fillMaterial.map) ctx.fillMaterial.map.dispose();
		if (ctx.fillMaterial.displacementMap) ctx.fillMaterial.displacementMap.dispose();
		ctx.fillMaterial.dispose();
	}
	ctx.fillMesh = null;
	ctx.fillMaterial = null;
}

/**
 * Adjusts camera Z so the mesh fills the viewport as large as possible
 * without exceeding the image's native pixel dimensions.
 */
export function fitCameraToImage(ctx: SceneContext, viewportWidth?: number): void {
	const { camera, container, imageWidth, imageHeight } = ctx;
	const containerW = Math.max(1, viewportWidth ?? container.clientWidth);
	const containerH = Math.max(1, container.clientHeight);
	const dpr = Math.min(window.devicePixelRatio, 2);

	if (imageWidth <= 0 || imageHeight <= 0) return;

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

/**
 * Recursively dispose all Three.js resources in an object hierarchy.
 */
function disposeObject3D(obj: THREE.Object3D): void {
	while (obj.children.length > 0) {
		disposeObject3D(obj.children[0]);
		obj.remove(obj.children[0]);
	}

	if ('geometry' in obj && (obj as THREE.Mesh).geometry) {
		(obj as THREE.Mesh).geometry.dispose();
	}

	if ('material' in obj) {
		const materials = Array.isArray((obj as THREE.Mesh).material)
			? (obj as THREE.Mesh).material as THREE.Material[]
			: [(obj as THREE.Mesh).material as THREE.Material];

		for (const material of materials) {
			if (!material) continue;
			// Dispose all texture properties
			for (const value of Object.values(material)) {
				if (value instanceof THREE.Texture) {
					value.dispose();
				}
			}
			material.dispose();
		}
	}
}

export function disposeSceneContext(ctx: SceneContext): void {
	ctx.renderer.setAnimationLoop(null);
	disposeObject3D(ctx.scene);
	ctx.renderer.dispose();
	if (ctx.canvas.parentElement) {
		ctx.canvas.parentElement.removeChild(ctx.canvas);
	}
}

export function handleResize(ctx: SceneContext): void {
	const w = ctx.container.clientWidth;
	const h = ctx.container.clientHeight;
	if (w <= 0 || h <= 0) return;
	ctx.camera.aspect = w / h;
	ctx.camera.updateProjectionMatrix();
	ctx.renderer.setSize(w, h);
	fitCameraToImage(ctx);
}
