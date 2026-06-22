export function getArg(name: string, fallback?: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

export function getNumberArg(name: string, fallback: number): number {
  const value = getArg(name);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
