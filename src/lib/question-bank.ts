/** Parsing and validation helpers for the uploaded question bank. */

export type BankItem = { text: string; norm: string; tokens: Set<string> };

const STOP = new Set(["the", "a", "an", "of", "and", "or", "to", "in", "for", "is", "are", "with", "on", "by"]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(norm: string): Set<string> {
  return new Set(norm.split(" ").filter((t) => t.length > 2 && !STOP.has(t)));
}

/** Split raw question-bank text into candidate question statements. */
export function parseQuestionBank(raw: string): BankItem[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) =>
      l
        // strip leading numbering / bullets: "1.", "Q3)", "a)", "-", "•"
        .replace(/^\s*(?:[Qq]\s*\.?\s*)?\d+\s*[.):-]\s*/, "")
        .replace(/^\s*[a-hA-H]\s*[.)]\s*/, "")
        .replace(/^\s*[-•*]\s*/, "")
        .trim(),
    )
    .filter(Boolean);

  const seen = new Set<string>();
  const items: BankItem[] = [];
  for (const line of lines) {
    const norm = normalize(line);
    // ignore headings and noise
    if (norm.split(" ").length < 4) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    items.push({ text: line, norm, tokens: tokenize(norm) });
  }
  return items;
}

function similarity(a: BankItem, bNorm: string, bTokens: Set<string>): number {
  if (a.norm === bNorm) return 1;
  if (a.norm.includes(bNorm) || bNorm.includes(a.norm)) return 0.95;
  let hits = 0;
  for (const t of bTokens) if (a.tokens.has(t)) hits += 1;
  const denom = Math.max(1, Math.min(a.tokens.size, bTokens.size));
  return hits / denom;
}

/**
 * Returns the matching bank item when the proposed text genuinely comes from the bank,
 * otherwise null (treated as a hallucination and rejected).
 */
export function matchInBank(bank: BankItem[], proposed: string, threshold = 0.8): BankItem | null {
  const norm = normalize(proposed);
  if (!norm || norm.split(" ").length < 3) return null;
  const tokens = tokenize(norm);
  let best: BankItem | null = null;
  let bestScore = 0;
  for (const item of bank) {
    const score = similarity(item, norm, tokens);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= threshold ? best : null;
}

/**
 * Picks a question from the bank, preferring ones not yet used.
 * Bloom requirements are intentionally ignored here (graceful downgrading);
 * when every bank item is used, it cycles back and reuses instead of fabricating.
 */
export function pickFromBank(bank: BankItem[], used: Set<string>, cursor: { i: number }): BankItem | null {
  if (bank.length === 0) return null;
  for (let step = 0; step < bank.length; step += 1) {
    const item = bank[(cursor.i + step) % bank.length]!;
    if (!used.has(item.norm)) {
      cursor.i = (cursor.i + step + 1) % bank.length;
      used.add(item.norm);
      return item;
    }
  }
  const item = bank[cursor.i % bank.length]!;
  cursor.i = (cursor.i + 1) % bank.length;
  return item;
}
