import type { ViewingMode } from './types';
import { ParallaxMode } from './parallax-mode';
import { StereoMode } from './stereo-mode';
import { WebXRMode } from './webxr-mode';

const modes: Map<string, ViewingMode> = new Map();

const parallax = new ParallaxMode();
const stereo = new StereoMode();
const webxr = new WebXRMode();

modes.set(parallax.id, parallax);
modes.set(stereo.id, stereo);
modes.set(webxr.id, webxr);

export function getMode(id: string): ViewingMode {
	const mode = modes.get(id);
	if (!mode) throw new Error(`Unknown viewing mode: ${id}`);
	return mode;
}

export function listModes(): ViewingMode[] {
	return Array.from(modes.values());
}

export type { ViewingMode, ViewingModeConfig } from './types';
