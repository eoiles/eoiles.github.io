import { encode, decode, validate } from "./protocol.js";
export type Format = "remap" | "native";
export type Side = "raw" | "code";
export type Request = {
  id: number;
  source: Side;
  value: string;
  format: Format;
};
export type Result = {
  id: number;
  raw?: string;
  code?: string;
  graphemes?: number | null;
  error?: { index: number; message: string };
};

export function convert(req: Request): Result {
  const error = req.source === "code" ? validate(req.value) : null;
  if (error) return { id: req.id, error };
  const raw = req.source === "raw" ? req.value : decode(req.value, req.format);
  const code =
    req.source === "code" ? req.value : encode(req.value, req.format);
  // Segmenter 在超长字符串上代价较大；只省略统计，不截断转换。
  let graphemes: number | null = null;
  if (raw.length <= 12000 && typeof Intl.Segmenter === "function") {
    graphemes = 0;
    for (const _ of new Intl.Segmenter("zh", {
      granularity: "grapheme",
    }).segment(raw))
      graphemes++;
  }
  return { id: req.id, raw, code, graphemes };
}
