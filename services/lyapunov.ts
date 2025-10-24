import { Range } from '../types';

const SIM_STEPS = 100;
const SIM_DT = 0.02;
const PERTURBATION = 0.001;

const computeGradient = (x: number, y: number, potentialFn: (x: number, y: number) => number) => {
    const h = 0.01;
    const dFdx = (potentialFn(x + h, y) - potentialFn(x - h, y)) / (2 * h);
    const dFdy = (potentialFn(x, y + h) - potentialFn(x, y - h)) / (2 * h);
    return { dx: dFdx, dy: dFdy };
};

// Simulates the future path of a particle without rendering it.
function integrateFuture(
    startX: number,
    startY: number,
    steps: number,
    potentialFn: (x: number, y: number) => number,
    damping: number,
    forceCoupling: number
): { x: number, y: number }[] {
    const trajectory = [];
    let x = startX;
    let y = startY;
    let vx = 0;
    let vy = 0;

    for (let i = 0; i < steps; i++) {
        const grad = computeGradient(x, y, potentialFn);
        const ax = -damping * vx - forceCoupling * grad.dx;
        const ay = -damping * vy - forceCoupling * grad.dy;
        
        vx += ax * SIM_DT;
        vy += ay * SIM_DT;
        x += vx * SIM_DT;
        y += vy * SIM_DT;
        
        trajectory.push({ x, y });
    }
    return trajectory;
}

function calculateLyapunovExponent(
    x: number,
    y: number,
    potentialFn: (x: number, y: number) => number,
    damping: number,
    forceCoupling: number
): number {
    const traj1 = integrateFuture(x, y, SIM_STEPS, potentialFn, damping, forceCoupling);
    const traj2 = integrateFuture(x + PERTURBATION, y, SIM_STEPS, potentialFn, damping, forceCoupling);

    let totalDivergence = 0;
    for (let i = 0; i < SIM_STEPS; i++) {
        const p1 = traj1[i];
        const p2 = traj2[i];
        if (!p1 || !p2 || !isFinite(p1.x) || !isFinite(p2.x)) continue;
        
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            totalDivergence += Math.log(distance / PERTURBATION);
        }
    }

    return totalDivergence / SIM_STEPS;
}

export function generateLyapunovGrid(
    width: number,
    height: number,
    xRange: Range,
    yRange: Range,
    potentialFn: (x: number, y: number) => number,
    damping: number,
    forceCoupling: number
): Float32Array {
    const data = new Float32Array(width * height);
    let maxExponent = -Infinity;

    for (let j = 0; j < height; j++) {
        const y = yRange.min + (j / (height - 1)) * (yRange.max - yRange.min);
        for (let i = 0; i < width; i++) {
            const x = xRange.min + (i / (width - 1)) * (xRange.max - xRange.min);
            const exponent = calculateLyapunovExponent(x, y, potentialFn, damping, forceCoupling);
            const index = j * width + i;
            
            if (isFinite(exponent)) {
                data[index] = exponent;
                if (exponent > maxExponent) {
                    maxExponent = exponent;
                }
            } else {
                data[index] = 0;
            }
        }
    }

    // Normalize the data to be in the range [0, 1]
    if (maxExponent > 0) {
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.max(0, data[i] / maxExponent);
        }
    }
    
    return data;
}
