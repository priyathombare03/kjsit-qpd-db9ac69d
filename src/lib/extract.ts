/** Client-side text extraction from uploaded PDF / DOCX / TXT files. */
export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || file.type === "text/plain") {
    return file.text();
  }

  if (name.endsWith(".docx")) {
    // @ts-expect-error - mammoth browser build ships without type declarations
    const mammoth = await import("mammoth/mammoth.browser.js");
    const arrayBuffer = await file.arrayBuffer();
    const result = await (mammoth as any).extractRawText({ arrayBuffer });
    return result.value as string;
  }

  if (name.endsWith(".pdf")) {
    try {
      const pdfjs: any = await import("pdfjs-dist");
      const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data }).promise;
      let out = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        // Keep the original line structure: pdf.js flags the last item of every visual line.
        for (const it of content.items as any[]) {
          out += it.str ?? "";
          if (it.hasEOL) out += "\n";
          else if (it.str && !it.str.endsWith(" ")) out += " ";
        }
        out += "\n";
      }
      if (!out.trim()) {
        throw new Error(`No selectable text found in "${file.name}". It looks like a scanned PDF — upload a DOCX or TXT copy.`);
      }
      return out;
    } catch (e) {
      throw new Error(
        e instanceof Error && e.message.startsWith("No selectable")
          ? e.message
          : `Could not read "${file.name}". Please upload it as DOCX or TXT.`,
      );
    }
  }


  return file.text();
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
