import type * as THREE from 'three';

export interface SceneContext {
	scene: THREE.Scene;
	renderer: THREE.WebGLRenderer;
	camera: THREE.PerspectiveCamera;
	mesh: THREE.Mesh;
	material: THREE.MeshStandardMaterial;
	container: HTMLElement;
	canvas: HTMLCanvasElement;
	imageWidth: number;
	imageHeight: number;
}

export interface RendererConfig {
	container: HTMLElement;
	photo: HTMLImageElement | ImageBitmap;
	depthCanvas: HTMLCanvasElement;
	displacementScale?: number;
	meshSubdivisions?: number;
}

export interface MeshConfig {
	photo: HTMLImageElement | ImageBitmap;
	depthCanvas: HTMLCanvasElement;
	displacementScale: number;
	subdivisions: number;
}
