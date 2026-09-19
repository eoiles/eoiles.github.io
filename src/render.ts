import { bits } from "./protocol.js";
export type Mode = "dots" | "tiles";
export type Geometry = {
  width: number;
  height: number;
  columns: number;
  size: number;
  pad: number;
  gap: number;
};
export function layout(length: number, size: number, width: number): Geometry {
  const pad = 4,
    gap = size;
  const columns = Math.max(
    1,
    Math.floor((width - pad * 2 + gap) / (size * 4 + gap)),
  );
  return {
    width,
    height: Math.max(
      size * 4 + pad * 2,
      Math.ceil(length / 2 / columns) * (size * 5) - gap + pad * 2,
    ),
    columns,
    size,
    pad,
    gap,
  };
}
export function svgContent(
  code: string,
  geo: Geometry,
  interactive = false,
  start = 0,
): string {
  const { size: s, columns, pad, gap } = geo;
  const out: string[] = [];
  for (let i = start; i < code.length; i += 2) {
    const group = i / 2,
      x = pad + (group % columns) * (4 * s + gap),
      y = pad + Math.floor(group / columns) * 5 * s;
    out.push(
      `<g class="visual-group" transform="translate(${x} ${y})"${interactive ? ` data-unit="${group}" style="--morph-delay:${Math.min(group % columns, 10) * 5}ms"` : ""}>`,
    );
    for (let j = 0; j < 2 && i + j < code.length; j++) {
      out.push(
        `<g class="byte" transform="translate(${j * s * 2} 0)"><rect class="cell-bg" width="${2 * s}" height="${4 * s}"/>`,
      );
      bits(code[i + j]).forEach((bit: number, k: number) =>
        out.push(
          `<rect class="bit" data-on="${bit}" x="${Math.floor(k / 4) * s}" y="${(k % 4) * s}" width="${s}" height="${s}"/>`,
        ),
      );
      out.push(
        `<path class="grid-line" d="M0 0H${s * 2}V${s * 4}H0Z M${s} 0V${s * 4} M0 ${s}H${s * 2} M0 ${s * 2}H${s * 2} M0 ${s * 3}H${s * 2}"/></g>`,
      );
    }
    out.push(
      `<path class="group-line" d="M${s * 4 + gap / 2} 0V${s * 4}"/></g>`,
    );
  }
  return out.join("");
}
const previous = new WeakMap<
  SVGSVGElement,
  { code: string; size: number; width: number }
>();
export function renderSvg(
  el: SVGSVGElement,
  code: string,
  size: number,
  width: number,
  interactive = false,
) {
  const geo = layout(
    code.length,
    size,
    Math.max(4 * size + 8, Math.floor(width)),
  );
  el.setAttribute("viewBox", `0 0 ${geo.width} ${geo.height}`);
  el.setAttribute("width", String(geo.width));
  el.setAttribute("height", String(geo.height));
  const old = previous.get(el);
  if (interactive && old && old.size === size && old.width === geo.width) {
    // 连续输入只更新改变的点；保留既有单元、坐标与正在进行的形态转换。
    for (let i = 0; i < Math.min(old.code.length, code.length); i++) {
      if (old.code[i] === code[i]) continue;
      const byte =
        el.children[Math.floor(i / 2)].querySelectorAll(".byte")[i % 2];
      const cells = byte.querySelectorAll(".bit");
      bits(code[i]).forEach((bit: number, k: number) =>
        cells[k].setAttribute("data-on", String(bit)),
      );
    }
    const count = Math.ceil(code.length / 2);
    while (el.children.length > count) el.lastElementChild!.remove();
    if (code.length > old.code.length)
      el.insertAdjacentHTML(
        "beforeend",
        svgContent(code, geo, true, old.code.length),
      );
  } else el.innerHTML = svgContent(code, geo, interactive);
  previous.set(el, { code, size, width: geo.width });
  return geo;
}
export function exportSvg(
  code: string,
  mode: Mode,
  size: number,
  grid: boolean,
  accent: string,
  bg: string,
): string {
  // 固定为整码元换行，包含全部字符和空白单元；与预览上限无关。
  const width =
    Math.min(16, Math.max(1, code.length / 2)) * size * 5 - size + 8;
  const geo = layout(code.length, size, width);
  const dot = mode === "dots";
  const style = `.bit{fill:${dot ? "#81948a" : "#fff"};${dot ? "transform-box:fill-box;transform-origin:center;transform:scale(.68);rx:50%" : "shape-rendering:crispEdges"}}.bit[data-on="1"]{fill:${dot ? accent : "#000"}}.cell-bg{fill:#fff;opacity:${dot ? "0" : "1"}}.grid-line{fill:none;stroke:#788880;stroke-width:.65;opacity:${grid ? ".5" : "0"}}.group-line{fill:none;stroke:#788880;stroke-width:.75;stroke-dasharray:2 3;opacity:${grid ? ".45" : "0"}}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${geo.width}" height="${geo.height}" viewBox="0 0 ${geo.width} ${geo.height}"><title>eoiles · ${code.length} braille characters</title><style>${style}</style><rect width="100%" height="100%" fill="${dot ? bg : "#fff"}"/>${svgContent(code, geo)}</svg>`;
}
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function savePng(svg: string) {
  const doc = new DOMParser().parseFromString(
    svg,
    "image/svg+xml",
  ).documentElement;
  const width = Number(doc.getAttribute("width")) * 2,
    height = Number(doc.getAttribute("height")) * 2;
  if (width * height > 32000000 || height > 16000 || width > 16000)
    throw new Error(
      "完整 PNG 超出安全画布尺寸。请改用 SVG，仍会保留全部编码。",
    );
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器无法创建 PNG。请使用 SVG。");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("PNG 生成失败，请使用 SVG。")),
        "image/png",
      ),
    );
    saveBlob(blob, "eoiles.png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
