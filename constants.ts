
export const DEFAULT_G3D_CODE = `
# WebGL Quantum Exceptional Point Dynamics
# A particle simulation of a quantum potential landscape with visual effects.

SET RANGE X -8 TO 8
SET RANGE Y -8 TO 8
SET RANGE Z -4 TO 12
COLOR MAP plasma
ANIMATE t FROM 0 TO 12.56 STEP 0.05

# Define the components of the potential function
DEF FNPI = 3.1415926535
DEF FNMANIFOLD(x,y) = EXP(-0.3*(x^2 + y^2)) * COS(SQRT(x^2 + y^2))

# Time-dependent wavefunctions for quantum ripples
DEF FNPSI1_ANIM(x,y,t) = (x^2 - y^2) * EXP(-0.15*(x^2 + y^2)) * SIN(2*FNPI*SQRT(x^2 + y^2)/8 - t)
DEF FNPSI2_ANIM(x,y,t) = 2*x*y * EXP(-0.15*(x^2 + y^2)) * COS(2*FNPI*SQRT(x^2 + y^2)/8 - t)

# Define the four exceptional points (EPs)
DEF FNEP(x,y) = 2.5/((x-3)^2+(y-2)^2+0.3) + 3.0/((x+2)^2+(y-4)^2+0.3) + 2.0/((x+4)^2+(y+3)^2+0.3) + 2.8/((x-2)^2+(y+4)^2+0.3)

# Static part of the surface for labels, including the non-animated part of the wavefunction
DEF FNPSI1_STATIC(x,y) = (x^2 - y^2) * EXP(-0.15*(x^2 + y^2)) * SIN(2*FNPI*SQRT(x^2 + y^2)/8)
DEF FNPSI2_STATIC(x,y) = 2*x*y * EXP(-0.15*(x^2 + y^2)) * COS(2*FNPI*SQRT(x^2 + y^2)/8)
DEF FNSURFACE_STATIC(x,y) = FNMANIFOLD(x,y) + 0.4*FNPSI1_STATIC(x,y) + 0.4*FNPSI2_STATIC(x,y) + 0.8*FNEP(x,y)

# Combine functions into the final animated surface potential
DEF FNSURFACE_ANIM(x,y,t) = FNMANIFOLD(x,y) + 0.4*FNPSI1_ANIM(x,y,t) + 0.4*FNPSI2_ANIM(x,y,t) + 0.8*FNEP(x,y)

# Add labels for the exceptional points, using the static surface for Z coordinate
LABEL "EP1" AT 3, 2, FNSURFACE_STATIC(3,2) + 0.5
LABEL "EP2" AT -2, 4, FNSURFACE_STATIC(-2,4) + 0.5
LABEL "EP3" AT -4, -3, FNSURFACE_STATIC(-4,-3) + 0.5
LABEL "EP4" AT 2, -4, FNSURFACE_STATIC(2,-4) + 0.5

# Add 500 physics-driven particles to the simulation
PARTICLES 500

# Plot the 3D potential surface
PLOT3D FNSURFACE_ANIM(x,y,t)
`.trim();

export const GEMINI_SYSTEM_INSTRUCTION = `You are an expert in a BASIC-like 3D graphing language called G3D-BASIC. Your task is to generate G3D-BASIC code based on user requests.

The G3D-BASIC grammar is as follows:
- SET RANGE <X|Y|Z> <min> TO <max>: Defines the range for an axis.
- DEF FN<NAME>(<param1>,<param2>,...) = <expression>: Defines a reusable function. Standard math operators (+, -, *, /, ^) and functions (sin, cos, tan, sqrt, abs, exp, log) are supported.
- PLOT3D <expression>: Plots a 3D surface based on the expression. The expression usually involves 'x' and 'y'.
- ANIMATE <param> FROM <start> TO <end> STEP <increment>: Defines a time-based animation. The parameter defined here (e.g., 't') can be used in function definitions.
- COLOR MAP <name>: Sets the color scheme for the plot. Available maps: default, viridis, plasma, inferno, magma, hot, cool.
- CONTOUR LEVELS <level1>, <level2>, ...: Draws contour lines on the surface at the specified Z-axis levels.
- LABEL "text" AT <x>, <y>, <z>: Places a text label at the specified 3D coordinate.
- PARTICLES <count>: Spawns a number of physics-driven particles that interact with the PLOT3D surface as a potential field.

Example 1: A simple saddle shape with a labeled center.
\`\`\`
SET RANGE X -2 TO 2
SET RANGE Y -2 TO 2
SET RANGE Z -4 TO 4
COLOR MAP viridis
LABEL "Saddle Point" AT 0, 0, 0.2
DEF FNSADDLE(x,y) = x^2 - y^2
PLOT3D FNSADDLE(x,y)
\`\`\`

Example 2: An animated ripple with particles.
\`\`\`
SET RANGE X -10 TO 10
SET RANGE Y -10 TO 10
SET RANGE Z -1 TO 1
COLOR MAP magma
DEF FNRIPPLE(x,y,t) = sin(sqrt(x^2 + y^2) - t)
ANIMATE t FROM 0 TO 12.56 STEP 0.1
PARTICLES 300
PLOT3D FNRIPPLE(x,y,t)
\`\`\`

Now, generate the G3D-BASIC code for the user's request. Only output the code itself, without any explanation or markdown formatting.`;
