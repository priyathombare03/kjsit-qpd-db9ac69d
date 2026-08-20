import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PaperRenderer } from "@/components/PaperRenderer";
import { RoleGuard } from "@/components/RoleGuard";
import { fileToDataUrl } from "@/lib/extract";
import { getPattern } from "@/lib/paper-pattern";
import { btLabel, type PaperRow } from "@/lib/paper-types";
import { downloadPdf, downloadWord } from "@/lib/export";
import { getPaper, notify, updatePaper } from "@/lib/papers-db";

export const Route = createFileRoute("/designer/paper/$id")({
  head: () => ({
    meta: [
      { title: "Edit Question Paper — Paper Path" },
      { name: "description", content: "Pick a set, attach diagrams and send the question paper to the DQC." },
      { property: "og:title", content: "Edit Question Paper — Paper Path" },
      { property: "og:description", content: "Finalize one of three generated sets and forward it for quality check." },
    ],
  }),
  component: () => (
    <RoleGuard role="designer">
      <DesignerPaper />
    </RoleGuard>
  ),
});

const btn =
  "rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90";
const btnGhost = "rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent";

function DesignerPaper() {
  const { id } = Route.useParams();
  const [paper, setPaper] = useState<PaperRow | null>(null);
  const [active, setActive] = useState(0);
  const [attachKey, setAttachKey] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPaper(id)
      .then((p) => {
        setPaper(p);
        setActive(p.selected_set_index ?? 0);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load paper"));
  }, [id]);

  if (!paper) return <p className="text-muted-foreground p-8 text-sm">Loading paper…</p>;

  const finalized = paper.selected_set_index !== null;
  const readOnly = paper.status === "sent_to_dqc" || paper.status === "approved";
  const set = paper.sets[active];
  if (!set) return <p className="text-muted-foreground p-8 text-sm">This paper has no generated sets.</p>;

  const refresh = async () => setPaper(await getPaper(id));

  const finalize = async () => {
    await updatePaper(id, { selected_set_index: active, status: "draft", dqc_note: null });
    await refresh();
    toast.success(`Set ${active + 1} finalized.`);
  };

  const sendToDqc = async () => {
    await updatePaper(id, { status: "sent_to_dqc" });
    await notify("dqc@somaiya.edu", id, `New paper for review: ${paper.meta.courseName}`);
    await refresh();
    toast.success("Paper sent to DQC.");
  };

  const onPickImage = async (file?: File) => {
    if (!file || !attachKey) return;
    const dataUrl = await fileToDataUrl(file);
    const diagrams = { ...paper.diagrams, [attachKey]: dataUrl };
    await updatePaper(id, { diagrams });
    setAttachKey(null);
    await refresh();
    toast.success("Diagram attached.");
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{paper.meta.courseName}</h1>
          <p className="text-muted-foreground text-sm">
            {paper.meta.courseCode} · {paper.meta.marks} marks · status: {paper.status.replace(/_/g, " ")}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button
            className={btnGhost}
            onClick={() => downloadPdf({ meta: paper.meta, set, diagrams: paper.diagrams, signature: paper.dqc_signature })}
          >
            Download PDF
          </button>
          <button className={btnGhost} onClick={() => downloadWord({ meta: paper.meta, set, signature: paper.dqc_signature })}>
            Download Word
          </button>
          <button className={btn} disabled={!finalized || readOnly} onClick={sendToDqc}>
            Send to DQC
          </button>
        </div>
      </div>

      {paper.status === "not_approved" && paper.dqc_note && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive mt-4 rounded-lg border p-4 text-sm">
          <b>DQC did not approve this paper.</b> {paper.dqc_note}
        </div>
      )}

      <div className="no-print border-border mt-6 flex flex-wrap gap-1 border-b">
        {paper.sets.map((s, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`px-4 py-2 text-sm font-medium transition ${
              active === i ? "border-brand text-brand border-b-2" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Set {i + 1} · {btLabel[s.bt]}
            {paper.selected_set_index === i ? " ✓" : ""}
          </button>
        ))}
      </div>

      <div className="no-print mt-4 flex flex-wrap items-center gap-3">
        <button className={btn} onClick={finalize} disabled={readOnly || paper.selected_set_index === active}>
          {paper.selected_set_index === active ? "This set is finalized" : "Finalize this set"}
        </button>
        <span className="text-muted-foreground text-xs">
          Click “Attach diagram here if needed” under any question to add an image.
        </span>
      </div>

      <div className="mt-6">
        <PaperRenderer
          meta={paper.meta}
          set={set}
          diagrams={paper.diagrams}
          signatureUrl={paper.dqc_signature}
          setLabel={`Set ${active + 1} — ${btLabel[set.bt]}`}
          showAttachHint={!readOnly}
          onAttachClick={(key) => {
            setAttachKey(key);
            fileRef.current?.click();
          }}
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onPickImage(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {paper.diagrams && Object.keys(paper.diagrams).length > 0 && (
        <div className="no-print text-muted-foreground mt-4 text-xs">
          Diagrams attached to: {getPattern(paper.meta.marks)
            .filter((s) => paper.diagrams[s.key])
            .map((s) => `${s.qNo}(${s.subQ})`)
            .join(", ")}
        </div>
      )}
    </main>
  );
}
