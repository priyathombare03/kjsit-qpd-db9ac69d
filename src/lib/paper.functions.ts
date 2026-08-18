import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateSets, type GenerateInput } from "./paper-ai.server";

const schema = z.object({
  meta: z.object({
    courseName: z.string(),
    courseCode: z.string(),
    className: z.string(),
    semester: z.string(),
    academicYear: z.string(),
    date: z.string(),
    marks: z.union([z.literal(20), z.literal(30)]),
    department: z.string().optional(),
    testNumber: z.union([z.literal(1), z.literal(2)]).optional(),
  }),
  syllabusText: z.string().min(1),
  questionBankText: z.string().min(1),
});

export const generatePaper = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => generateSets(data as GenerateInput));
