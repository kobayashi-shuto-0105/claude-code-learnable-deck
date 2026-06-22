import "dotenv/config";

export type ModelProfile =
  | "gemma4_31b_thinking"
  | "gpt_oss_120b"
  | "qwen3_coder_next"
  | "direct";

const MODEL_ENV: Record<Exclude<ModelProfile, "direct">, string> = {
  gemma4_31b_thinking: "LLD_MODEL_GEMMA4_31B_THINKING",
  gpt_oss_120b: "LLD_MODEL_GPT_OSS_120B",
  qwen3_coder_next: "LLD_MODEL_QWEN3_CODER_NEXT"
};

const FALLBACK_MODELS: Record<Exclude<ModelProfile, "direct">, string> = {
  gemma4_31b_thinking: "gemma4:31b-thinking",
  gpt_oss_120b: "gpt-oss:120b",
  qwen3_coder_next: "qwen3-coder-next"
};

function normalizeProfile(value: string | undefined): ModelProfile {
  const profile = (value || "qwen3_coder_next").trim();
  if (
    profile === "gemma4_31b_thinking" ||
    profile === "gpt_oss_120b" ||
    profile === "qwen3_coder_next" ||
    profile === "direct"
  ) {
    return profile;
  }
  return "direct";
}

export function resolveModelName(profileValue?: string): string {
  const profile = normalizeProfile(profileValue || process.env.LLD_MODEL_PROFILE);
  if (profile === "direct") {
    return process.env.LLD_MODEL_DIRECT || profileValue || "qwen3-coder-next";
  }
  return process.env[MODEL_ENV[profile]] || FALLBACK_MODELS[profile];
}

export function resolveRoleModel(role: "builder" | "critic"): string {
  const roleProfileEnv = role === "builder" ? "LLD_BUILDER_MODEL_PROFILE" : "LLD_CRITIC_MODEL_PROFILE";
  const roleProfile = process.env[roleProfileEnv];
  return resolveModelName(roleProfile || process.env.LLD_MODEL_PROFILE);
}

export function getClaudeEnv(role: "builder" | "critic"): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || "ollama",
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || "http://localhost:11434",
    ANTHROPIC_MODEL: resolveRoleModel(role)
  };
}

export function getClaudeBinary(): string {
  return process.env.LLD_CLAUDE_BIN || "claude";
}

export function shouldUseClaude(): boolean {
  return process.env.LLD_USE_CLAUDE === "1";
}
