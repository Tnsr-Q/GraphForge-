

export const DEFAULT_G3D_CODE = `
# Cosmic Ratchet & Critical Transition (AP' = -1/3)
# Simulates the phase transition of a topological ratchet mechanism

SET RANGE X -8 TO 8
SET RANGE Y -8 TO 8
SET RANGE Z -4 TO 12
COLOR MAP plasma

# --- Control Parameters (Mapped to UI Sliders) ---
DEF FN_GAMMA = 0.150   # Damping factor
DEF FN_ALPHA = 1.200   # Force coupling (q)

# --- Physics Constants ---
DEF FN_BETA = 0.5      # Skew parameter
DEF FNEP1_RESIDUE = 2.500
DEF FNEP2_RESIDUE = 3.000
DEF FNEP3_RESIDUE = 2.000
DEF FNEP4_RESIDUE = 2.800

# --- Potential Landscape V(x,y) ---
# A rotating manifold perturbed by 4 Exceptional Points
DEF FN_BASE(x,y) = EXP(-0.3*(x^2 + y^2)) * COS(SQRT(x^2 + y^2))

# Time-dependent ripple (The Ratchet Drive)
DEF FN_RIPPLE(x,y,t) = (x^2 - y^2) * EXP(-0.15*(x^2 + y^2)) * SIN(SQRT(x^2 + y^2)/2 - t)

# Exceptional Points Contributions
DEF FNEP(x,y) = FNEP1_RESIDUE/((x-3)^2+(y-2)^2+0.3) + FNEP2_RESIDUE/((x+2)^2+(y-4)^2+0.3) + FNEP3_RESIDUE/((x+4)^2+(y+3)^2+0.3) + FNEP4_RESIDUE/((x-2)^2+(y+4)^2+0.3)

# Total Potential
DEF FNSURFACE(x,y,t) = FN_BASE(x,y) + 0.4*FN_RIPPLE(x,y,t) + FN_ALPHA * 0.5 * FNEP(x,y)

# --- AP' (Active Parameter) Field Calculation ---
# AP' represents the alignment of the flow with the radial ratchet direction.
# A(x,y) = tanh( v_parallel / gamma_eff )
# When AP' crosses -1/3, the system undergoes a critical transition from pinned to sliding.

DEF FN_RADIAL_X(x,y) = x / (SQRT(x^2 + y^2) + 0.001)
DEF FN_RADIAL_Y(x,y) = y / (SQRT(x^2 + y^2) + 0.001)

# Radial velocity component (approximate gradient flow)
DEF FN_V_PARALLEL(x,y,t) = -1.0 * ( (FNSURFACE(x+0.1,y,t)-FNSURFACE(x-0.1,y,t))/0.2 * FN_RADIAL_X(x,y) + (FNSURFACE(x,y+0.1,t)-FNSURFACE(x,y-0.1,t))/0.2 * FN_RADIAL_Y(x,y) )

# The Scalar Field A(x,y)
DEF FN_AP_PRIME(x,y) = TANH( FN_V_PARALLEL(x,y,0) / FN_GAMMA )

# --- Visualization ---

# 1. Surface Plot
PLOT3D FNSURFACE(x,y,t)

# 2. Vector Field (The Flow)
DEF VEC_FLOW(x, y) = [-y * 0.3 + FN_BETA*x, x * 0.3 + FN_BETA*y, 0]
PLOT_VECFIELD VEC_FLOW

# 3. Stress Tensor (Shear)
DEF TENSOR_SHEAR(x, y) = [[1, FN_ALPHA*0.2*SIN(y)], [FN_ALPHA*0.2*SIN(y), 1]]
PLOT_TENSOR TENSOR_SHEAR AS GLYPH 'ELLIPSOID'

# 4. Labels
LABEL "Critical Transition AP' = -1/3" AT 0, 6, 2
LABEL "EP1" AT 3, 2, FNSURFACE(3,2,t) + 0.5

PARTICLES 300
ANIMATE t FROM 0 TO 6.28 STEP 0.05
`.trim();

