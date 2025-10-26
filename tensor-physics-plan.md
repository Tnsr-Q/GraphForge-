# Phase 3: Tensor-Aware G3D Generation - Complete Implementation Plan

**Timeline**: 1-2 months | **Effort**: ~100 hours | **Cost**: Primarily prompt engineering + validation

---

## Executive Summary

Enable GraphForge to handle tensor physics through **AI reasoning** rather than backend computation. The model already knows tensor calculus - we just need to teach it the output format and provide scaffolding for complex cases.

---

## Architecture Decision: Hybrid Approach

### **Tier 1: Pure AI Reasoning (70% of use cases)**
Natural language → Enhanced prompt → G3D scalar/vector output

### **Tier 2: AI + Lightweight Compute (25% of use cases)**  
Natural language → AI generates simplified expression → mathjs evaluates → G3D

### **Tier 3: Backend CAS (5% of use cases - future)**
Complex symbolic manipulation → SymPy/EinsteinPy → G3D

**Start with Tier 1 exclusively. Add Tier 2/3 only if demonstrated need.**

---

## Phase 3 Breakdown: 4 Sprints

### **Sprint 1: Tensor Knowledge Injection (Week 1-2)**
### **Sprint 2: Physics Validation & Iteration (Week 3-4)**  
### **Sprint 3: Edge Case Handling (Week 5-6)**
### **Sprint 4: Production Polish (Week 7-8)**

---

# Sprint 1: Tensor Knowledge Injection

**Goal**: Teach the AI to convert tensor expressions → G3D-compatible output

## 1.1 Enhanced System Prompt - Tensor Patterns

**File**: `services/ai/prompts/tensor-system-prompt.ts`

```typescript
export const TENSOR_SYSTEM_PROMPT = `
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
VECTOR_FIELD [FNBX, FNBY, FNBZ] DENSITY 10
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
├─ Is it rank-1 (vector)? → VECTOR_FIELD (if implemented) or plot components
├─ Is it rank-2? 
│  ├─ Symmetric? → Extract eigenvalues (principal values) as scalars
│  ├─ Antisymmetric? → Extract vector (Hodge dual, e.g., F_μν → (E⃗, B⃗))
│  └─ General? → Extract trace, determinant, or Frobenius norm
└─ Is it rank-3+? → Contract indices to reduce rank
   - Contract 2 indices → rank-1 (vector)
   - Contract 4 indices → rank-0 (scalar)

## FINAL CHECKLIST

Before outputting G3D code, verify:
- [ ] All functions use only scalars or vectors (no bare tensors)
- [ ] Coordinate system is Cartesian (x,y,z)
- [ ] Singularities are regularized
- [ ] Physical parameters have reasonable values
- [ ] Labels explain what's being visualized
- [ ] Code is syntactically valid G3D

Now apply these principles to generate G3D for the user's prompt.
`;
```

## 1.2 Physics Domain Knowledge Base

**File**: `services/ai/knowledge/tensor-physics-catalog.ts`

