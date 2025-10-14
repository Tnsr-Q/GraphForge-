import { ColorMapName } from '../types';

// Pre-defined color maps, each an array of [r, g, b] colors from 0.0 to 1.0.
// These are based on popular scientific colormaps (like matplotlib's).

const VIRIDIS = [ [0.267, 0.005, 0.329], [0.282, 0.13, 0.455], [0.25, 0.24, 0.54,], [0.203, 0.341, 0.592], [0.16, 0.44, 0.62], [0.122, 0.53, 0.61,], [0.09, 0.63, 0.57], [0.2, 0.72, 0.49], [0.42, 0.8, 0.38], [0.67, 0.86, 0.26], [0.99, 0.91, 0.14] ];
const PLASMA = [ [0.05, 0.03, 0.53], [0.27, 0.05, 0.69], [0.44, 0.09, 0.75], [0.6, 0.15, 0.74], [0.74, 0.24, 0.67], [0.86, 0.34, 0.56], [0.95, 0.46, 0.43], [0.99, 0.6, 0.28], [0.98, 0.74, 0.16], [0.94, 0.88, 0.09], [0.97, 0.98, 0.56] ];
const INFERNO = [ [0.0, 0.0, 0.0], [0.15, 0.0, 0.25], [0.35, 0.0, 0.46], [0.55, 0.1, 0.48], [0.75, 0.2, 0.37], [0.9, 0.35, 0.2], [0.98, 0.55, 0.0], [0.99, 0.78, 0.15], [0.98, 0.98, 0.6] ];
const MAGMA = [ [0.0, 0.0, 0.0], [0.12, 0.08, 0.28], [0.28, 0.1, 0.48], [0.48, 0.15, 0.55], [0.68, 0.25, 0.52], [0.85, 0.4, 0.42], [0.96, 0.58, 0.33], [0.99, 0.78, 0.43], [0.99, 0.98, 0.8] ];
const HOT = [ [0.041, 0, 0], [0.4, 0, 0], [0.8, 0, 0], [1, 0.35, 0], [1, 0.8, 0], [1, 1, 0.6] ];
const COOL = [ [0, 1, 1], [1, 0, 1] ];
const DEFAULT_MAP = [ [0.2, 0.2, 0.8], [0.8, 0.2, 0.2] ];

const COLOR_MAPS: Record<ColorMapName, number[][]> = {
  viridis: VIRIDIS,
  plasma: PLASMA,
  inferno: INFERNO,
  magma: MAGMA,
  hot: HOT,
  cool: COOL,
  default: DEFAULT_MAP
};

function interpolate(color1: number[], color2: number[], factor: number): number[] {
  const result = color1.slice();
  for (let i = 0; i < 3; i++) {
    result[i] = result[i] + factor * (color2[i] - color1[i]);
  }
  return result;
}

export function getColorFromMap(value: number, mapName: ColorMapName = 'default'): number[] {
  const map = COLOR_MAPS[mapName] || DEFAULT_MAP;
  const clampedValue = Math.max(0, Math.min(1, value));

  const scaledValue = clampedValue * (map.length - 1);
  const index = Math.floor(scaledValue);
  const factor = scaledValue - index;
  
  if (index >= map.length - 1) {
    return map[map.length - 1];
  }

  return interpolate(map[index], map[index + 1], factor);
}

export function getColormapGradient(mapName: ColorMapName = 'default'): string {
    const map = COLOR_MAPS[mapName] || DEFAULT_MAP;
    const colorStops = map.map((color, index) => {
        const rgb = color.map(c => Math.round(c * 255));
        const percentage = (index / (map.length - 1)) * 100;
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]}) ${percentage}%`;
    });
    return `linear-gradient(to top, ${colorStops.join(', ')})`;
}
