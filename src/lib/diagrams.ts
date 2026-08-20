/**
 * Diagrams are stored per set so an image attached to Set A, Q1 never leaks
 * into Set B, Q1. Keys look like "s0:q1a". Unprefixed keys are legacy data
 * created before per-set storage and are shown on the first set only.
 */
export function diagramKey(setIndex: number, slotKey: string) {
  return `s${setIndex}:${slotKey}`;
}

export function diagramsForSet(
  diagrams: Record<string, string> | null | undefined,
  setIndex: number,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(diagrams ?? {})) {
    const match = /^s(\d+):(.+)$/.exec(key);
    if (match) {
      if (Number(match[1]) === setIndex) out[match[2]!] = value;
    } else if (setIndex === 0) {
      out[key] = value;
    }
  }
  return out;
}
