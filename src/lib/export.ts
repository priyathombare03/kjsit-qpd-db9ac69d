import logoUrl from "@/assets/svv-logo.png";
import { getPattern, hasSubQColumn, paperInstruction, paperTime, slotLabel } from "./paper-pattern";
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
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const width = pageW - margin * 2;
  const pad = 5;
  const lh = 13;
  let y = margin;

  const room = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // ---- Header box -------------------------------------------------------
  const headerTop = y;
  const logo = await logoDataUrl();
  let hy = y + 16;
  doc.setFont("times", "bold");
  headerLines(meta).forEach((line, i) => {
    doc.setFont("times", i === 2 ? "bold" : i === 3 ? "normal" : "bold");
    doc.setFontSize(i === 1 ? 14 : i === 0 ? 11 : 10.5);
    doc.text(line, pageW / 2, hy, { align: "center" });
    hy += 16;
  });
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text(`Test ${meta.testNumber ?? (meta.marks === 20 ? 1 : 2)}`, pageW / 2, hy, { align: "center" });
  hy += 10;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin + 8, headerTop + 10, 44, 44);
    } catch {
      /* ignore unsupported logo */
    }
  }
  doc.setLineWidth(0.8);
  doc.rect(margin, headerTop, width, hy - headerTop);
  y = hy;

  // ---- Meta box ---------------------------------------------------------
  doc.setFont("times", "normal");
  doc.setFontSize(10.5);
  const metaTop = y;
  let my = y + pad + 9;
  metaLines(meta).forEach((line) => {
    const wrapped = doc.splitTextToSize(line, width - pad * 2);
    doc.text(wrapped, margin + pad, my);
    my += wrapped.length * lh;
  });
  const metaBottom = my - lh + pad + 3;
  doc.rect(margin, metaTop, width, metaBottom - metaTop);
  y = metaBottom;

  // ---- Question table ---------------------------------------------------
  const showSubQ = hasSubQColumn(meta.marks);
  const cols: { title: string; w: number; align?: "center" }[] = [];
  cols.push({ title: "Question No.", w: showSubQ ? 0.09 * width : 0.12 * width, align: "center" });
  if (showSubQ) cols.push({ title: "Sub Q.", w: 0.08 * width, align: "center" });
  cols.push({ title: "Statement of Question", w: 0 });
  cols.push({ title: "Marks", w: 0.09 * width, align: "center" });
  if (includeCourseOutcomes) {
    cols.push({ title: "CO", w: 0.08 * width, align: "center" });
    cols.push({ title: "BT Level", w: 0.11 * width, align: "center" });
  }
  const fixed = cols.reduce((s, c) => s + c.w, 0);
  const stmtIdx = cols.findIndex((c) => c.w === 0);
  cols[stmtIdx]!.w = width - fixed;

  const xs: number[] = [];
  let acc = margin;
  for (const c of cols) {
    xs.push(acc);
    acc += c.w;
  }

  const drawRow = (cells: (string | null)[], opts: { bold?: boolean; center?: boolean; height?: number } = {}) => {
    doc.setFont("times", opts.bold ? "bold" : "normal");
    doc.setFontSize(10);
    const wrappedCells = cells.map((t, i) =>
      t == null ? [] : (doc.splitTextToSize(String(t), cols[i]!.w - pad * 2) as string[]),
    );
    const lines = Math.max(1, ...wrappedCells.map((w) => w.length));
    const h = Math.max(opts.height ?? 0, lines * lh + pad * 2);
    if (room(h)) {
      /* new page */
    }
    // borders
    doc.setLineWidth(0.6);
    doc.rect(margin, y, width, h);
    cols.forEach((_, i) => {
      if (i > 0) doc.line(xs[i]!, y, xs[i]!, y + h);
    });
    wrappedCells.forEach((wrapped, i) => {
      if (!wrapped.length) return;
      const center = opts.center || cols[i]!.align === "center";
      const tx = center ? xs[i]! + cols[i]!.w / 2 : xs[i]! + pad;
      doc.text(wrapped, tx, y + pad + 9, center ? { align: "center" } : undefined);
    });
    y += h;
    return h;
  };

  drawRow(cols.map((c) => c.title), { bold: true, center: true });

  for (const slot of getPattern(meta.marks)) {
    if (slot.isOr) {
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      const h = lh + pad * 2;
      room(h);
      doc.setLineWidth(0.6);
      doc.rect(margin, y, width, h);
      doc.text("OR", margin + width / 2, y + pad + 9, { align: "center" });
      y += h;
    }
    const q = set.questions.find((x) => x.key === slot.key);
    const cells: (string | null)[] = [];
    cells.push(showSubQ ? slot.qNo : slotLabel(slot, meta.marks));
    if (showSubQ) cells.push(`${slot.subQ})`);
    cells.push(q?.text ?? "");
    cells.push(String(slot.marks));
    if (includeCourseOutcomes) {
      cells.push(q?.co ?? "");
      cells.push(q?.bloom ?? slot.bloom);
    }
    drawRow(cells);

    const diagram = diagrams[slot.key];
    if (diagram) {
      try {
        const h = 160;
        room(h);
        doc.setLineWidth(0.6);
        doc.rect(margin, y, width, h);
        cols.forEach((_, i) => {
          if (i > 0) doc.line(xs[i]!, y, xs[i]!, y + h);
        });
        doc.addImage(diagram, "PNG", xs[stmtIdx]! + pad, y + pad, 200, 150);
        y += h;
      } catch {
        /* skip unsupported image */
      }
    }
  }

  // ---- Course outcomes --------------------------------------------------
  if (includeCourseOutcomes) {
    const cos = meta.courseOutcomes ?? {};
    const targetCOs =
      (meta.testNumber ?? (meta.marks === 20 ? 1 : 2)) === 1 ? ["CO1", "CO2", "CO3"] : ["CO4", "CO5", "CO6"];
    y += 14;
    room(70);
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text("Course Outcomes:", margin, y);
    y += 8;
    const coLabelW = 0.12 * width;
    targetCOs.forEach((co) => {
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(cos[co] ?? "Not found in syllabus", width - coLabelW - pad * 2) as string[];
      const h = wrapped.length * lh + pad * 2;
      room(h);
      doc.setLineWidth(0.6);
      doc.rect(margin, y, width, h);
      doc.line(margin + coLabelW, y, margin + coLabelW, y + h);
      doc.setFont("times", "bold");
      doc.text(co, margin + coLabelW / 2, y + pad + 9, { align: "center" });
      doc.setFont("times", "normal");
      doc.text(wrapped, margin + coLabelW + pad, y + pad + 9);
      y += h;
    });

    y += 24;
    room(80);
    doc.setFont("times", "normal");
    doc.setFontSize(10.5);
    if (signature) {
      try {
        doc.addImage(signature, "PNG", margin, y - 4, 110, 40);
      } catch {
        /* ignore */
      }
      y += 40;
    }
    doc.line(margin, y, margin + 150, y);
    doc.line(pageW - margin - 180, y, pageW - margin, y);
    doc.text("DQC Member", margin + 40, y + 13);
    doc.text("Head of the Department", pageW - margin - 170, y + 13);
    doc.text("Verified By: Dr. Milind Nemade", pageW - margin - 180, y - 6);
  }

  doc.save(`${fileBase(meta)}.pdf`);
}

