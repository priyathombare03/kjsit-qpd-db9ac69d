export type Bloom = "Remember" | "Understand" | "Apply";

export type PatternSlot = {
  key: string;
  qNo: string;
  subQ: string;
  marks: number;
  bloom: Bloom;
  isOr?: boolean;
};

const PATTERN_20: PatternSlot[] = [
  { key: "q1a", qNo: "Q1", subQ: "a", marks: 2, bloom: "Remember" },
  { key: "q1b", qNo: "Q1", subQ: "b", marks: 2, bloom: "Remember" },
  { key: "q1c", qNo: "Q1", subQ: "c", marks: 2, bloom: "Understand" },
  { key: "q1d", qNo: "Q1", subQ: "d", marks: 2, bloom: "Understand" },
  { key: "q1e", qNo: "Q1", subQ: "e", marks: 2, bloom: "Understand" },
  { key: "q2a", qNo: "Q2", subQ: "a", marks: 5, bloom: "Apply" },
  { key: "q2b", qNo: "Q2", subQ: "b", marks: 5, bloom: "Apply" },
];

const PATTERN_30: PatternSlot[] = [
  { key: "q1a", qNo: "Q1", subQ: "a", marks: 2, bloom: "Remember" },
  { key: "q1b", qNo: "Q1", subQ: "b", marks: 2, bloom: "Remember" },
  { key: "q1c", qNo: "Q1", subQ: "c", marks: 2, bloom: "Remember" },
  { key: "q1d", qNo: "Q1", subQ: "d", marks: 2, bloom: "Remember" },
  { key: "q1e", qNo: "Q1", subQ: "e", marks: 2, bloom: "Remember" },
  { key: "q2a", qNo: "Q2", subQ: "a", marks: 5, bloom: "Understand" },
  { key: "q2b", qNo: "Q2", subQ: "b", marks: 5, bloom: "Understand" },
  { key: "q3a", qNo: "Q3", subQ: "a", marks: 10, bloom: "Apply" },
];

export function getPattern(marks: 20 | 30): PatternSlot[] {
  return marks === 20 ? PATTERN_20 : PATTERN_30;
}

export function paperTime(marks: 20 | 30) {
  return marks === 20 ? "1 Hour" : "1 Hour 30 Minutes";
}

export function paperInstruction(marks: 20 | 30) {
  return marks === 20
    ? "All questions are compulsory. Figures to the right indicate full marks. Draw neat labelled diagrams wherever necessary."
    : "All questions are compulsory. Figures to the right indicate full marks. Assume suitable data wherever required and state it clearly.";
}
