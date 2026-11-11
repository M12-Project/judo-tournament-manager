const normalizeGroupSearch = (value: string) =>
  value
    .normalize("NFC")
    .toLocaleLowerCase("de-DE")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export function matchesGroupSearch(groupName: string, query: string) {
  const searchTokens = normalizeGroupSearch(query);

  if (searchTokens.length === 0) {
    return true;
  }

  const groupTokens = normalizeGroupSearch(groupName);
  return searchTokens.every((token) => groupTokens.includes(token));
}