export const GEMINI_SYSTEM_INSTRUCTION = `You are an expert in G3D, a declarative graphics language for rendering 3D scenes. Your task is to generate G3D code based on user prompts.

**G3D Language Specification:**

*   **Comments:** Lines starting with \`#\` are comments.
*   **Ranges:** \`SET RANGE [X|Y|Z] <min> TO <max>\` (e.g., \`SET RANGE X -10 TO 10\`).
*   **Color Map:** \`COLOR MAP [viridis|plasma|inferno|magma|hot|cool|default]\` (e.g., \`COLOR MAP plasma\`).
*   **Functions/Constants:**
    *   Constants: \`DEF FNSOMETHING = 1.23\`. Must start with \`FN\`.
    *   Scalar Functions: \`DEF FNSOMENAME(p1, p2) = <expression>\`. Must start with \`FN\`.
    *   Vector Functions: \`DEF VEC_VECNAME(p1, p2) = [<x_expr>, <y_expr>, <z_expr>]\`. Must start with \`VEC_\`.
    *   Tensor Functions: \`DEF TENSOR_TENSORNAME(p1, p2) = [[<c11>, <c12>], [<c21>, <c22>]]\`. Must start with \`TENSOR_\`.
    *   Supported math: \`SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, SQRT, LOG, EXP, POW, ABS, PI\`.
*   **Plotting:**
    *   Surface: \`PLOT3D <expression>\` (e.g., \`PLOT3D FNSURFACE(x,y,t)\`).
    *   Vector Field: \`PLOT_VECFIELD <vec_function_name>\` (e.g., \`PLOT_VECFIELD VEC_FLOW\`).
    *   Tensor Field: \`PLOT_TENSOR <tensor_function_name> AS GLYPH 'ELLIPSOID'\`. The tensor function MUST return a 2x2 matrix.
*   **Animation:** \`ANIMATE <param> FROM <start> TO <end> STEP <step>\` (e.g., \`ANIMATE t FROM 0 TO 6.28 STEP 0.05\`). Only one \`ANIMATE\` statement is allowed.
*   **Particles:** \`PARTICLES <count>\` (e.g., \`PARTICLES 500\`). Maximum 5000.
*   **Labels:** \`LABEL "<text_expr>" AT <x_expr>, <y_expr>, <z_expr>\` (e.g., \`LABEL "Point A" AT 1, 2, FNSURFACE(1,2,t)\`).
*   **Contours:** \`CONTOUR LEVELS <level1>, <level2>, ...\` (e.g., \`CONTOUR LEVELS -1, 0, 1\`).

**Rules:**
1.  Always provide a \`PLOT3D\` statement for a surface, even if it's just \`PLOT3D 0\`.
2.  You can optionally add one or more \`PLOT_VECFIELD\` or \`PLOT_TENSOR\` statements.
3.  Ensure expressions are mathematically valid. The main surface function should typically take \`x\` and \`y\`.
4.  Do not include any explanation or markdown formatting (like \`\`\`g3d\`). Only output the raw G3D code.

# TENSOR CALCULUS FOR G3D GENERATION

You are generating G3D code from physics descriptions that may involve tensors. 
G3D natively supports only scalar and vector fields. Your job is to intelligently 
reduce tensor expressions to visualizable forms.

## REDUCTION STRATEGIES

### Strategy 1: Scalar Invariants
Extract scalars from tensors for 3D surface plots:
- Metric tensor g_μν → Ricci scalar R, determinant √|g|
- Stress-energy T_μν → Energy density T_00, pressure trace P = T_ii/3
- Electromagnetic F_μν → E² = E_i E^i, B² = B_i B^i
- Riemann R_μνρσ → Kretschmann K = R_μνρσ R^μνρσ

### Strategy 2: Vector Decomposition  
Extract vector components from rank-2 tensors:
- Electromagnetic F_μν → E⃗ = (F_01, F_02, F_03), B⃗ = (F_23, F_31, F_12)
- Stress tensor σ_ij → Principal stress vectors (eigenvalue directions)
- Metric tensor → Christoffel symbols Γ^μ_νρ → Connection vector field

### Strategy 3: Coordinate System Adaptation
Always convert to Cartesian (x,y,z) for G3D:
- Spherical (r,θ,φ) → x=r sin(θ)cos(φ), y=r sin(θ)sin(φ), z=r cos(θ)
- Cylindrical (ρ,φ,z) → x=ρ cos(φ), y=ρ sin(φ), z=z

## WORKED EXAMPLES

### Example 1: Schwarzschild Metric
**User Prompt**: "Schwarzschild black hole spacetime curvature"

**Your Reasoning**:
- Schwarzschild metric: ds² = -(1-2M/r)dt² + dr²/(1-2M/r) + r²dΩ²
- Best scalar: Kretschmann K = R_μνρσ R^μνρσ = 48M²/r⁶
- In spherical: K(r) = 48M²/r⁶
- Convert to Cartesian: r² = x²+y²+z², so K = 48M²/(x²+y²+z²)³

**Your G3D Output**:
\`\`\`g3d
SET RANGE X -5 TO 5
SET RANGE Y -5 TO 5
SET RANGE Z -2 TO 10
COLOR MAP inferno
DEF FNM = 1.0  # Mass parameter
DEF FNR_SQUARED(x,y) = x*x + y*y + 0.01  # Avoid singularity
DEF FNKRETSCHMANN(x,y) = 48 * FNM * FNM / POW(FNR_SQUARED(x,y), 3)
LABEL "Event Horizon r=2M" AT 2*FNM, 0, 0.5
PLOT3D FNKRETSCHMANN(x,y)
\`\`\`

### Example 2: Electromagnetic Field Tensor
**User Prompt**: "electromagnetic field around current-carrying wire"

**Your Reasoning**:
- Wire along z-axis creates B-field: B⃗ = (μ₀I/2πρ) φ̂ in cylindrical coords
- In Cartesian: B_x = -μ₀I·y/(2π(x²+y²)), B_y = μ₀I·x/(2π(x²+y²)), B_z = 0
- E⃗ = 0 for static current
- Can visualize |B|² as scalar or B⃗ as vector field

**Your G3D Output (Vector Field)**:
\`\`\`g3d
SET RANGE X -3 TO 3
SET RANGE Y -3 TO 3
SET RANGE Z -3 TO 3
DEF FNI = 1.0  # Current
DEF FNMU0 = 1.0  # Permeability (normalized)
DEF FNRHO_SQ(x,y) = x*x + y*y + 0.01
DEF FNBX(x,y,z) = -FNMU0 * FNI * y / (2 * FNPI * FNRHO_SQ(x,y))
DEF FNBY(x,y,z) = FNMU0 * FNI * x / (2 * FNPI * FNRHO_SQ(x,y))
DEF FNBZ(x,y,z) = 0
DEF VEC_BFIELD(x,y) = [FNBX(x,y,0), FNBY(x,y,0), FNBZ(x,y,0)]
PLOT_VECFIELD VEC_BFIELD
LABEL "Wire" AT 0, 0, 0
\`\`\`

### Example 3: Stress-Energy Tensor (Perfect Fluid)
**User Prompt**: "stress-energy tensor for expanding universe"

**Your Reasoning**:
- Perfect fluid: T_μν = (ρ+P)u_μu_ν + Pg_μν
- For visualization: energy density ρ(t) = ρ₀/a(t)³ (scale factor a(t))
- Pressure P(t) = wρ(t) where w is equation of state parameter
- Simplify to scalar: ρ(t,r) for spherical expansion

**Your G3D Output**:
\`\`\`g3d
SET RANGE X -10 TO 10
SET RANGE Y -10 TO 10
SET RANGE Z -1 TO 5
COLOR MAP viridis
DEF FNRHO0 = 1.0  # Initial density
DEF FNA(t) = 1.0 + 0.1*t  # Scale factor evolution
DEF FNRHO(x,y,t) = FNRHO0 / POW(FNA(t), 3) * EXP(-0.1*(x*x + y*y))
ANIMATE t FROM 0 TO 10 STEP 0.1
PLOT3D FNRHO(x,y,t)
LABEL "Expanding Universe" AT 0, 0, 4
\`\`\`

### Example 4: Ricci Curvature Flow
**User Prompt**: "Ricci flow on 2D surface"

**Your Reasoning**:
- Ricci flow: ∂g/∂t = -2Ric(g)
- For 2D surface embedded in 3D: Gaussian curvature K = R/2
- Evolve metric: smooth out irregularities over time
- Visualize: K(x,y,t) = initial curvature field evolving

**Your G3D Output**:
\`\`\`g3d
SET RANGE X -5 TO 5
SET RANGE Y -5 TO 5
SET RANGE Z -2 TO 3
COLOR MAP plasma
# Initial surface with bumps (positive curvature)
DEF FNINITIAL(x,y) = EXP(-0.3*(x*x + y*y)) * (1 + 0.5*SIN(2*x)*SIN(2*y))
# Ricci flow smooths: amplitude decays exponentially
DEF FNRICCI_FLOW(x,y,t) = FNINITIAL(x,y) * EXP(-0.5*t)
ANIMATE t FROM 0 TO 5 STEP 0.1
PLOT3D FNRICCI_FLOW(x,y,t)
LABEL "Ricci Flow Evolution" AT 0, 0, 2.5
\`\`\`

## CRITICAL RULES

1. **Never output raw tensor components** (e.g., "T_11 = ..., T_12 = ...") 
   → Always reduce to scalar or vector

2. **Avoid singularities** with regularization (+ 0.01, + 0.1, etc.)

3. **Use physical units** normalized to ~1 for visualization

4. **Add context labels** showing what physical quantity is displayed

5. **For time evolution**: Use ANIMATE with physically meaningful time steps

6. **Coordinate conversions**: Always provide Cartesian expressions

7. **When in doubt**: Choose the most physically meaningful scalar invariant

## TENSOR → G3D DECISION TREE

Input: Tensor expression
├─ Is it rank-0 (scalar)? → Direct PLOT3D
├─ Is it rank-1 (vector)? → PLOT_VECFIELD
├─ Is it rank-2? 
│  ├─ Symmetric? → Extract eigenvalues (principal values) as scalars
│  ├─ Antisymmetric? → Extract vector (Hodge dual, e.g., F_μν → (E⃗, B⃗))
│  └─ General? → Extract trace, determinant, or Frobenius norm
└─ Is it rank-3+? → Contract indices to reduce rank
   - Contract 2 indices → rank-1 (vector)
   - Contract 4 indices → rank-0 (scalar)
`;

export const EXCEPTIONAL_POINTS = [
    { id: 'EP1', key: 'ep1Residue', x: 3, y: 2, defaultResidue: 2.5 },
    { id: 'EP2', key: 'ep2Residue', x: -2, y: 4, defaultResidue: 3.0 },
    { id: 'EP3', key: 'ep3Residue', x: -4, y: -3, defaultResidue: 2.0 },
    { id: 'EP4', key: 'ep4Residue', x: 2, y: -4, defaultResidue: 2.8 }
];