```typescript
export const TENSOR_PHYSICS_CATALOG = {
  general_relativity: {
    schwarzschild: {
      metric: "ds² = -(1-2M/r)dt² + dr²/(1-2M/r) + r²dΩ²",
      ricci_scalar: "R = 0 (vacuum)",
      kretschmann: "K = 48M²/r⁶",
      visualize_as: "kretschmann_scalar"
    },
    kerr: {
      metric: "ds² = -(1-2Mr/Σ)dt² - 4Mra sin²θ/Σ dt dφ + ...",
      kretschmann: "K = 48M²(r²-a²cos²θ)/(r²+a²cos²θ)⁴",
      visualize_as: "kretschmann_scalar"
    },
    flrw: {
      metric: "ds² = -dt² + a(t)²[dr²/(1-kr²) + r²dΩ²]",
      ricci_scalar: "R = 6(ä/a + (ȧ/a)² + k/a²)",
      visualize_as: "scale_factor_evolution"
    }
  },
  
  electromagnetism: {
    field_tensor: {
      definition: "F_μν = ∂_μA_ν - ∂_νA_μ",
      components: "E_i = F_0i, B_i = ε_ijk F_jk/2",
      invariants: ["E² - B²", "E⃗·B⃗"],
      visualize_as: "vector_fields"
    },
    point_charge: {
      electric_field: "E⃗ = kq/r² r̂",
      magnetic_field: "B⃗ = 0",
      visualize_as: "E_vector_field"
    },
    current_wire: {
      electric_field: "E⃗ = 0",
      magnetic_field: "B⃗ = μ₀I/(2πρ) φ̂",
      visualize_as: "B_vector_field"
    }
  },
  
  fluid_dynamics: {
    stress_tensor: {
      definition: "σ_ij = -pδ_ij + τ_ij",
      components: "pressure + viscous stress",
      visualize_as: "pressure_scalar_or_velocity_vector"
    },
    navier_stokes: {
      equation: "ρ(∂v⃗/∂t + v⃗·∇v⃗) = -∇p + μ∇²v⃗",
      visualize_as: "velocity_field_with_vorticity"
    }
  },
  
  quantum_field_theory: {
    stress_energy: {
      scalar_field: "T_μν = ∂_μφ∂_νφ - g_μν(½g^αβ∂_αφ∂_βφ - V(φ))",
      visualize_as: "energy_density_T00"
    },
    dirac_field: {
      stress_energy: "T_μν = i/4(ψ̄γ_μ∂_νψ - ∂_νψ̄γ_μψ + μ↔ν)",
      visualize_as: "probability_density_|ψ|²"
    }
  }
};
```

## 1.3 Validation Test Suite

**File**: `tests/tensor-generation.test.ts`

```typescript
describe('Tensor-Aware G3D Generation', () => {
  const testCases = [
    {
      prompt: "Schwarzschild black hole spacetime curvature",
      expectedElements: [
        "FNKRETSCHMANN",
        "POW",
        "Event Horizon"
      ],
      physicsCheck: (code: string) => {
        // Should contain r^-6 dependence
        return code.includes("POW") && code.includes("3");
      }
    },
    
    {
      prompt: "electromagnetic field around charged particle",
      expectedElements: [
        "VECTOR_FIELD or FNE",
        "1/r²" // Coulomb law
      ],
      physicsCheck: (code: string) => {
        // Should have inverse square law
        return code.includes("POW(") || code.includes("*x*x+");
      }
    },
    
    {
      prompt: "stress-energy tensor in expanding universe",
      expectedElements: [
        "FNRHO", // energy density
        "FNA" // scale factor
      ],
      physicsCheck: (code: string) => {
        // Should have ρ ∝ a^-3 or similar
        return code.includes("POW") && code.includes("3");
      }
    },
    
    {
      prompt: "Ricci flow on 2D surface",
      expectedElements: [
        "ANIMATE",
        "EXP(-" // exponential smoothing
      ],
      physicsCheck: (code: string) => {
        // Should have time evolution
        return code.includes("ANIMATE") && code.includes("t");
      }
    }
  ];
  
  testCases.forEach(({ prompt, expectedElements, physicsCheck }) => {
    it(`should handle: "${prompt}"`, async () => {
      const result = await generateG3DWithTensorSupport(prompt);
      
      // Check for expected syntactic elements
      expectedElements.forEach(element => {
        expect(result.code).toContain(element);
      });
      
      // Check physics correctness
      expect(physicsCheck(result.code)).toBe(true);
      
      // Validate parseable
      expect(() => parseG3D(result.code)).not.toThrow();
    });
  });
});
```

**Sprint 1 Deliverables**:
- ✅ Tensor system prompt integrated
- ✅ Physics knowledge base created
- ✅ Test suite with 10+ physics cases
- ✅ Documentation for prompt patterns

---

# Sprint 2: Physics Validation & Iteration

**Goal**: Test on real physics prompts, measure success rate, iterate

## 2.1 Physics Validation Framework

**File**: `services/validation/physics-validator.ts`

