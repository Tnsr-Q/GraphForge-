export const DEFAULT_G3D_CODE = `
# WebGL Quantum Exceptional Point Dynamics
# A particle simulation of a quantum potential landscape with visual effects.

SET RANGE X -8 TO 8
SET RANGE Y -8 TO 8
SET RANGE Z -4 TO 12
COLOR MAP plasma

# Define the components of the potential function
DEF FNPI = 3.1415926535
DEF FNMANIFOLD(x,y) = EXP(-0.3*(x^2 + y^2)) * COS(SQRT(x^2 + y^2))

# Time-dependent part of the wavefunction for quantum coherence ripples
DEF FNPSI1(x,y,t) = (x^2 - y^2) * EXP(-0.15*(x^2 + y^2)) * SIN(2*FNPI*SQRT(x^2 + y^2)/8 - t)
DEF FNPSI2(x,y,t) = 2*x*y * EXP(-0.15*(x^2 + y^2)) * COS(2*FNPI*SQRT(x^2 + y^2)/8 - t)

# Define the four exceptional points (EPs) with tunable residues
DEF FNEP1_RESIDUE = 2.5
DEF FNEP2_RESIDUE = 3.0
DEF FNEP3_RESIDUE = 2.0
DEF FNEP4_RESIDUE = 2.8
DEF FNEP(x,y) = FNEP1_RESIDUE/((x-3)^2+(y-2)^2+0.3) + FNEP2_RESIDUE/((x+2)^2+(y-4)^2+0.3) + FNEP3_RESIDUE/((x+4)^2+(y+3)^2+0.3) + FNEP4_RESIDUE/((x-2)^2+(y+4)^2+0.3)

# Combine functions into the final surface potential, including animated ripples
DEF FNSURFACE(x,y,t) = FNMANIFOLD(x,y) + 0.4*FNPSI1(x,y,t) + 0.4*FNPSI2(x,y,t) + 0.8*FNEP(x,y)

# Add labels for the exceptional points, which follow the animated surface
LABEL "EP1" AT 3, 2, FNSURFACE(3,2,t) + 0.5
LABEL "EP2" AT -2, 4, FNSURFACE(-2,4,t) + 0.5
LABEL "EP3" AT -4, -3, FNSURFACE(-4,-3,t) + 0.5
LABEL "EP4" AT 2, -4, FNSURFACE(2,-4,t) + 0.5

# Add 500 physics-driven particles to the simulation
PARTICLES 500

# Animate the 't' parameter to drive the quantum ripples
ANIMATE t FROM 0 TO 6.28 STEP 0.05

# Plot the 3D potential surface
PLOT3D FNSURFACE(x,y,t)
`.trim();

export const GEMINI_SYSTEM_INSTRUCTION = `You are an expert in G3D, a declarative graphics language for rendering 3D scenes. Your task is to generate G3D code based on user prompts.

**G3D Language Specification:**

*   **Comments:** Lines starting with \`#\` are comments.
*   **Ranges:** \`SET RANGE [X|Y|Z] <min> TO <max>\` (e.g., \`SET RANGE X -10 TO 10\`).
*   **Color Map:** \`COLOR MAP [viridis|plasma|inferno|magma|hot|cool|default]\` (e.g., \`COLOR MAP plasma\`).
*   **Functions/Constants:**
    *   Constants: \`DEF FNSOMETHING = 1.23\`. Must start with \`FN\`.
    *   Functions: \`DEF FNSOMENAME(p1, p2) = <expression>\`. Must start with \`FN\`.
    *   Supported math: \`SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, SQRT, LOG, EXP, POW, ABS, PI\`.
*   **Plotting:** \`PLOT3D <expression>\` (e.g., \`PLOT3D FNSURFACE(x,y,t)\`).
*   **Animation:** \`ANIMATE <param> FROM <start> TO <end> STEP <step>\` (e.g., \`ANIMATE t FROM 0 TO 6.28 STEP 0.05\`). Only one \`ANIMATE\` statement is allowed.
*   **Particles:** \`PARTICLES <count>\` (e.g., \`PARTICLES 500\`). Maximum 5000.
*   **Labels:** \`LABEL "<text_expr>" AT <x_expr>, <y_expr>, <z_expr>\` (e.g., \`LABEL "Point A" AT 1, 2, FNSURFACE(1,2,t)\`).
*   **Contours:** \`CONTOUR LEVELS <level1>, <level2>, ...\` (e.g., \`CONTOUR LEVELS -1, 0, 1\`).

**Rules:**
1.  Always provide a \`PLOT3D\` statement.
2.  Ensure expressions are mathematically valid.
3.  The main surface function should typically take \`x\` and \`y\` as parameters. If animated, it can also take the animated parameter (e.g., \`t\`).
4.  Do not include any explanation or markdown formatting (like \`\`\`g3d\`). Only output the raw G3D code.
5.  Be creative and generate interesting and visually appealing scenes based on the prompt. For example, for "a wavy surface", you could generate something like \`DEF FNSURFACE(x,y) = SIN(x) * COS(y)\`.
`;

export const EXCEPTIONAL_POINTS = [
    { id: 'EP1', key: 'ep1Residue', x: 3, y: 2, defaultResidue: 2.5 },
    { id: 'EP2', key: 'ep2Residue', x: -2, y: 4, defaultResidue: 3.0 },
    { id: 'EP3', key: 'ep3Residue', x: -4, y: -3, defaultResidue: 2.0 },
    { id: 'EP4', key: 'ep4Residue', x: 2, y: -4, defaultResidue: 2.8 }
];
