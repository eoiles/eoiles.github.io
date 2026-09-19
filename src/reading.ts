import type { Format } from "./conversion";
import { weights } from "./protocol.js";

export const formatNames = { remap: "自然顺序", native: "Unicode 原生" };
// 图中位置始终按左列、右列排列；读取步骤按当前格式的字节高位到低位排列。
export function readingOrder(format: Format): number[] {
  const positions = weights.map((_: number, index: number) => index);
  return format === "native"
    ? positions.sort((a: number, b: number) => weights[b] - weights[a])
    : positions;
}

const segmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;
type Character = { text: string; index: number; end: number };
let lastText = "";
let characters: Character[] = [];
let iterator: Iterator<Intl.SegmentData> | null = null;
export function characterAt(value: string, offset: number): Character {
  const i = Math.max(0, Math.min(value.length - 1, offset));
  if (segmenter) {
    if (value !== lastText || !iterator) {
      lastText = value;
      characters = [];
      iterator = segmenter.segment(value)[Symbol.iterator]();
    }
    // 按需向前分段并缓存边界；避开部分 WebKit 的 containing() 边界不一致。
    // 不对长输入预建完整列表，前后查看也不重复扫描已经走过的文字。
    while (!characters.length || characters[characters.length - 1].end <= i) {
      const next = iterator.next();
      if (next.done) break;
      const { segment, index } = next.value;
      characters.push({ text: segment, index, end: index + segment.length });
    }
    let lo = 0,
      hi = characters.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (characters[mid].end <= i) lo = mid + 1;
      else hi = mid;
    }
    return characters[lo];
  }
  // 旧浏览器至少保持代理对完整，不把 emoji 分成两个不可见选项。
  const start =
    i > 0 &&
    /[\uDC00-\uDFFF]/.test(value[i]) &&
    /[\uD800-\uDBFF]/.test(value[i - 1])
      ? i - 1
      : i;
  const text = String.fromCodePoint(value.codePointAt(start)!);
  return { text, index: start, end: start + text.length };
}
export function characterLabel(value: string) {
  const labels: Record<string, string> = {
    " ": "空格",
    "\n": "换行",
    "\r": "回车",
    "\r\n": "换行",
    "\t": "Tab",
    "\0": "空字符",
  };
  return (
    labels[value] ?? (/^[\u0000-\u001f\u007f]$/.test(value) ? "控制符" : value)
  );
}

// 只为随应用打包的源码着色，保留原始文本；不解析或插入用户输入为 HTML。
export function highlightSource(target: HTMLElement, source: string) {
  const tokens =
    /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(?<keyword>\b(?:export|function|var|const|let|return|for|if|else|import|from)\b)|(?<number>\b(?:0x[\da-fA-F]+|\d+)\b)|(?<call>\b[A-Za-z_$][\w$]*(?=\s*\())/g;
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const match of source.matchAll(tokens)) {
    fragment.append(document.createTextNode(source.slice(cursor, match.index)));
    const span = document.createElement("span");
    span.className =
      "syntax-" +
      Object.keys(match.groups!).find(
        (key) => match.groups![key] !== undefined,
      );
    span.textContent = match[0];
    fragment.append(span);
    cursor = match.index! + match[0].length;
  }
  fragment.append(document.createTextNode(source.slice(cursor)));
  target.replaceChildren(fragment);
}