```typescript
interface PhysicsValidation {
  syntaxValid: boolean;
  physicsValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

export async function validatePhysicsG3D(
  prompt: string,
  generatedCode: string
): Promise<PhysicsValidation> {
  const validation: PhysicsValidation = {
    syntaxValid: true,
    physicsValid: true,
    errors: [],
    warnings: [],
    score: 100
  };
  
  // 1. Syntax validation (existing parser)
  try {
    parseG3D(generatedCode);
  } catch (e) {
    validation.syntaxValid = false;
    validation.errors.push(`Syntax error: ${e.message}`);
    validation.score -= 50;
  }
  
  // 2. Dimensional analysis
  const dimensionCheck = checkDimensions(generatedCode, prompt);
  if (!dimensionCheck.valid) {
    validation.warnings.push(`Dimension mismatch: ${dimensionCheck.issue}`);
    validation.score -= 10;
  }
  
  // 3. Singularity check
  if (hasBareDiv isionByZero(generatedCode)) {
    validation.errors.push("Unregularized singularity detected");
    validation.score -= 30;
  }
  
  // 4. Physics heuristics
  const heuristics = applyPhysicsHeuristics(prompt, generatedCode);
  validation.score -= heuristics.penalties;
  validation.warnings.push(...heuristics.warnings);
  
  validation.physicsValid = validation.score > 60;
  
  return validation;
}

function applyPhysicsHeuristics(prompt: string, code: string) {
  const penalties = [];
  const warnings = [];
  
  // If prompt mentions "black hole" but no event horizon label
  if (prompt.match(/black.*hole/i) && !code.includes("Event Horizon")) {
    warnings.push("Expected event horizon marker for black hole");
    penalties.push(5);
  }
  
  // If prompt mentions "electromagnetic" but no vector field
  if (prompt.match(/electromagnetic|E.*field|B.*field/i)) {
    if (!code.match(/VECTOR|FNE|FNB/)) {
      warnings.push("EM field should be vector field");
      penalties.push(10);
    }
  }
  
  // Schwarzschild specific: K ∝ r^-6
  if (prompt.match(/schwarzschild/i)) {
    if (!code.match(/POW\(.*,\s*3\)/)) {
      warnings.push("Schwarzschild Kretschmann should have r^-6 ~ (r²)^-3");
      penalties.push(15);
    }
  }
  
  return {
    penalties: penalties.reduce((a,b) => a+b, 0),
    warnings
  };
}
```

## 2.2 Benchmark Dataset

**File**: `tests/fixtures/tensor-benchmark.json`

```json
{
  "general_relativity": [
    {
      "prompt": "Schwarzschild black hole spacetime curvature",
      "gold_standard": "K = 48M²/(x²+y²+z²)³",
      "difficulty": "medium"
    },
    {
      "prompt": "gravitational waves from binary black hole merger",
      "gold_standard": "h_plus(t,r) ∝ M/r · (1+cos²ι)·cos(2Ωt)",
      "difficulty": "hard"
    },
    {
      "prompt": "geodesic deviation in curved spacetime",
      "gold_standard": "D²ξ/Dτ² = -R^μ_νρσ u^ν u^ρ ξ^σ",
      "difficulty": "hard"
    }
  ],
  
  "electromagnetism": [
    {
      "prompt": "electric field around point charge",
      "gold_standard": "E⃗ = kq/r² r̂",
      "difficulty": "easy"
    },
    {
      "prompt": "magnetic field from current loop",
      "gold_standard": "B⃗ = (μ₀Ia²)/(2(z²+a²)^(3/2)) ẑ",
      "difficulty": "medium"
    }
  ],
  
  "quantum_field_theory": [
    {
      "prompt": "Higgs field symmetry breaking potential",
      "gold_standard": "V(φ) = -μ²φ² + λφ⁴",
      "difficulty": "medium"
    }
  ]
}
```

## 2.3 Iterative Testing Protocol

