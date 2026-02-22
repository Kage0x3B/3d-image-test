import type { SceneContext } from '../renderer/types';

export interface ParallaxConfig {
	parallaxMaxOffset: number;
	parallaxSmoothing: number;
	parallaxAutoWiggle: boolean;
	parallaxAutoWiggleSpeed: number;
}

export interface StereoConfig {
	stereoCrossEye: boolean;
	stereoEyeSeparation: number;
}

export interface WebXRConfig {
	webxrViewingDistance: number;
}

export interface ViewingModeConfig extends ParallaxConfig, StereoConfig, WebXRConfig {
	displacementScale: number;
}

export interface ViewingMode {
	readonly id: string;
	readonly label: string;
	isAvailable(): boolean;
	activate(ctx: SceneContext, config: ViewingModeConfig): void;
	deactivate(): void;
	updateConfig(key: string, value: unknown): void;
}
