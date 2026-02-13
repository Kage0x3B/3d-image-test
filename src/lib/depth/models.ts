export interface DepthModel {
	/** HuggingFace model ID — passed directly to pipeline() */
	id: string;
	/** Display name */
	label: string;
	/** Model family for optgroup */
	group: string;
	/** Approximate download size (FP32 ONNX) */
	size: string;
}

export const DEFAULT_MODEL_ID = 'onnx-community/depth-anything-v2-small';

export const DEPTH_MODELS: DepthModel[] = [
	// --- Depth Anything V2 ---
	{
		id: 'onnx-community/depth-anything-v2-small',
		label: 'Small (~100 MB)',
		group: 'Depth Anything V2',
		size: '~100 MB'
	},
	{
		id: 'onnx-community/depth-anything-v2-base',
		label: 'Base (~390 MB)',
		group: 'Depth Anything V2',
		size: '~390 MB'
	},
	{
		id: 'onnx-community/depth-anything-v2-large',
		label: 'Large (~1.3 GB)',
		group: 'Depth Anything V2',
		size: '~1.3 GB'
	},

	// --- Depth Anything V1 ---
	{
		id: 'Xenova/depth-anything-small-hf',
		label: 'Small (~100 MB)',
		group: 'Depth Anything V1',
		size: '~100 MB'
	},
	{
		id: 'Xenova/depth-anything-base-hf',
		label: 'Base (~390 MB)',
		group: 'Depth Anything V1',
		size: '~390 MB'
	},
	{
		id: 'Xenova/depth-anything-large-hf',
		label: 'Large (~1.3 GB)',
		group: 'Depth Anything V1',
		size: '~1.3 GB'
	},

	// --- DPT-DINOv2 ---
	{
		id: 'onnx-community/dpt-dinov2-small-nyu',
		label: 'Small — Indoor (~144 MB)',
		group: 'DPT-DINOv2',
		size: '~144 MB'
	},
	{
		id: 'onnx-community/dpt-dinov2-small-kitti',
		label: 'Small — Outdoor (~144 MB)',
		group: 'DPT-DINOv2',
		size: '~144 MB'
	},
	{
		id: 'onnx-community/dpt-dinov2-base-nyu',
		label: 'Base — Indoor (~444 MB)',
		group: 'DPT-DINOv2',
		size: '~444 MB'
	},
	{
		id: 'onnx-community/dpt-dinov2-base-kitti',
		label: 'Base — Outdoor (~444 MB)',
		group: 'DPT-DINOv2',
		size: '~444 MB'
	},
	{
		id: 'onnx-community/dpt-dinov2-large-nyu',
		label: 'Large — Indoor (~1.3 GB)',
		group: 'DPT-DINOv2',
		size: '~1.3 GB'
	},
	{
		id: 'onnx-community/dpt-dinov2-large-kitti',
		label: 'Large — Outdoor (~1.3 GB)',
		group: 'DPT-DINOv2',
		size: '~1.3 GB'
	},

	// --- Classic DPT ---
	{
		id: 'Xenova/dpt-hybrid-midas',
		label: 'Hybrid MiDaS (~533 MB)',
		group: 'Classic DPT',
		size: '~533 MB'
	},
	{
		id: 'Xenova/dpt-large',
		label: 'Large (~1.4 GB)',
		group: 'Classic DPT',
		size: '~1.4 GB'
	},

	// --- GLPN ---
	{
		id: 'Xenova/glpn-nyu',
		label: 'Indoor / NYU (~246 MB)',
		group: 'GLPN',
		size: '~246 MB'
	},
	{
		id: 'Xenova/glpn-kitti',
		label: 'Outdoor / KITTI (~246 MB)',
		group: 'GLPN',
		size: '~246 MB'
	},

	// --- Metric3D ---
	{
		id: 'onnx-community/metric3d-vit-small',
		label: 'ViT Small (~151 MB)',
		group: 'Metric3D',
		size: '~151 MB'
	}
];

/** Group models by their family for select optgroups */
export function getModelGroups(): { group: string; models: DepthModel[] }[] {
	const groups: Map<string, DepthModel[]> = new Map();
	for (const model of DEPTH_MODELS) {
		let list = groups.get(model.group);
		if (!list) {
			list = [];
			groups.set(model.group, list);
		}
		list.push(model);
	}
	return Array.from(groups, ([group, models]) => ({ group, models }));
}
