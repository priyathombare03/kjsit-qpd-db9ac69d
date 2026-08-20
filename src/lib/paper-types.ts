import type { Bloom } from "./paper-pattern";

export type GeneratedQuestion = {
  key: string;
  text: string;
  bloom: Bloom;
  co: string;
  module: string;
};

export type GeneratedSet = {
  bt: "H" | "M";
  questions: GeneratedQuestion[];
};

export type PaperMeta = {
  courseName: string;
  courseCode: string;
  className: string;
  semester: string;
  academicYear: string;
  date: string;
  marks: 20 | 30;
  department?: string;
  testNumber?: 1 | 2;
  courseOutcomes?: Record<string, string>;
};

export type BtLevel = "H" | "M";

export const btLabel: Record<BtLevel, string> = { H: "BT High", M: "BT Medium" };

export type PaperStatus = "draft" | "sent_to_dqc" | "approved" | "not_approved";

export type PaperRow = {
  id: string;
  status: PaperStatus;
  meta: PaperMeta;
  sets: GeneratedSet[];
  selected_set_index: number | null;
  diagrams: Record<string, string>;
  dqc_note: string | null;
  dqc_signature: string | null;
  created_by: string;
  created_by_id: string | null;
  institution_id: string | null;
  year_level: "SY" | "TY" | "LY" | null;
  academic_year_id: string | null;
  semester_id: string | null;
  created_at: string;
  updated_at: string;
};
