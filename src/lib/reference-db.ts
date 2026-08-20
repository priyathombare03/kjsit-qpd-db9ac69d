import { supabase } from "@/integrations/supabase/client";

export type YearLevel = "SY" | "TY" | "LY";

export const YEAR_LEVEL_LABEL: Record<YearLevel, string> = {
  SY: "Second Year (SY)",
  TY: "Third Year (TY)",
  LY: "Last Year (LY)",
};

export type Institution = { id: string; code: string; name: string };
export type AcademicYear = { id: string; label: string; is_active: boolean };
export type Semester = { id: string; academic_year_id: string; year_level: YearLevel; label: string };

export async function listInstitutions(): Promise<Institution[]> {
  const { data, error } = await supabase.from("institutions").select("id, code, name").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listAcademicYears(): Promise<AcademicYear[]> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, label, is_active")
    .order("label", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSemesters(academicYearId: string): Promise<Semester[]> {
  const { data, error } = await supabase
    .from("semesters")
    .select("id, academic_year_id, year_level, label")
    .eq("academic_year_id", academicYearId)
    .order("label");
  if (error) throw error;
  return (data ?? []) as Semester[];
}
