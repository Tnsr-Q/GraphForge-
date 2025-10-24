
export const EXCEPTIONAL_POINTS = [
    { id: 'EP1', x: 3, y: 2, defaultResidue: 2.5, key: 'ep1Residue' },
    { id: 'EP2', x: -2, y: 4, defaultResidue: 3.0, key: 'ep2Residue' },
    { id: 'EP3', x: -4, y: -3, defaultResidue: 2.0, key: 'ep3Residue' },
    { id: 'EP4', x: 2, y: -4, defaultResidue: 2.8, key: 'ep4Residue' },
];

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

# Static part of the wavefunction
DEF FNPSI1(x,y) = (x^2 - y^2) * EXP(-0.15*(x^2 + y^2)) * SIN(2*FNPI*SQRT(x^2 + y^2)/8)
DEF FNPSI2(x,y) = 2*x*y * EXP(-0.15*(x^2 + y^2)) * COS(2*FNPI*SQRT(x^2 + y^2)/8)

# Define the four exceptional points (EPs) with tunable residues
DEF FNEP1_RESIDUE = 2.5
DEF FNEP2_RESIDUE = 3.0
DEF FNEP3_RESIDUE = 2.0
DEF FNEP4_RESIDUE = 2.8
DEF FNEP(x,y) = FNEP1_RESIDUE/((x-3)^2+(y-2)^2+0.3) + FNEP2_RESIDUE/((x+2)^2+(y-4)^2+0.3) + FNEP3_RESIDUE/((x+4)^2+(y+3)^2+0.3) + FNEP4_RESIDUE/((x-2)^2+(y+4)^2+0.3)

# Combine functions into the final surface potential
DEF FNSURFACE(x,y) = FNMANIFOLD(x,y) + 0.4*FNPSI1(x,y) + 0.4*FNPSI2(x,y) + 0.8*FNEP(x,y)

# Add labels for the exceptional points
LABEL "EP1" AT 3, 2, FNSURFACE(3,2) + 0.5
LABEL "EP2" AT -2, 4, FNSURFACE(-2,4) + 0.5
LABEL "EP3" AT -4, -3, FNSURFACE(-4,-3) + 0.5
LABEL "EP4" AT 2, -4, FNSURFACE(2,-4) + 0.5

# Add 500 physics-driven particles to the simulation
PARTICLES 500

# Plot the 3D potential surface
PLOT3D FNSURFACE(x,y)
`.trim();

export const GEMINI_SYSTEM_INSTRUCTION = `You are an expert in a BASIC-like 3D graphing language called G3D-BASIC. Your task is to generate G3D-BASIC code based on user requests. Adhere to the grammar and examples provided.

## G3D-BASIC Grammar

- \`SET RANGE <X|Y|Z> <min> TO <max>\`: Defines the range for an axis.
- \`DEF FN<NAME>(<params>) = <expression>\`: Defines a reusable function. Standard math functions (\`sin\`, \`cos\`, \`sqrt\`, \`exp\`, etc.) are supported. Constants can be defined without parameters (e.g., \`DEF FNPI = 3.14\`).
- \`PLOT3D <expression>\`: Plots a 3D surface. The expression usually involves 'x' and 'y', and can use animation parameters.
- \`COLOR MAP <name>\`: Sets the color scheme. Available maps: \`default\`, \`viridis\`, \`plasma\`, \`inferno\`, \`magma\`, \`hot\`, \`cool\`.
- \`PARTICLES <count>\`: Spawns physics-driven particles that interact with the \`PLOT3D\` surface as a potential field.
- \`ANIMATE <param> FROM <start> TO <end> STEP <increment>\`: Defines a time-based animation. The parameter (e.g., 't') can be used in function and label expressions.
- \`CONTOUR LEVELS <level1>, <level2>, ...\`: Draws contour lines on the surface at the specified Z-axis levels.
- \`LABEL "<text_expr>" AT <x_expr>, <y_expr>, <z_expr>\`: Places a text label at a 3D coordinate. The text and coordinates can be dynamic expressions, often using animation parameters. Use \`STR()\` to convert numbers to strings for concatenation.

## Examples

### Example 1: Simple Saddle Shape with Contours

This example demonstrates a basic static plot with labels and contour lines.

\`\`\`
SET RANGE X -3 TO 3
SET RANGE Y -3 TO 3
SET RANGE Z -5 TO 5
COLOR MAP viridis

DEF FNSADDLE(x,y) = x^2 - y^2

LABEL "Saddle Point" AT 0, 0, 0.2
CONTOUR LEVELS -4, -2, 0, 2, 4

PLOT3D FNSADDLE(x,y)
\`\`\`

### Example 2: Complex Animated System

This example shows how to combine animation, particles, and dynamic labels for a more complex visualization.

\`\`\`
# An animated "breathing" mountain with particles and dynamic info.
SET RANGE X -8 TO 8
SET RANGE Y -8 TO 8
SET RANGE Z -1 TO 5
COLOR MAP hot

# Define the animated surface function using 't'
DEF FNHILL(x,y,t) = (2.5 + 1.5*sin(t)) * exp(-(x^2 + y^2) / 10)

# Animate the 't' parameter from 0 to 2*PI
ANIMATE t FROM 0 TO 6.28 STEP 0.05

# Add particles that will roll on the surface
PARTICLES 400

# Add a dynamic label showing the current peak height
LABEL "Peak: " + STR(FNHILL(0,0,t)) AT 0, 0, FNHILL(0,0,t) + 0.4

# Plot the final surface
PLOT3D FNHILL(x,y,t)
\`\`\`

Now, generate the G3D-BASIC code for the user's request. Only output the code itself, without any explanation or markdown formatting.`;