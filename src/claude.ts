import { spawnSync } from "node:child_process";
import { getClaudeBinary, getClaudeEnv, resolveRoleModel, shouldUseClaude } from "./model-config.js";

export type ClaudeRole = "builder" | "critic";

export type ClaudeRunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number | null;
  model: string;
};

function toText(value: string | Buffer | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.toString("utf8");
}

function extractJsonBlock(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) return null;
  const start = Math.min(...starts);
  const opener = trimmed[start];
  const closer = opener === "{" ? "}" : "]";
  const end = trimmed.lastIndexOf(closer);
  if (end <= start) return null;
  return trimmed.slice(start, end + 1).trim();
}

export function parseClaudeJson<T>(text: string): T | null {
  const jsonText = extractJsonBlock(text);
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return null;
  }
}

export function runClaude(role: ClaudeRole, prompt: string): ClaudeRunResult | null {
  if (!shouldUseClaude()) return null;

  const model = resolveRoleModel(role);
  const bin = getClaudeBinary();
  const args = ["-p", prompt, "--model", model];

  const result = spawnSync(bin, args, {
    env: getClaudeEnv(role),
    encoding: "utf8",
    maxBuffer: Number(process.env.LLD_CLAUDE_MAX_BUFFER || 50_000_000)
  });

  return {
    ok: result.status === 0,
    stdout: toText(result.stdout),
    stderr: toText(result.stderr),
    status: result.status,
    model
  };
}

export function shouldFallbackOnClaudeError(): boolean {
  return process.env.LLD_CLAUDE_FALLBACK_ON_ERROR !== "0";
}
