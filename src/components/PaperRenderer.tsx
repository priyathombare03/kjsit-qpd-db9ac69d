import type React from "react";
import logo from "@/assets/svv-logo.png";
import {
  getPattern,
  hasSubQColumn,
  paperInstruction,
  paperTime,
  slotLabel,
  type PatternSlot,
} from "@/lib/paper-pattern";
import type { GeneratedSet, PaperMeta } from "@/lib/paper-types";

export type DiagramMap = Record<string, string>;

export function PaperRenderer({
  meta,
  set,
  diagrams = {},
  signatureUrl,
  showAttachHint = false,
  setLabel,
  onAttachClick,
  examView = false,
}: {
  meta: PaperMeta;
  set: GeneratedSet;
  diagrams?: DiagramMap;
  signatureUrl?: string | null;
  showAttachHint?: boolean;
  setLabel?: string;
  onAttachClick?: (key: string) => void;
  /** Exam-facing copy: hides the CO column and the Course Outcomes footer. */
  examView?: boolean;
}) {
  const pattern = getPattern(meta.marks);
  const showSubQ = hasSubQColumn(meta.marks);
  const dept = meta.department || "DEPARTMENT OF ARTIFICIAL INTELLIGENCE AND DATA SCIENCE";
  const grouped = groupByQ(pattern);

  return (
    <div className="paper-page border-border mx-auto max-w-[820px] border p-10 shadow">
      <div className="mb-4 flex items-start gap-4 border-b border-black pb-4">
        <img src={logo} alt="Somaiya Vidyavihar University crest" className="h-20 w-20 object-contain" />
        <div className="flex-1 text-center">
          <div className="text-[10pt] tracking-widest">SOMAIYA VIDYAVIHAR UNIVERSITY</div>
          <div className="text-[14pt] font-bold">K J Somaiya Institute of Technology</div>
          <div className="text-[10pt] italic">
            An Autonomous Institute permanently affiliated to University of Mumbai.
          </div>
          <div className="mt-2 text-[11pt]">Academic Year {meta.academicYear}</div>
          <div className="mt-1 text-[12pt] font-bold">{dept}</div>
          <div className="mt-1 text-[11pt] font-semibold">Test {meta.testNumber ?? (meta.marks === 20 ? 1 : 2)}</div>
          {setLabel && <div className="text-brand mt-1 text-[10pt] font-semibold">{setLabel}</div>}
        </div>
      </div>

      <table className="mb-3">
        <tbody>
          <tr>
            <td>
              <b>Class:</b> {meta.className}
            </td>
            <td>
              <b>Semester:</b> {meta.semester}
            </td>
            <td colSpan={2}>
              <b>Date:</b> {meta.date}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <b>Course Name:</b> {meta.courseName}
            </td>
            <td colSpan={2}>
              <b>Marks:</b> {meta.marks}
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <b>Course Code:</b> {meta.courseCode}
            </td>
            <td colSpan={2}>
              <b>Time:</b> {paperTime(meta.marks)}
            </td>
          </tr>
          <tr>
            <td colSpan={4}>
              <b>Note:</b> {paperInstruction(meta.marks)}
            </td>
          </tr>
        </tbody>
      </table>

      <table>
        <thead>
          <tr>
            <th style={{ width: showSubQ ? "8%" : "12%" }}>Question No.</th>
            {showSubQ && <th style={{ width: "10%" }}>Sub Question No.</th>}
            <th>Statement of Question</th>
            <th style={{ width: "8%" }}>Marks</th>
            {!examView && <th style={{ width: "8%" }}>CO</th>}
            {!examView && <th style={{ width: "10%" }}>BT Level</th>}
          </tr>
        </thead>
        <tbody>
          {grouped.map((group) => (
            <RenderGroup
              key={group.qNo}
              group={group}
              marks={meta.marks}
              questions={set.questions}
              diagrams={diagrams}
              showAttachHint={showAttachHint}
              onAttachClick={onAttachClick}
              examView={examView}
            />
          ))}
        </tbody>
      </table>


      {!examView && <CourseOutcomesFooter meta={meta} />}

      <div className="mt-8 flex items-end justify-between text-[11pt]">
        <div>
          <div className="w-56 border-t border-black pt-1 text-center">DQC Member</div>
          {signatureUrl && (
            <div className="mt-2">
              <div className="text-xs text-gray-600">DQC Verified</div>
              <img src={signatureUrl} alt="DQC signature" className="h-14 object-contain" />
            </div>
          )}
        </div>
        <div>
          <div>
            Verified By: <b>Dr. Milind Nemade</b>
          </div>
          <div className="mt-1 w-56 border-t border-black pt-1 text-center">Head of the Department</div>
        </div>
      </div>
    </div>
  );
}