```bash
# Run benchmark suite
npm run test:tensor-benchmark

# Results stored in test-results/tensor-validation-{date}.json
{
  "overall_success_rate": 0.73,  // 73% pass rate
  "by_difficulty": {
    "easy": 0.95,
    "medium": 0.75,
    "hard": 0.42
  },
  "failures": [
    {
      "prompt": "geodesic deviation...",
      "error": "Failed to reduce rank-4 Riemann tensor",
      "suggested_fix": "Add contraction example to system prompt"
    }
  ]
}
```

**Iteration loop**:
1. Run benchmark (30 test cases)
2. Analyze failures (< 60% physics score)
3. Update system prompt with failure case patterns
4. Re-run benchmark
5. Repeat until success rate > 80%

**Sprint 2 Deliverables**:
- ✅ Validation framework with physics heuristics
- ✅ Benchmark dataset (30+ test cases)
- ✅ Success rate tracking dashboard
- ✅ Iteratively improved to >80% pass rate

---

# Sprint 3: Edge Case Handling

**Goal**: Handle difficult prompts gracefully

## 3.1 Ambiguity Resolution

**Add to system prompt**:
```typescript
## HANDLING AMBIGUOUS PROMPTS

If the user prompt is ambiguous about which tensor component or reduction to visualize:

1. **Choose the most physically meaningful option**
   - Example: "metric tensor" → Visualize Ricci scalar R, not raw g_μν components
   
2. **Provide context in labels explaining the choice**
   - LABEL "Visualizing: Ricci scalar R (spacetime curvature)"
   
3. **For highly ambiguous cases, visualize 2-3 options**
   - Can generate multiple PLOT3D with different reductions
   - Use Z-axis offset to separate them

Example ambiguous prompt: "show me the stress tensor"

Possible interpretations:
- Trace (pressure): Tr(σ) = σ_ii
- Von Mises stress: √((σ₁-σ₂)² + (σ₂-σ₃)² + (σ₃-σ₁)²)/√2
- Principal stresses: eigenvalues σ₁, σ₂, σ₃

Your response: Choose Von Mises (most common in engineering), add label explaining choice.
```

## 3.2 Failure Modes & Fallbacks

**File**: `services/ai/fallback-strategies.ts`

```typescript
export const FALLBACK_STRATEGIES = {
  // If tensor too complex for AI reasoning
  "complex_tensor": {
    action: "suggest_simplification",
    message: (prompt: string) => 
      `The tensor in "${prompt}" is complex. Consider asking for:
       - A specific scalar invariant (e.g., "Kretschmann scalar")
       - A particular component (e.g., "T_00 component")
       - A physical observable (e.g., "energy density")`
  },
  
  // If coordinate system not specified
  "ambiguous_coords": {
    action: "default_cartesian",
    message: () => "Assuming Cartesian coordinates (x,y,z)"
  },
  
  // If prompt is pure math with no physics context
  "abstract_tensor": {
    action: "ask_for_physics_context",
    message: (prompt: string) =>
      `"${prompt}" is mathematically defined but lacks physics context.
       What physical system does this represent?
       (This helps choose the best visualization)`
  }
};
```

## 3.3 User Guidance System

**Add to UI**: Toast notifications for edge cases

```typescript
// In ViewportPanel.tsx after G3D generation
if (generatedCode.includes("FNKRETSCHMANN")) {
  showToast({
    type: "info",
    message: "Visualizing Kretschmann scalar (spacetime curvature invariant)",
    duration: 5000
  });
}

if (validationResult.warnings.length > 0) {
  showToast({
    type: "warning",
    message: `Physics note: ${validationResult.warnings[0]}`,
    action: "See details",
    onClick: () => showValidationPanel(validationResult)
  });
}
```

**Sprint 3 Deliverables**:
- ✅ Ambiguity resolution patterns in prompt
- ✅ Fallback strategies for edge cases
- ✅ User guidance toast system
- ✅ Edge case test suite (10+ tricky prompts)

---

# Sprint 4: Production Polish

**Goal**: Production-ready release

## 4.1 Performance Optimization

