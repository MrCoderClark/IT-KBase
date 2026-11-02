/** Marker placed in step body where an imported screenshot belongs (document order). */
export const STEP_IMG_MARK = "@@TB_IMG@@";

export type StepImagePiece =
  | { type: "text"; text: string }
  | { type: "image"; url: string };

/**
 * Split a step's body markers + images[] into ordered pieces for article blocks.
 * Orphan images (no marker) append after the text — legacy imports.
 */
export function stepImagePieces(body: string, images: string[] = []): StepImagePiece[] {
  const urls = images.map((item) => item.trim()).filter(Boolean);
  const parts = body.replace(/\r\n/g, "\n").split(STEP_IMG_MARK);
  const pieces: StepImagePiece[] = [];
  let img = 0;

  const pushText = (text: string) => {
    if (text.trim()) pieces.push({ type: "text", text });
  };

  pushText(parts[0] ?? "");
  for (let i = 1; i < parts.length; i++) {
    if (img < urls.length) {
      pieces.push({ type: "image", url: urls[img]! });
      img += 1;
    }
    pushText(parts[i] ?? "");
  }
  while (img < urls.length) {
    pieces.push({ type: "image", url: urls[img]! });
    img += 1;
  }
  return pieces;
}

/** Hide markers in the editor so authors don't see the sentinel. */
export function bodyWithoutImageMarks(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .split(STEP_IMG_MARK)
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}
