export function normalizeUsername(input: string): string {
  const trimmed = input.trim();
  const withoutLeadingAt = trimmed.replace(/^@+/, "");
  return withoutLeadingAt ? `@${withoutLeadingAt}` : "";
}

export function displayUsername(input: string | null | undefined, fallback = "Unknown"): string {
  if (!input?.trim()) return fallback;
  return normalizeUsername(input);
}

export function displayUsernameWithoutAt(
  input: string | null | undefined,
  fallback = "Unknown",
): string {
  if (!input?.trim()) return fallback;
  return normalizeUsername(input).replace(/^@/, "");
}

export function usernameLookupCandidates(input: string): string[] {
  const trimmed = input.trim();
  const normalized = normalizeUsername(trimmed);
  const legacy = trimmed.replace(/^@+/, "");
  return Array.from(new Set([trimmed, normalized, legacy].filter(Boolean)));
}