```typescript
// Cache expensive tensor computations
class TensorCache {
  private cache = new Map<string, string>();
  
  async getOrGenerate(prompt: string): Promise<string> {
    const cached = this.cache.get(prompt);
    if (cached) return cached;
    
    const result = await generateTensorG3D(prompt);
    this.cache.set(prompt, result);
    return result;
  }
}

// Pre-generate common physics scenarios
const COMMON_SCENARIOS = [
  "schwarzschild black hole",
  "electromagnetic field point charge",
  "stress tensor simple shear"
];

async function prewarmCache() {
  for (const scenario of COMMON_SCENARIOS) {
    await tensorCache.getOrGenerate(scenario);
  }
}
```

## 4.2 Documentation & Examples

**Create**: `docs/tensor-physics-guide.md`

````markdown
# Tensor Physics in GraphForge

GraphForge can visualize tensor expressions from physics through natural language prompts.

## What You Can Visualize

### General Relativity
- Spacetime curvature (Ricci scalar, Kretschmann scalar)
- Black hole metrics (Schwarzschild, Kerr)
- Gravitational waves
- Cosmological models (FLRW)

**Example prompts**:
```
"Schwarzschild black hole spacetime curvature"
"gravitational waves from binary merger"
"expanding universe energy density"
```

### Electromagnetism
- Electric and magnetic fields
- Electromagnetic field tensor components
- Lorentz force dynamics

**Example prompts**:
```
"electric field around point charge"
"magnetic field from current-carrying wire"
"electromagnetic wave propagation"
```

### Fluid Dynamics
- Velocity fields
- Pressure and stress tensors
- Vorticity and turbulence

**Example prompts**:
```
"velocity field around cylinder"
"stress tensor in shear flow"
"turbulent vortex shedding"
```

## How It Works

GraphForge uses AI to:
1. Understand the physics in your prompt
2. Extract relevant tensor components
3. Reduce tensors to visualizable scalars or vectors
4. Generate optimized G3D code

## Tips for Best Results

✅ **Be specific about what you want to see**:
- Good: "Kretschmann scalar for Schwarzschild metric"
- Less good: "show me the metric"

✅ **Mention the physical system**:
- Good: "stress-energy tensor in expanding universe"
- Less good: "stress-energy tensor"

✅ **For vectors, specify the field type**:
- Good: "magnetic field vector from dipole"
- Less good: "field from dipole"
````

## 4.3 Monitoring & Analytics

```typescript
// Track tensor generation metrics
export interface TensorMetrics {
  prompt: string;
  timestamp: Date;
  successGeneration: boolean;
  physicsScore: number;
  renderTime: number;
  userAccepted: boolean; // Did user keep the result or regenerate?
}

async function logTensorGeneration(metrics: TensorMetrics) {
  // Send to analytics
  await analytics.track('tensor_generation', {
    category: identifyPhysicsDomain(metrics.prompt),
    success: metrics.successGeneration,
    score: metrics.physicsScore
  });
}

// Dashboard view
function TensorMetricsDashboard() {
  const [metrics, setMetrics] = useState<TensorMetrics[]>([]);
  
  return (
    <div>
      <h2>Tensor Generation Success Rate: {calculateSuccessRate(metrics)}%</h2>
      <Chart data={metrics} />
      <h3>Common Failure Patterns</h3>
      <ul>
        {identifyFailurePatterns(metrics).map(pattern => (
          <li key={pattern}>{pattern}</li>
        ))}
      </ul>
    </div>
  );
}
```

## 4.4 Release Checklist

**Before shipping**:
- [ ] >80% success rate on benchmark (30+ tests)
- [ ] All edge cases have fallback strategies
- [ ] User documentation complete
- [ ] Performance: Tensor G3D generation <3s
- [ ] Analytics tracking implemented
- [ ] Error messages are actionable
- [ ] Examples in gallery (5+ physics scenarios)

**Sprint 4 Deliverables**:
- ✅ Performance optimizations (caching, prewarming)
- ✅ Complete documentation
- ✅ Analytics and monitoring
- ✅ Gallery of example tensor visualizations
- ✅ Production deployment to Cloud Run

---

# Success Metrics

