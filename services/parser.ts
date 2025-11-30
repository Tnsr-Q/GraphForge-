import { GraphIR, Plot } from '../types';
import { createConfiguredMathParser } from './math-parser';

const VALID_COLOR_MAPS = ['viridis', 'plasma', 'inferno', 'magma', 'hot', 'cool', 'default'];
const MAX_PARTICLES = 5000;

export const parseG3D = (code: string): GraphIR => {
  // Step 1: Pre-process to handle explicit multi-line statements with backslashes.
  const backslashProcessedLines: string[] = [];
  let lineBuffer = '';
  code.split('\n').forEach(line => {
    const trimmed = line.split('#')[0].trim();
    if (!trimmed) return;
    
    lineBuffer += (lineBuffer ? ' ' : '') + trimmed;
    
    if (lineBuffer.endsWith('\\')) {
      lineBuffer = lineBuffer.slice(0, -1);
    } else {
      backslashProcessedLines.push(lineBuffer);
      lineBuffer = '';
    }
  });
  if (lineBuffer) {
      backslashProcessedLines.push(lineBuffer);
  }

  // Step 2: Pre-process to handle implicit multi-line DEF statements.
  const finalProcessedLines: string[] = [];
  let defBuffer = '';
  const keywordsRegex = /^(SET|COLOR|PLOT3D|PLOT_VECFIELD|PLOT_TENSOR|ANIMATE|PARTICLES|CONTOUR|LABEL)\s/i;

  for (const line of backslashProcessedLines) {
    if (line.match(/^DEF\s/i)) {
      if (defBuffer) {
        finalProcessedLines.push(defBuffer);
      }
      defBuffer = line;
    } 
    else if (defBuffer && !line.match(keywordsRegex)) {
      // FIX: Do not add a space when concatenating multi-line definitions.
      // This prevents turning `[` and `[` on separate lines into `[ [` which is invalid for a matrix.
      // Math.js is robust enough to handle expressions without spaces between operators.
      defBuffer += line;
    } 
    else {
      if (defBuffer) {
        finalProcessedLines.push(defBuffer);
        defBuffer = '';
      }
      finalProcessedLines.push(line);
    }
  }

  if (defBuffer) {
    finalProcessedLines.push(defBuffer);
  }
  
  const lines = finalProcessedLines.filter(line => line.length > 0);

  const ir: GraphIR = {
    version: 1,
    ranges: {
      x: { min: -1, max: 1 },
      y: { min: -1, max: 1 },
      z: { min: -1, max: 1 },
    },
    functions: {},
    plots: [],
    labels: [],
    colorMap: 'default',
  };

  let animationFound = false;
  let colorMapFound = false;
  let contourFound = false;
  let particlesFound = false;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // SET RANGE X -1.5 TO 1.5
    const rangeMatch = line.match(/^SET\s+RANGE\s+([XYZ])\s+([-\d.]+)\s+TO\s+([-\d.]+)/i);
    if (rangeMatch) {
      const axis = rangeMatch[1].toLowerCase() as 'x' | 'y' | 'z';
      const min = parseFloat(rangeMatch[2]);
      const max = parseFloat(rangeMatch[3]);
      if (isNaN(min) || isNaN(max)) {
        throw new Error(`Line ${lineNumber}: Invalid number in RANGE statement.`);
      }
      if (min >= max) {
        throw new Error(`Line ${lineNumber}: Min value must be less than max value in RANGE statement.`);
      }
      ir.ranges[axis] = { min, max };
      return;
    }

    // COLOR MAP plasma
    const colorMapMatch = line.match(/^COLOR\s+MAP\s+(\w+)/i);
    if (colorMapMatch) {
        if (colorMapFound) {
            throw new Error(`Line ${lineNumber}: Multiple COLOR MAP statements found. Only one is allowed.`);
        }
        const mapName = colorMapMatch[1].toLowerCase() as any;
        if (!VALID_COLOR_MAPS.includes(mapName)) {
            throw new Error(`Line ${lineNumber}: Invalid color map "${mapName}". Valid maps are: ${VALID_COLOR_MAPS.join(', ')}`);
        }
        ir.colorMap = mapName;
        colorMapFound = true;
        return;
    }
    
    // PARTICLES 500
    const particlesMatch = line.match(/^PARTICLES\s+(\d+)/i);
    if (particlesMatch) {
        if (particlesFound) {
            throw new Error(`Line ${lineNumber}: Multiple PARTICLES statements found. Only one is allowed.`);
        }
        const count = parseInt(particlesMatch[1], 10);
        if (isNaN(count) || count <= 0) {
            throw new Error(`Line ${lineNumber}: Invalid particle count. Must be a positive integer.`);
        }
        if (count > MAX_PARTICLES) {
            throw new Error(`Line ${lineNumber}: Particle count exceeds the maximum limit of ${MAX_PARTICLES}.`);
        }
        ir.particles = { count };
        particlesFound = true;
        return;
    }

    // CONTOUR LEVELS -0.5, 0, 0.5
    const contourMatch = line.match(/^CONTOUR\s+LEVELS\s+(.*)/i);
    if (contourMatch) {
        if (contourFound) {
            throw new Error(`Line ${lineNumber}: Multiple CONTOUR statements found. Only one is allowed.`);
        }
        const levelsStr = contourMatch[1];
        const levels = levelsStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        
        if (levels.length === 0) {
            throw new Error(`Line ${lineNumber}: No valid numbers found in CONTOUR LEVELS statement.`);
        }
        
        ir.contours = { levels };
        contourFound = true;
        return;
    }

    // LABEL "My Label" AT 1, 2, 3 OR LABEL "Value=" + STR(t) AT FNX(t), 0, 0
    const labelMatch = line.match(/^LABEL\s+(.+)\s+AT\s+([^,]+)\s*,\s*([^,]+)\s*,\s*(.*)/i);
    if (labelMatch) {
        const textExpr = labelMatch[1].trim();
        const xExpr = labelMatch[2].trim();
        const yExpr = labelMatch[3].trim();
        const zExpr = labelMatch[4].trim();
        if (!ir.labels) {
          ir.labels = [];
        }
        ir.labels.push({ textExpr, positionExpr: [xExpr, yExpr, zExpr] });
        return;
    }

    // DEF FN_CONSTANT = 123 (parameter-less function, i.e. a constant)
    const defConstMatch = line.match(/^DEF\s+([^=()]+?)\s*=\s*(.*)/i);
    if (defConstMatch && !line.substring(0, line.indexOf('=')).includes('(')) {
        let name = defConstMatch[1].trim().replace(/\s+/g, '');
        // Relaxed check: Allow FN, VEC, or TENSOR prefixes
        if (!name.toUpperCase().startsWith('FN') && !name.toUpperCase().startsWith('VEC') && !name.toUpperCase().startsWith('TENSOR')) {
             throw new Error(`Line ${lineNumber}: Constant definition name must start with FN, VEC, or TENSOR.`);
        }
        const body = defConstMatch[2].trim();
        if (!body) {
            throw new Error(`Line ${lineNumber}: Constant definition cannot be empty.`);
        }
        if (ir.functions[name]) {
            throw new Error(`Line ${lineNumber}: Constant or function '${name}' is already defined.`);
        }
        ir.functions[name] = { params: [], body };
        return;
    }
    
    // DEF VEC_MYVEC(x,y) = [x, y, 0]
    // Relaxed to allow any function name for vector-like definitions (bracketed body)
    const defVecFnMatch = line.match(/^DEF\s+(VEC_\w+|FN\w+|TENSOR_\w+)\s*\(([^)]*)\)\s*=\s*(\[.*\])/i);
    // Note: We use a specific regex for brackets to distinguish from scalars, but we can also rely on the generic FN match 
    // if we just want to parse the body.
    
    // Actually, let's keep specific VEC/TENSOR matchers for strictness if desired, but here we want flexibility.
    // The previous logic for defVecFnMatch enforced square brackets.
    
    const defVecExplicitMatch = line.match(/^DEF\s+(VEC_\w+)\s*\(([^)]*)\)\s*=\s*(.*)/i);
    if (defVecExplicitMatch) {
      const name = defVecExplicitMatch[1];
      const params = defVecExplicitMatch[2].split(',').map(p => p.trim()).filter(p => p);
      const body = defVecExplicitMatch[3].trim();
      if (!body.startsWith('[') || !body.endsWith(']')) {
        throw new Error(`Line ${lineNumber}: Vector function body must be enclosed in square brackets [].`);
      }
      if (ir.functions[name]) {
        throw new Error(`Line ${lineNumber}: Function '${name}' is already defined.`);
      }
      ir.functions[name] = { params, body };
      return;
    }
    
    // DEF TENSOR_MYTENSOR(x,y) = [[x, y], [y, x]]
    const defTensorExplicitMatch = line.match(/^DEF\s+(TENSOR_\w+)\s*\(([^)]*)\)\s*=\s*(.*)/i);
    if (defTensorExplicitMatch) {
      const name = defTensorExplicitMatch[1];
      const params = defTensorExplicitMatch[2].split(',').map(p => p.trim()).filter(p => p);
      const body = defTensorExplicitMatch[3].trim();
      if (!body.startsWith('[[') || !body.endsWith(']]')) {
        throw new Error(`Line ${lineNumber}: Tensor function body must be a matrix enclosed in double square brackets [[]].`);
      }
      if (ir.functions[name]) {
        throw new Error(`Line ${lineNumber}: Function '${name}' is already defined.`);
      }
      ir.functions[name] = { params, body };
      return;
    }

    // DEF FNZ(x,y) = 1.5 / ((x - 0.9)^2 + ...
    const defFnMatch = line.match(/^DEF\s+(FN\w+)\s*\(([^)]*)\)\s*=(.*)/i);
    if (defFnMatch) {
      const name = defFnMatch[1];
      const params = defFnMatch[2].split(',').map(p => p.trim()).filter(p => p);
      const body = defFnMatch[3].trim();
      if (!body) {
        throw new Error(`Line ${lineNumber}: Function body cannot be empty.`);
      }
      ir.functions[name] = { params, body };
      return;
    }

    // PLOT3D FNZ(x,y)
    const plot3dMatch = line.match(/^PLOT3D\s+(.*)/i);
    if (plot3dMatch) {
      const expr = plot3dMatch[1].trim();
      if (!expr) {
        throw new Error(`Line ${lineNumber}: PLOT3D expression cannot be empty.`);
      }
      ir.plots.push({ type: 'surface', expr });
      return;
    }

    // PLOT_VECFIELD VEC_FLOW or FN_FLOW
    // Relaxed regex to allow any identifier
    const plotVecFieldMatch = line.match(/^PLOT_VECFIELD\s+(\w+)/i);
    if (plotVecFieldMatch) {
      const fnName = plotVecFieldMatch[1].trim();
      ir.plots.push({ type: 'vector', fnName });
      return;
    }

    // PLOT_TENSOR TENSOR_SHEAR AS GLYPH 'ELLIPSOID'
    // Relaxed regex to allow any identifier
    const plotTensorMatch = line.match(/^PLOT_TENSOR\s+(\w+)\s+AS\s+GLYPH\s+'(ELLIPSOID)'/i);
    if (plotTensorMatch) {
        const fnName = plotTensorMatch[1].trim();
        const glyphType = plotTensorMatch[2].toUpperCase() as 'ELLIPSOID';
        ir.plots.push({ type: 'tensor', fnName, glyphType });
        return;
    }

    // ANIMATE t FROM 0 TO 6.28 STEP 0.05
    // Support expressions for range parameters (e.g. 2*PI)
    const animateMatch = line.match(/^ANIMATE\s+(\w+)\s+FROM\s+(.+?)\s+TO\s+(.+?)\s+STEP\s+(.+)/i);
    if (animateMatch) {
        if (animationFound) {
            throw new Error(`Line ${lineNumber}: Multiple ANIMATE statements found. Only one is allowed.`);
        }
        const parameter = animateMatch[1];
        
        // Evaluate the expressions using the parser
        const parser = createConfiguredMathParser(ir.functions);
        let from: number, to: number, step: number;
        
        try {
             from = parser.evaluate(animateMatch[2]);
             to = parser.evaluate(animateMatch[3]);
             step = parser.evaluate(animateMatch[4]);
        } catch (e: any) {
             throw new Error(`Line ${lineNumber}: Invalid animation parameters. ${e.message}`);
        }

        if (typeof from !== 'number' || typeof to !== 'number' || typeof step !== 'number' || isNaN(from) || isNaN(to) || isNaN(step)) {
            throw new Error(`Line ${lineNumber}: Animation parameters must evaluate to valid numbers.`);
        }
        
        if (step <= 0) {
            throw new Error(`Line ${lineNumber}: STEP value must be positive.`);
        }
        ir.animation = { parameter, from, to, step };
        animationFound = true;
        return;
    }

    throw new Error(`Line ${lineNumber}: Unknown or invalid statement: "${line}"`);
  });

  if (!ir.plots.some(p => p.type === 'surface')) {
    const hasOtherPlots = ir.plots.some(p => p.type === 'vector' || p.type === 'tensor');
    if (hasOtherPlots) {
        // If there are vector or tensor plots but no surface, add a default flat plane.
        ir.plots.unshift({ type: 'surface', expr: '0' });
    } else {
        throw new Error('No PLOT3D, PLOT_VECFIELD, or PLOT_TENSOR statement found. Nothing to render.');
    }
  }

  return ir;
};