import { Vector3 } from "three";

export interface Range {
  min: number;
  max: number;
  steps?: number;
}

export interface G3DFunction {
  params: string[];
  body: string;
}

export interface ParticleSystemProps {
  params: string[];
  body: string;
}
export interface SurfacePlot {
  type: 'surface';
  expr: string;
}

export interface VectorPlot {
  type: 'vector';
  fnName: string;
}

export interface TensorPlot {
  type: 'tensor';
  fnName: string;
  glyphType: 'ELLIPSOID';
}

export type Plot = SurfacePlot | VectorPlot | TensorPlot;

export interface Animation {
    parameter: string;
    from: number;
    to: number;
    step: number;
}

export interface Contour {
    levels: number[];
}

export interface Label {
    textExpr: string;
    positionExpr: [string, string, string];
}

export interface Particles { 
    count: number;
}
export interface Particlestate {
   params: string[];
  body: string;
}
export type ColorMapName = 'viridis' | 'plasma' | 'inferno' | 'magma' | 'hot' | 'cool' | 'default';

export interface GraphIR {
  version: number;
  ranges: {
    x: Range;
    y: Range;
    z: Range;
  };
  functions: { [key:string]: G3DFunction };
  plots: Plot[];
  animation?: Animation;
  colorMap?: ColorMapName;
  contours?: Contour;
  labels?: Label[];
  particles?: Particles;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ExperimentalPoint {
  id: string;
  x: number;
  y: number;
  residue: number;
  uncertainty: number;
}

export interface ValidationResults {
  rms: number;
  maxDeviation: number;
  passFailStatus: 'THEOREM B.5 CONFIRMED' | 'FALSIFIED';
  deviations: { ep: string; deviation: number }[];
}