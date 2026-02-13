import type { DepthEstimator } from './types';
import { BrowserDepthEstimator } from './browser-estimator';

export type DepthProvider = 'browser' | 'api';

export function createDepthEstimator(provider: DepthProvider = 'browser'): DepthEstimator {
	switch (provider) {
		case 'browser':
			return new BrowserDepthEstimator();
		case 'api':
			throw new Error('API depth estimator not yet implemented');
		default:
			throw new Error(`Unknown depth provider: ${provider}`);
	}
}

export type { DepthEstimator, DepthResult, ProgressCallback } from './types';
