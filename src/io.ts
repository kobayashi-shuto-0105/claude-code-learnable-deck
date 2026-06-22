import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function readText(path: string, fallback = ""): string {
  if (!existsSync(path)) return fallback;
  return readFileSync(path, "utf8");
}

export function writeText(path: string, content: string): void {
  ensureDir(dirname(path));
  writeFileSync(path, content);
}

export function resetText(path: string, content = ""): void {
  writeText(path, content);
}

export function appendJsonl(path: string, value: unknown): void {
  ensureDir(dirname(path));
  appendFileSync(path, `${JSON.stringify(value)}\n`);
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeJson(path: string, value: unknown): void {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function copyIfExists(from: string, to: string): void {
  if (!existsSync(from)) return;
  ensureDir(dirname(to));
  copyFileSync(from, to);
}

export function removeIfExists(path: string): void {
  if (!existsSync(path)) return;
  rmSync(path, { recursive: true, force: true });
}

export function deckPath(deckId: string, ...parts: string[]): string {
  return join("outputs", deckId, ...parts);
}

export function nowIso(): string {
  return new Date().toISOString();
}
