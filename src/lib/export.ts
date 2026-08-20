import logoUrl from "@/assets/svv-logo.png";
import { getPattern, paperInstruction, paperTime } from "./paper-pattern";
import type { GeneratedSet, PaperMeta } from "./paper-types";

type ExportArgs = {
  meta: PaperMeta;
  set: GeneratedSet;
  diagrams?: Record<string, string>;
  signature?: string | null;
  /** Exam-facing copies (coordinator print/download) omit the Course Outcomes block. */
  includeCourseOutcomes?: boolean;
};

async function logoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fileBase(meta: PaperMeta) {
  return `${meta.courseCode || "paper"}-${meta.marks}marks`.replace(/\s+/g, "_");
}

function headerLines(meta: PaperMeta) {
  return [
    "SOMAIYA VIDYAVIHAR UNIVERSITY",
    "K J Somaiya Institute of Technology",
    meta.department || "DEPARTMENT OF ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
    `Academic Year ${meta.academicYear}`,
  ];
}

function metaLines(meta: PaperMeta) {
  return [
    `Class: ${meta.className}    Semester: ${meta.semester}    Date: ${meta.date}`,
    `Course: ${meta.courseName} (${meta.courseCode})`,
    `Marks: ${meta.marks}    Time: ${paperTime(meta.marks)}`,
    `Note: ${paperInstruction(meta.marks)}`,
  ];
}

export async function downloadPdf({ meta, set, diagrams = {}, signature, includeCourseOutcomes = true }: ExportArgs) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const nextPage = (needed = 20) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const logo = await logoDataUrl();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, y, 46, 46);
    } catch {
      /* ignore unsupported logo */
    }
  }

  doc.setFont("times", "bold");
  doc.setFontSize(13);
  headerLines(meta).forEach((line, i) => {
    doc.setFontSize(i === 1 ? 14 : 11);
    doc.text(line, doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
    y += 18;
  });

  y += 6;
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  metaLines(meta).forEach((line) => {
    const wrapped = doc.splitTextToSize(line, width);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 14;
  });

  y += 10;
  for (const slot of getPattern(meta.marks)) {
    const q = set.questions.find((x) => x.key === slot.key);
    const label = `${slot.qNo} ${slot.subQ})`;
    const text = includeCourseOutcomes
      ? `${label} ${q?.text ?? ""}   [${slot.marks} marks | ${q?.co ?? ""} | ${q?.bloom ?? slot.bloom}]`
      : `${label} ${q?.text ?? ""}   [${slot.marks} marks]`;
    const wrapped = doc.splitTextToSize(text, width);
    nextPage(wrapped.length * 14 + 10);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 14 + 6;

    const diagram = diagrams[slot.key];
    if (diagram) {
      try {
        nextPage(170);
        doc.addImage(diagram, "PNG", margin + 10, y, 200, 150);
        y += 160;
      } catch {
        /* skip unsupported image */
      }
    }
  }

  if (includeCourseOutcomes) {
    const cos = meta.courseOutcomes ?? {};
    const targetCOs = (meta.testNumber ?? (meta.marks === 20 ? 1 : 2)) === 1 ? ["CO1", "CO2", "CO3"] : ["CO4", "CO5", "CO6"];
    y += 10;
    nextPage(60);
    doc.setFont("times", "bold");
    doc.text("Course Outcomes:", margin, y);
    y += 16;
    doc.setFont("times", "normal");
    targetCOs.forEach((co) => {
      const wrapped = doc.splitTextToSize(`${co}: ${cos[co] ?? "Not found in syllabus"}`, width);
      nextPage(wrapped.length * 14);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 14;
    });
  }

  if (signature) {
    try {
      nextPage(80);
      y += 10;
      doc.text("DQC Verified", margin, y);
      doc.addImage(signature, "PNG", margin, y + 6, 120, 50);
      y += 70;
    } catch {
      /* ignore */
    }
  }

  doc.save(`${fileBase(meta)}.pdf`);
}

export async function downloadWord({ meta, set, signature, includeCourseOutcomes = true }: ExportArgs) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType } = await import("docx");

  const header = headerLines(meta).map(
    (line, i) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: line, bold: i <= 2, size: i === 1 ? 28 : 22 })],
      }),
  );

  const metaParas = metaLines(meta).map((line) => new Paragraph({ children: [new TextRun({ text: line, size: 22 })] }));

  const rows = [
    new TableRow({
      children: (includeCourseOutcomes
        ? ["Q. No.", "Sub Q.", "Statement of Question", "Marks", "CO", "BT Level"]
        : ["Q. No.", "Sub Q.", "Statement of Question", "Marks"]
      ).map(
        (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
      ),
    }),
    ...getPattern(meta.marks).map((slot) => {
      const q = set.questions.find((x) => x.key === slot.key);
      return new TableRow({
        children: (includeCourseOutcomes
          ? [slot.qNo, slot.subQ, q?.text ?? "", String(slot.marks), q?.co ?? "", q?.bloom ?? slot.bloom]
          : [slot.qNo, slot.subQ, q?.text ?? "", String(slot.marks)]
        ).map(
          (cell) => new TableCell({ children: [new Paragraph(String(cell))] }),
        ),
      });
    }),
  ];

  const cos = meta.courseOutcomes ?? {};
  const targetCOs = (meta.testNumber ?? (meta.marks === 20 ? 1 : 2)) === 1 ? ["CO1", "CO2", "CO3"] : ["CO4", "CO5", "CO6"];

  const doc = new Document({
    sections: [
      {
        children: [
          ...header,
          new Paragraph(" "),
          ...metaParas,
          new Paragraph(" "),
          new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
          new Paragraph(" "),
          ...(includeCourseOutcomes
            ? [
                new Paragraph({ children: [new TextRun({ text: "Course Outcomes:", bold: true })] }),
                ...targetCOs.map((co) => new Paragraph(`${co}: ${cos[co] ?? "Not found in syllabus"}`)),
              ]
            : []),
          new Paragraph(" "),
          new Paragraph(signature ? "DQC Verified (signature attached on the on-screen paper)" : "DQC Member: ______________"),
          new Paragraph("Verified By: Dr. Milind Nemade — Head of the Department"),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase(meta)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
