export type Bloom = "Remember" | "Understand" | "Apply";

export type PatternSlot = {
  key: string;
  qNo: string;
  subQ: string;
  marks: number;
  bloom: Bloom;
  /** Render an "OR" separator row immediately before this slot. */
  isOr?: boolean;
};

/** Test pattern 2025-26, 20 marks: Q1 a/b/c, Q2 a/b/c, Q3 a/b — 4 marks each. */
const PATTERN_20: PatternSlot[] = [
  { key: "q1a", qNo: "Q1", subQ: "a", marks: 4, bloom: "Remember" },
  { key: "q1b", qNo: "Q1", subQ: "b", marks: 4, bloom: "Remember" },
  { key: "q1c", qNo: "Q1", subQ: "c", marks: 4, bloom: "Understand" },
  { key: "q2a", qNo: "Q2", subQ: "a", marks: 4, bloom: "Understand" },
  { key: "q2b", qNo: "Q2", subQ: "b", marks: 4, bloom: "Understand" },
  { key: "q2c", qNo: "Q2", subQ: "c", marks: 4, bloom: "Apply" },
  { key: "q3a", qNo: "Q3", subQ: "a", marks: 4, bloom: "Apply" },
  { key: "q3b", qNo: "Q3", subQ: "b", marks: 4, bloom: "Apply" },
];

/** Test pattern 2025-26, 30 marks: Q1 a/b (5 each), Q2 a OR b (10), Q3 a OR b (10). */
const PATTERN_30: PatternSlot[] = [
  { key: "q1a", qNo: "Q1", subQ: "a", marks: 5, bloom: "Remember" },
  { key: "q1b", qNo: "Q1", subQ: "b", marks: 5, bloom: "Understand" },
  { key: "q2a", qNo: "Q2", subQ: "a", marks: 10, bloom: "Understand" },
  { key: "q2b", qNo: "Q2", subQ: "b", marks: 10, bloom: "Apply", isOr: true },
  { key: "q3a", qNo: "Q3", subQ: "a", marks: 10, bloom: "Understand" },
  { key: "q3b", qNo: "Q3", subQ: "b", marks: 10, bloom: "Apply", isOr: true },
];

export function getPattern(marks: 20 | 30): PatternSlot[] {
  return marks === 20 ? PATTERN_20 : PATTERN_30;
}

/** The 20-mark sheet uses a single "Question No." column (Q1a), the 30-mark sheet splits it. */
export function hasSubQColumn(marks: 20 | 30) {
  return marks === 30;
}

export function slotLabel(slot: PatternSlot, marks: 20 | 30) {
  return marks === 20 ? `${slot.qNo}${slot.subQ}` : `${slot.qNo} ${slot.subQ})`;
}

export function paperTime(marks: 20 | 30) {
  return marks === 20 ? "1 hr" : "1 hr 30 min";
}

export function paperInstruction(marks: 20 | 30) {
  return marks === 20
    ? "Solve ANY TWO from Q1, Q2 and ANY ONE from Q3"
    : "All Questions are compulsory.";
}