type QGroup = { qNo: string; slots: PatternSlot[] };

function groupByQ(pattern: PatternSlot[]): QGroup[] {
  const map = new Map<string, PatternSlot[]>();
  for (const p of pattern) {
    if (!map.has(p.qNo)) map.set(p.qNo, []);
    map.get(p.qNo)!.push(p);
  }
  return Array.from(map.entries()).map(([qNo, slots]) => ({ qNo, slots }));
}

function RenderGroup({
  group,
  marks,
  questions,
  diagrams,
  showAttachHint,
  onAttachClick,
  examView,
}: {
  group: QGroup;
  marks: 20 | 30;
  questions: GeneratedSet["questions"];
  diagrams: DiagramMap;
  showAttachHint?: boolean | undefined;
  onAttachClick?: ((key: string) => void) | undefined;
  examView?: boolean | undefined;
}) {
  const showSubQ = hasSubQColumn(marks);
  const colSpan = 2 + (showSubQ ? 1 : 0) + (examView ? 0 : 2);
  const rows: React.ReactElement[] = [];
  group.slots.forEach((slot, idx) => {
    const q = questions.find((x) => x.key === slot.key);
    const diag = diagrams[slot.key];
    if (slot.isOr) {
      rows.push(
        <tr key={`${slot.key}-or`}>
          <td>{slot.qNo}</td>
          <td colSpan={colSpan} className="text-center font-bold">
            OR
          </td>
        </tr>,
      );
    }
    rows.push(
      <tr key={slot.key}>
        <td>{showSubQ ? (idx === 0 || slot.isOr ? slot.qNo : "") : slotLabel(slot, marks)}</td>
        {showSubQ && <td>{slot.subQ})</td>}
        <td>
          <div>{q?.text ?? ""}</div>
          {diag ? (
            <img src={diag} alt="Attached diagram" className="mt-2 max-h-56 object-contain" />
          ) : showAttachHint ? (
            <button
              type="button"
              onClick={() => onAttachClick?.(slot.key)}
              className="text-brand hover:text-brand/80 no-print mt-2 text-[10pt] italic underline decoration-dotted"
            >
              Attach diagram here if needed
            </button>
          ) : null}
        </td>
        <td className="text-center">{slot.marks}</td>
        {!examView && <td className="text-center">{q?.co ?? ""}</td>}
        {!examView && <td className="text-center">{q?.bloom ?? slot.bloom}</td>}
      </tr>,
    );
  });
  return <>{rows}</>;
}


function CourseOutcomesFooter({ meta }: { meta: PaperMeta }) {
  const testNumber: 1 | 2 = meta.testNumber ?? (meta.marks === 20 ? 1 : 2);
  const targetCOs = testNumber === 1 ? ["CO1", "CO2", "CO3"] : ["CO4", "CO5", "CO6"];
  const all = meta.courseOutcomes ?? {};
  return (
    <div className="mt-6 border-t border-black pt-3 text-[11pt]">
      <div className="mb-1 font-bold">Course Outcomes (Test {testNumber}):</div>
      <table>
        <tbody>
          {targetCOs.map((co) => (
            <tr key={co}>
              <td style={{ width: "10%" }} className="align-top">
                <b>{co}</b>
              </td>
              <td>{all[co] ?? <span className="italic text-gray-500">Not found in syllabus</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
