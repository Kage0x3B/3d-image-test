import type * as THREE from 'three';
import type { RenderingMethod } from '$lib/inpainting/types';

export interface SceneContext {
	scene: THREE.Scene;
	renderer: THREE.WebGLRenderer;
	camera: THREE.PerspectiveCamera;
	mesh: THREE.Mesh;
	material: THREE.MeshStandardMaterial;
	fillMesh: THREE.Mesh | null;
	fillMaterial: THREE.MeshStandardMaterial | null;
	container: HTMLElement;
	canvas: HTMLCanvasElement;
	imageWidth: number;
	imageHeight: number;
	renderingMethod: RenderingMethod;
}

export interface RendererConfig {
	container: HTMLElement;
	photo: HTMLImageElement | ImageBitmap;
	depthCanvas: HTMLCanvasElement;
	displacementScale?: number;
	meshSubdivisions?: number;
	renderingMethod?: RenderingMethod;
	inpaintedPhoto?: HTMLCanvasElement | null;
	depthData?: Float32Array | null;
	depthWidth?: number;
	depthHeight?: number;
	edgeThreshold?: number;
}

export interface MeshConfig {
	photo: HTMLImageElement | ImageBitmap;
	depthCanvas: HTMLCanvasElement;
	displacementScale: number;
	subdivisions: number;
}
