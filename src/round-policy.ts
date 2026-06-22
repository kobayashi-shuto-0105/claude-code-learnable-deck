export type RoundPolicy =
  | "initial_build"
  | "structure"
  | "professor_questions"
  | "slide_ordering"
  | "visual_explanation"
  | "source_fidelity"
  | "compression"
  | "polish";

export function getRoundPolicy(round: number, maxRounds: number): RoundPolicy {
  if (round <= 0) return "initial_build";

  if (maxRounds >= 100) {
    if (round <= 5) return "structure";
    if (round <= 15) return "professor_questions";
    if (round <= 30) return "slide_ordering";
    if (round <= 50) return "visual_explanation";
    if (round <= 70) return "source_fidelity";
    if (round <= 90) return "compression";
    return "polish";
  }

  if (round <= 5) return "structure";
  if (round <= 15) return "professor_questions";
  if (round <= 25) return "visual_explanation";
  if (round <= 35) return "source_fidelity";
  if (round <= 45) return "compression";
  return "polish";
}

export function describeRoundPolicy(policy: RoundPolicy): string {
  switch (policy) {
    case "initial_build":
      return "Create the initial DeckSpec from the source.";
    case "structure":
      return "Improve the global structure and learning path.";
    case "professor_questions":
      return "Address Professor Critic questions and missing prerequisites.";
    case "slide_ordering":
      return "Improve slide ordering, splitting, and introductions.";
    case "visual_explanation":
      return "Improve examples, diagrams, comparisons, and visual explanation descriptions.";
    case "source_fidelity":
      return "Strengthen source references and remove unsupported claims.";
    case "compression":
      return "Reduce duplication, shorten wording, and control slide density.";
    case "polish":
      return "Make conservative final polish edits and preserve stable decisions.";
  }
}
