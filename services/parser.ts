import { GraphIR, Range, G3DFunction, Plot, ColorMapName, Contour } from '../types';

const VALID_COLOR_MAPS: ColorMapName[] = ['viridis', 'plasma', 'inferno', 'magma', 'hot', 'cool', 'default'];
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
  const keywordsRegex = /^(SET|COLOR|PLOT3D|ANIMATE|PARTICLES|CONTOUR|LABEL)\s/i;

  for (const line of backslashProcessedLines) {
    if (line.match(/^DEF\s/i)) {
      if (defBuffer) {
        finalProcessedLines.push(defBuffer);
      }
      defBuffer = line;
    } 
    else if (defBuffer && !line.match(keywordsRegex)) {
      defBuffer += ` ${line}`;
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
        const mapName = colorMapMatch[1].toLowerCase() as ColorMapName;
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
    // This must be checked before the main function definition regex.
    const defConstMatch = line.match(/^DEF\s+([^=()]+?)\s*=\s*(.*)/i);
    if (defConstMatch && !line.substring(0, line.indexOf('=')).includes('(')) {
        let name = defConstMatch[1].trim().replace(/\s+/g, '');
        if (!name.toUpperCase().startsWith('FN')) {
            name = 'FN' + name;
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
    
    // DEF FNZ(x,y) = 1.5 / ((x - 0.9)^2 + ...
    const defFnMatch = line.match(/^DEF\s+FN(\w+)\s*\(([^)]*)\)\s*=(.*)/i);
    if (defFnMatch) {
      const name = `FN${defFnMatch[1]}`;
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

    // ANIMATE t FROM 0 TO 6.28 STEP 0.05
    const animateMatch = line.match(/^ANIMATE\s+(\w+)\s+FROM\s+([-\d.]+)\s+TO\s+([-\d.]+)\s+STEP\s+([-\d.]+)/i);
    if (animateMatch) {
        if (animationFound) {
            throw new Error(`Line ${lineNumber}: Multiple ANIMATE statements found. Only one is allowed.`);
        }
        const parameter = animateMatch[1];
        const from = parseFloat(animateMatch[2]);
        const to = parseFloat(animateMatch[3]);
        const step = parseFloat(animateMatch[4]);
        if (isNaN(from) || isNaN(to) || isNaN(step)) {
            throw new Error(`Line ${lineNumber}: Invalid number in ANIMATE statement.`);
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

  if (ir.plots.length === 0) {
    throw new Error('No PLOT3D statement found. Nothing to render.');
  }

  return ir;
};