**Phase 3 Complete When**:
- ✅ Benchmark success rate ≥ 80% (physics correctness)
- ✅ User acceptance rate ≥ 70% (users keep first generation)
- ✅ Avg generation time < 3 seconds
- ✅ Zero crashes on tensor prompts
- ✅ Documentation + 10 gallery examples shipped

---

# Risk Mitigation

| Risk | Probability


Issues to Address
1. Missing Vector Field Implementation Check
Line 116 references VECTOR_FIELD but G3D may not support this yet:
typescript// Add feature detection
const SUPPORTS_VECTOR_FIELD = checkG3DFeature('VECTOR_FIELD');
const vectorVisualization = SUPPORTS_VECTOR_FIELD 
  ? `VECTOR_FIELD [FNBX, FNBY, FNBZ] DENSITY 10`
  : `PLOT3D SQRT(FNBX(x,y,0)*FNBX(x,y,0) + FNBY(x,y,0)*FNBY(x,y,0))`;
2. Animation Performance
Line 138-142 uses ANIMATE which could be expensive:
typescript// Add frame rate control
DEF FNMAX_FPS = 30  # Limit animation framerate
ANIMATE t FROM 0 TO 10 STEP MAX(0.1, 10/FNMAX_FPS)
3. Prompt Injection Vulnerability
The system prompt concatenates user input directly. Add sanitization:
typescriptfunction sanitizeTensorPrompt(userInput: string): string {
  // Remove G3D code blocks to prevent injection
  return userInput.replace(/```g3d[\s\S]*?```/g, '[code removed]')
                  .replace(/DEF FN/gi, 'define function');
}

Completed Risk Mitigation Section
RiskProbabilityImpactMitigation StrategyAI hallucinates incorrect physicsMedium (30%)High• Validate against physics catalog<br>• Cross-check with known solutions (Schwarzschild, Kerr)<br>• Add confidence scoring to flag uncertain outputs<br>• Implement physics validation suite with ground truthPerformance degradation on complex tensorsHigh (50%)Medium• Cache common tensor computations<br>• Implement timeout (3s max)<br>• Fallback to simpler visualization<br>• Progressive enhancement: start simple, add detailCoordinate singularities crash rendererMedium (25%)High• Enforce regularization in all denominators<br>• Bounds checking on function outputs<br>• Clamp extreme values to visualization range<br>• Pre-flight validation before WebGLUsers expect exact tensor componentsLow (15%)Low• Clear documentation about reduction strategies<br>• Toast notifications explaining visualization choices<br>• Option to see reduction math in tooltip<br>• Link to tensor theory docsToken limits hit on complex promptsMedium (30%)Medium• Prompt compression for common patterns<br>• Semantic caching of physics domains<br>• Streaming generation for large outputs<br>• Tier 2 fallback (mathjs) for simple casesPhysics notation ambiguityHigh (60%)Low• Standardize on Einstein notation<br>• Auto-detect notation style (index up/down)<br>• Provide disambiguation UI<br>• Show interpreted equation before vizWebGL memory exhaustionLow (10%)High• Limit grid resolution based on device<br>• Dispose Three.js geometries properly<br>• Monitor GPU memory usage<br>• Graceful degradation to 2D sliceIncorrect physical parametersMedium (35%)Medium• Auto-normalize to visualization scale<br>• Detect and warn about unphysical values<br>• Provide parameter adjustment UI<br>• Default to dimensionless units
Additional Recommendations
1. Add Physics Validation Layer:
typescriptclass PhysicsValidator {
  validateConservationLaws(tensor: TensorExpression): ValidationResult {
    // Check energy-momentum conservation
    // Verify gauge invariance where applicable
    // Ensure positive-definiteness of metrics
  }
}
2. Implement Confidence Scoring:
typescriptinterface TensorGenerationResult {
  g3dCode: string;
  physicsConfidence: number; // 0-1
  reductionMethod: string;
  warnings: string[];
}
3. Progressive Enhancement Strategy:
Start with Tier 1 (pure AI) for MVP, measure success rate, then selectively add Tier 2 compute for specific failure patterns rather than building all tiers upfront.
The plan is production-ready with these mitigations in place. The 80% success rate target is achievable with the current approach.