export async function downloadWord({ meta, set, signature, includeCourseOutcomes = true }: ExportArgs) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } =
    await import("docx");

  const line = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
  const cellBorders = { top: line, bottom: line, left: line, right: line };
  const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

  const boxed = (paragraphs: InstanceType<typeof Paragraph>[]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [new TableCell({ borders: cellBorders, margins: cellMargins, children: paragraphs })],
        }),
      ],
    });

  const header = boxed([
    ...headerLines(meta).map(
      (line2, i) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: line2, bold: i <= 2, size: i === 1 ? 28 : 22 })],
        }),
    ),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `Test ${meta.testNumber ?? (meta.marks === 20 ? 1 : 2)}`, bold: true, size: 22 }),
      ],
    }),
  ]);

  const metaBox = boxed(
    metaLines(meta).map((line2) => new Paragraph({ children: [new TextRun({ text: line2, size: 22 })] })),
  );

  const showSubQ = hasSubQColumn(meta.marks);
  const headCells = [
    "Question No.",
    ...(showSubQ ? ["Sub Question No."] : []),
    "Statement of Question",
    "Marks",
    ...(includeCourseOutcomes ? ["CO", "BT Level"] : []),
  ];
  const colCount = headCells.length;

  const cellOf = (text: string, bold = false, center = false) =>
    new TableCell({
      borders: cellBorders,
      margins: cellMargins,
      children: [
        new Paragraph({
          ...(center ? { alignment: AlignmentType.CENTER } : {}),
          children: [new TextRun({ text, bold })],
        }),
      ],
    });

  const rows = [
    new TableRow({ children: headCells.map((h) => cellOf(h, true, true)) }),
    ...getPattern(meta.marks).flatMap((slot) => {
      const q = set.questions.find((x) => x.key === slot.key);
      const cells = [
        cellOf(showSubQ ? slot.qNo : `${slot.qNo}${slot.subQ}`, false, true),
        ...(showSubQ ? [cellOf(`${slot.subQ})`, false, true)] : []),
        cellOf(q?.text ?? ""),
        cellOf(String(slot.marks), false, true),
        ...(includeCourseOutcomes ? [cellOf(q?.co ?? "", false, true), cellOf(q?.bloom ?? slot.bloom, false, true)] : []),
      ];
      const row = new TableRow({ children: cells });
      if (!slot.isOr) return [row];
      const orIdx = showSubQ ? 2 : 1;
      const orRow = new TableRow({
        children: Array.from({ length: colCount }, (_, i) => cellOf(i === orIdx ? "OR" : "", i === orIdx, i === orIdx)),
      });
      return [orRow, row];
    }),
  ];

  const cos = meta.courseOutcomes ?? {};
  const targetCOs =
    (meta.testNumber ?? (meta.marks === 20 ? 1 : 2)) === 1 ? ["CO1", "CO2", "CO3"] : ["CO4", "CO5", "CO6"];

  const coTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: targetCOs.map(
      (co) =>
        new TableRow({
          children: [cellOf(co, true, true), cellOf(cos[co] ?? "Not found in syllabus")],
        }),
    ),
  });

  const doc = new Document({
    sections: [
      {
        children: [
          header,
          metaBox,
          new Paragraph(" "),
          new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
          new Paragraph(" "),
          ...(includeCourseOutcomes
            ? [
                new Paragraph({ children: [new TextRun({ text: "Course Outcomes:", bold: true })] }),
                coTable,
                new Paragraph(" "),
                new Paragraph(
                  signature ? "DQC Verified (signature attached on the on-screen paper)" : "DQC Member: ______________",
                ),
                new Paragraph("Verified By: Dr. Milind Nemade — Head of the Department"),
              ]
            : []),
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
