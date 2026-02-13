import type { SceneContext } from '../renderer/types';

export interface ViewingModeConfig {
	displacementScale: number;
	[key: string]: unknown;
}

export interface ViewingMode {
	readonly id: string;
	readonly label: string;
	isAvailable(): boolean;
	activate(ctx: SceneContext, config: ViewingModeConfig): void;
	deactivate(): void;
	updateConfig(key: string, value: unknown): void;
}
