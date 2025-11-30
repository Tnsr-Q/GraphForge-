
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