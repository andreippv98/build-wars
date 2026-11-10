import { checkCompatibility } from "./compatibility";
import { estimatePower } from "./power";
import { scoreBuild } from "./score";
import type { Build, BuildEvaluation } from "./types";

export { checkCompatibility } from "./compatibility";
export { ENGINE_CONFIG } from "./config";
export { estimatePower } from "./power";
export { scoreBuild } from "./score";
export * from "./types";

/** Everything the UI and the server need for one build, computed once. Pure. */
export function evaluateBuild(build: Build): BuildEvaluation {
  const power = estimatePower(build);
  const issues = checkCompatibility(build, power);
  return {
    issues,
    power,
    score: scoreBuild(build),
    hasErrors: issues.some((issue) => issue.severity === "error"),
  };
}
