import "./style.css";
import "./workspace.css";
import "./motion.css";
import {
  initMotion,
  setVisible,
  setDisclosure,
  beginMorph,
  stopMorph,
  confirmStatus,
} from "./motion";
import { enc, tobin } from "./core.js";
import coreSource from "./core.js?raw";
import protocolSource from "./protocol.js?raw";
import {
  formatNames,
  readingOrder,
  characterAt,
  characterLabel,
  highlightSource,
} from "./reading";
import "./reading.css";
import { bits, encode, cleanWhitespace } from "./protocol.js";
import {
  convert,
  type Format,
  type Side,
  type Request,
  type Result,
} from "./conversion";
import { renderSvg, saveBlob, savePng, type Mode } from "./render";
import { makeImage, imageDimensions } from "./image-export";
import {
  displayText,
  reconcile,
  replaceRange,
  modelOffset,
} from "./text-model";
import { icon } from "./icons";

const $ = <T extends Element = HTMLElement>(id: string) =>
  document.getElementById(id) as unknown as T;
const raw = $<HTMLTextAreaElement>("raw"),
  code = $<HTMLTextAreaElement>("code");
const editors = { raw, code };
const button = (id: string) => $<HTMLButtonElement>(id);
const text = (id: string, value: string) => {
  if ($(id).textContent !== value) $(id).textContent = value;
};
const show = (id: string, visible: boolean) => {
  setVisible($(id), visible);
};
const storageKey = "eoiles.preferences";
type Preferences = {
  theme: "system" | "light" | "dark";
  format: Format;
  mode: Mode;
  view: "code" | "visual";
  grid: boolean;
};
const prefs: Preferences = {
  theme: "system",
  format: "remap",
  mode: "dots",
  view: "code",
  grid: false,
};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  if (["system", "light", "dark"].includes(saved.theme))
    prefs.theme = saved.theme;
  if (["remap", "native"].includes(saved.format)) prefs.format = saved.format;
  if (["dots", "tiles"].includes(saved.mode)) prefs.mode = saved.mode;
  if (saved.view === "visual") prefs.view = "visual";
  prefs.grid = saved.grid === true;
} catch {
  /* 偏好存储不可用时，基本转换仍然可用。 */
}
const persist = () => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {}
};

type State = {
  raw: string;
  code: string;
  source: Side;
  validRaw: string;
  validCode: string;
  error: Result["error"];
  graphemes: number | null;
  format: Format;
  validFormat: Format;
};
let state: State = {
  raw: "",
  code: "",
  source: "raw",
  validRaw: "",
  validCode: "",
  error: undefined,
  graphemes: 0,
  format: prefs.format,
  validFormat: prefs.format,
};
const history: State[] = [];
let fallbackValue = "";
let actionMessage = "";
let exporting = false;
let busy = false,
  composing: Side | null = null,
  revision = 0,
  latest: Request | null = null;
let lastRendered = "",
  previewFrame = 0,
  announceTimer = 0,
  lessonTimer = 0,
  lessonStep = -1;
let worker: Worker | null = null;
const previewLimit = 256;
const cellSize = 14; // 合适的默认尺寸，按完整码元自动换行。
const feedbackTimers = new Map<string, number>();
let sourceFormat: Format | null = null;
let lessonOffset = 0,
  lessonPart = 0,
  exampleIndex = 0;
const readingExamples = ["A", "中", "😀"];

function remember(snapshot = state) {
  history.push({ ...snapshot });
  while (
    history.length > 40 ||
    (history.length > 1 &&
      history.reduce((sum, s) => sum + s.raw.length + s.code.length, 0) >
        2000000)
  )
    history.shift();
}
function announce(message: string) {
  clearTimeout(announceTimer);
  announceTimer = window.setTimeout(() => text("announcer", message), 500);
}
function writeEditor(side: Side, value: string) {
  const el = editors[side];
  if (el.value === displayText(value)) return;
  const {
    selectionStart,
    selectionEnd,
    selectionDirection,
    scrollTop,
    scrollLeft,
  } = el;
  el.value = value;
  el.setSelectionRange(
    Math.min(selectionStart, el.value.length),
    Math.min(selectionEnd, el.value.length),
    selectionDirection,
  );
  el.scrollTop = scrollTop;
  el.scrollLeft = scrollLeft;
}
function setStatus(message: string, kind = "valid") {
  text("status-text", message);
  text("mobile-status", message);
  $("status-dot").dataset.state = kind;
}
function statusMessage() {
  if (composing) return "正在输入…";
  if (busy) return "正在转换…";
  if (state.error) return "编码待修正";
  if (actionMessage) return actionMessage;
  if (!state.raw && !state.code) return "输入即转换";
  return state.source === "raw" ? "已转换" : "已还原";
}
function refresh() {
  const pending = busy || !!composing;
  text(
    "raw-stats",
    `${pending ? "正在统计…" : state.graphemes === null ? "字符未计数" : state.graphemes + " 个字符"}`,
  );
  text(
    "code-stats",
    `${state.code.length} 个${state.error ? "输入字符" : "盲文字符"}`,
  );
  text(
    "raw-direction",
    state.error
      ? "上次有效原文"
      : state.source === "raw"
        ? "文字 → 编码"
        : "编码 → 文字",
  );
  text("format-badge", formatNames[state.format]);
  text("settings-caption", formatNames[state.format]);
  text("preview-format", formatNames[state.validFormat]);
  text(
    "source-note",
    state.source === "raw"
      ? "保留原文，立即转换。切换可撤销。"
      : "保留编码，立即还原。切换可撤销。",
  );
  for (const format of ["remap", "native"] as const) {
    button(`format-${format}`).setAttribute(
      "aria-pressed",
      String(state.format === format),
    );
    button(`format-${format}`).disabled = !!composing;
  }
  updateSource();
  setStatus(
    statusMessage(),
    state.error ? "error" : pending ? "pending" : "valid",
  );
  code.setAttribute("aria-invalid", String(!!state.error));
  show("error-panel", !!state.error);
  text("error-message", state.error?.message || "");
  text(
    "stale-message",
    state.validCode
      ? "原文和可视化仍对应上一次有效输入，不代表当前错误编码。"
      : "尚无有效结果。修正后会立即继续转换。",
  );
  button("clean").hidden = !/[ \r\n\t]/.test(state.code);
  button("locate-error").hidden = (state.error?.index ?? -1) < 0;
  button("undo").disabled = history.length === 0 || !!composing;
  button("clear").disabled = (!state.raw && !state.code) || !!composing;
  button("example").disabled = !!composing;
  button("copy-code").disabled = !state.code || pending;
  button("mobile-copy").disabled = !state.code || pending;
  button("copy-raw").disabled = !state.raw || pending;
  show("copy-raw", !!state.raw);
  show("clear", !!state.raw || !!state.code);
  show("undo", history.length > 0);
  button("export-toggle").disabled = !state.validCode || pending || exporting;
  button("export-svg").disabled = !state.validCode || pending || exporting;
  button("export-png").disabled = !state.validCode || pending || exporting;
  text(
    "preview-label",
    state.error ? "上次有效结果 · 当前编码待修正" : "同一份编码，不同的形状",
  );
  show("preview-label", !!state.error);
  const count = state.validCode.length;
  text(
    "preview-count",
    count > previewLimit
      ? `预览前 ${previewLimit} / ${count} 个盲文字符 · 复制与导出包含全部`
      : "",
  );
  const cr = state.raw.includes("\r");
  $("raw-stats").title = cr
    ? `原始 CR / CRLF 已保留。按字素簇统计字符；共 ${state.raw.length} 个 UTF-16 码元。`
    : `按字素簇统计字符，包括空格和换行；共 ${state.raw.length} 个 UTF-16 码元。`;
  schedulePreview();
  updateMobileBar();
}
function applyResult(result: Result) {
  if (result.id !== revision || composing) return;
  busy = false;
  if (result.error) {
    state.error = result.error;
    refresh();
    updateLesson();
    announce(result.error.message);
    return;
  }
  state.error = undefined;
  state.raw = result.raw!;
  state.code = result.code!;
  state.validRaw = state.raw;
  state.validCode = state.code;
  state.validFormat = state.format;
  state.graphemes = result.graphemes ?? null;
  // 只更新另一侧，实际编辑的输入框保留 DOM、选区、焦点和滚动位置。
  const target: Side = state.source === "raw" ? "code" : "raw";
  writeEditor(target, state[target]);
  refresh();
  updateLesson();
  announce(
    `${state.source === "raw" ? "编码" : "还原"}完成，${state.code.length} 个盲文字符。`,
  );
}
async function fallback(req: Request) {
  // Worker 不可用时分块让出主线程；异步结果一律检查版本。
  if (req.value.length <= 8000) {
    applyResult(convert(req));
    return;
  }
  const raws: string[] = [],
    codes: string[] = [];
  for (let i = 0; i < req.value.length; i += 4000) {
    if (req.id !== revision) return;
    const part = convert({ ...req, value: req.value.slice(i, i + 4000) });
    if (part.error) {
      const err = { ...part.error, index: part.error.index + i };
      err.message = `第 ${err.index + 1} 个 UTF-16 位置附近：${part.error.message}`;
      applyResult({ id: req.id, error: err });
      return;
    }
    raws.push(part.raw!);
    codes.push(part.code!);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  applyResult({
    id: req.id,
    raw: raws.join(""),
    code: codes.join(""),
    graphemes: null,
  });
}
function requestConversion() {
  const req: Request = {
    id: ++revision,
    source: state.source,
    value: state[state.source],
    format: state.format,
  };
  latest = req;
  if (composing) {
    refresh();
    return;
  }
  busy = req.value.length > 8000;
  if (busy) {
    refresh();
    if (worker) {
      try {
        worker.postMessage(req);
        return;
      } catch {
        worker.terminate();
        worker = null;
      }
    }
    void fallback(req).catch(() =>
      applyResult({
        id: req.id,
        error: {
          index: -1,
          message: "转换未完成，输入已保留。请减少单次内容后重试。",
        },
      }),
    );
  } else applyResult(convert(req));
}
try {
  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (event: MessageEvent<Result>) => applyResult(event.data);
  worker.onerror = (event) => {
    event.preventDefault();
    worker?.terminate();
    worker = null;
    if (latest?.id === revision) void fallback(latest);
  };
} catch {
  worker = null;
}

function edited(side: Side, value: string) {
  if (state[side] === value) return;
  stopMorph();
  remember();
  state[side] = value;
  state.source = side;
  actionMessage = "";
  stopLesson();
  requestConversion();
}
for (const side of ["raw", "code"] as const) {
  const el = editors[side];
  el.addEventListener("compositionstart", () => {
    composing = side;
    revision++;
    refresh();
  });
  el.addEventListener("input", () =>
    edited(side, reconcile(state[side], el.value)),
  );
  el.addEventListener("compositionend", () => {
    state[side] = reconcile(state[side], el.value);
    state.source = side;
    composing = null;
    requestConversion();
  });
  el.addEventListener("paste", (event) => {
    const pasted = event.clipboardData?.getData("text/plain");
    if (!pasted?.includes("\r")) return;
    event.preventDefault();
    const value = replaceRange(
      state[side],
      el.selectionStart,
      el.selectionEnd,
      pasted,
    );
    el.setRangeText(
      displayText(pasted),
      el.selectionStart,
      el.selectionEnd,
      "end",
    );
    edited(side, value);
  });
}
function notify(message: string) {
  confirmStatus();
  actionMessage = message;
  setStatus(
    statusMessage(),
    state.error ? "error" : busy ? "pending" : "valid",
  );
  announce(message);
}
function perform(
  source: Side,
  value: string,
  message: string,
  format = state.format,
) {
  if (composing) return;
  remember();
  actionMessage = "";
  revision++;
  busy = false;
  stopLesson();
  state.source = source;
  state[source] = value;
  state.format = format;
  prefs.format = format;
  persist();
  writeEditor(source, value);
  requestConversion();
  updateLesson();
  notify(message);
}
function undo() {
  if (composing) return;
  const prior = history.pop();
  if (!prior) return;
  revision++;
  busy = false;
  stopLesson();
  state = prior;
  prefs.format = state.format;
  persist();
  writeEditor("raw", state.raw);
  writeEditor("code", state.code);
  actionMessage = "";
  requestConversion();
  updateLesson();
  notify("已撤销");
}
button("undo").onclick = undo;
button("clear").onclick = () => perform(state.source, "", "已清空，可撤销");
const example = () => perform("raw", "把想法，变成另一种形状。", "已载入示例");
button("example").onclick = example;
button("clean").onclick = () =>
  perform("code", cleanWhitespace(state.code), "已清理，可撤销");
button("locate-error").onclick = () => {
  selectView("code");
  code.focus({ preventScroll: true });
  const i = state.error?.index ?? 0;
  code.setSelectionRange(i, i + 1);
  code.scrollIntoView({ block: "nearest" });
};
for (const format of ["remap", "native"] as const)
  button(`format-${format}`).onclick = () => {
    if (composing || format === state.format) return;
    perform(
      state.source,
      state[state.source],
      `已切换：${formatNames[format]}`,
      format,
    );
  };

function updateSource() {
  if (sourceFormat === state.format) return;
  sourceFormat = state.format;
  const natural = state.format === "remap";
  const filename = natural ? "core.js" : "protocol.js";
  const source = natural
    ? coreSource
    : protocolSource.split(/\r?\nexport function validate\(/)[0].trimEnd();
  highlightSource($("core-source"), source);
  text("source-title", `${formatNames[state.format]} · src/${filename}`);
  $<HTMLAnchorElement>("source-link").href =
    `https://github.com/eoiles/eoiles.github.io/blob/master/src/${filename}`;
  text(
    "principle-description",
    natural
      ? "自然顺序把二进制从左列向下放入点阵，再继续右列。解码时按相同顺序取回。"
      : "Unicode 原生直接使用盲文点位的位权。读取时按图中的编号，从高位到低位取回二进制。",
  );
}

async function copy(side: Side, id: string) {
  const value = state[side],
    el = button(id);
  if (!value || busy || composing) return;
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(value);
    clearTimeout(feedbackTimers.get(id));
    el.classList.add("done");
    el.innerHTML = icon("check") + '<span class="button-label">已复制</span>';
    announce(
      side === "code" && state.error
        ? "已复制当前输入，注意其中仍有无效编码。"
        : "已复制完整内容。",
    );
    feedbackTimers.set(
      id,
      window.setTimeout(() => {
        el.classList.remove("done");
        el.innerHTML =
          icon("copy") +
          `<span class="button-label">复制${side === "raw" ? "原文" : "编码"}</span>`;
      }, 1600),
    );
  } catch {
    fallbackValue = value;
    $<HTMLTextAreaElement>("fallback-text").value = value;
    show("copy-fallback", true);
    announce("自动复制未获许可。请使用手动复制区域。");
  }
}
button("copy-raw").onclick = () => void copy("raw", "copy-raw");
button("copy-code").onclick = () => void copy("code", "copy-code");
button("mobile-copy").onclick = () => void copy("code", "mobile-copy");
button("select-fallback").onclick = () => {
  const el = $<HTMLTextAreaElement>("fallback-text");
  el.focus();
  el.select();
};
$<HTMLTextAreaElement>("fallback-text").addEventListener("copy", (event) => {
  if (!event.clipboardData) return;
  const el = $<HTMLTextAreaElement>("fallback-text");
  event.clipboardData.setData(
    "text/plain",
    fallbackValue.slice(
      modelOffset(fallbackValue, el.selectionStart),
      modelOffset(fallbackValue, el.selectionEnd),
    ),
  );
  event.preventDefault();
});
button("close-fallback").onclick = () => show("copy-fallback", false);
// 鼠标/触控按下工具按钮时保留编辑器焦点；键盘导航仍使用正常焦点。
document.addEventListener("pointerdown", (event) => {
  const el = (event.target as Element).closest("[data-keep-focus], summary");
  if (
    el &&
    (document.activeElement === raw || document.activeElement === code) &&
    event.button === 0
  )
    event.preventDefault();
});
function applyTheme() {
  document.documentElement.dataset.theme = prefs.theme;
  $<HTMLSelectElement>("theme").value = prefs.theme;
  const dark =
    prefs.theme === "dark" ||
    (prefs.theme === "system" &&
      matchMedia("(prefers-color-scheme:dark)").matches);
  document.documentElement.dataset.resolvedTheme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')!
    .setAttribute("content", dark ? "#101213" : "#f0f1ee");
}
$<HTMLSelectElement>("theme").onchange = (event) => {
  prefs.theme = (event.target as HTMLSelectElement)
    .value as Preferences["theme"];
  applyTheme();
  persist();
};
matchMedia("(prefers-color-scheme:dark)").addEventListener(
  "change",
  applyTheme,
);
function applyView() {
  const visual = prefs.view === "visual";
  $("code-pane").hidden = visual;
  $("visual-pane").hidden = !visual;
  button("edit-code").hidden = !visual;
  button("mode-code").setAttribute("aria-pressed", String(!visual));
  $("preview-surface").dataset.mode = prefs.mode;
  $("preview-surface").dataset.grid = String(prefs.grid);
  button("mode-dots").setAttribute(
    "aria-pressed",
    String(prefs.view === "visual" && prefs.mode === "dots"),
  );
  button("mode-tiles").setAttribute(
    "aria-pressed",
    String(prefs.view === "visual" && prefs.mode === "tiles"),
  );
  $("preview").setAttribute(
    "aria-label",
    `完整编码的${prefs.mode === "dots" ? "点阵" : "黑白格"}预览${state.validCode.length > previewLimit ? "（只显示前256个盲文字符）" : ""}`,
  );
  text("preview-legend", "黑色为 1 · 白色为 0");
  $<HTMLInputElement>("grid").checked = prefs.grid;
}
// 显示切换只改变结果的呈现；原始编码、最近编辑侧和选区均不改变。
let resultAnimation: Animation | null = null;
let codeScroll = 0;
function selectView(view: "code" | Mode) {
  if (composing === "code") return;
  const visual = view !== "code";
  const wasVisual = prefs.view === "visual";
  if (visual === wasVisual && (!visual || prefs.mode === view)) return;
  if (visual && wasVisual) beginMorph();
  if (!wasVisual) codeScroll = code.scrollTop;
  const codeFocused = document.activeElement === code;
  prefs.view = visual ? "visual" : "code";
  if (visual) prefs.mode = view;
  applyView();
  if (!visual) code.scrollTop = codeScroll;
  // 主动离开编码编辑时，将焦点留在本次触发的视图按钮；原文输入不受影响。
  if (codeFocused && visual)
    button(`mode-${view}`).focus({ preventScroll: true });
  if (wasVisual !== visual) {
    resultAnimation?.cancel();
    if (!matchMedia("(prefers-reduced-motion:reduce)").matches)
      resultAnimation = $(visual ? "visual-pane" : "code-pane").animate(
        [{ opacity: 0.55 }, { opacity: 1 }],
        { duration: 180, easing: "cubic-bezier(.22,.8,.25,1)" },
      );
  }
  renderPreview(true);
  updateMobileBar();
  persist();
  announce(
    `已切换${view === "code" ? "编码文本" : view === "dots" ? "点阵" : "黑白格"}，编码未改变。`,
  );
}
for (const view of ["code", "dots", "tiles"] as const)
  button(`mode-${view}`).onclick = () => selectView(view);
button("edit-code").onclick = () => {
  selectView("code");
  code.focus({ preventScroll: true });
};
$("code-label").onclick = () => selectView("code");
matchMedia("(prefers-reduced-motion:reduce)").addEventListener(
  "change",
  (event) => {
    if (event.matches) resultAnimation?.finish();
  },
);
$<HTMLInputElement>("grid").onchange = (event) => {
  prefs.grid = (event.target as HTMLInputElement).checked;
  applyView();
  persist();
};
function schedulePreview() {
  cancelAnimationFrame(previewFrame);
  previewFrame = requestAnimationFrame(() => renderPreview());
}
function renderPreview(force = false) {
  const value = state.validCode.slice(0, previewLimit);
  if (value !== lastRendered || force) {
    const scroll = $("preview-scroll").scrollTop;
    renderSvg(
      $<SVGSVGElement>("preview"),
      value,
      matchMedia("(max-width:700px)").matches ? 8 : cellSize,
      $("preview-scroll").clientWidth ||
        Math.max(
          1,
          $("result-body").clientWidth -
            parseFloat(getComputedStyle($("visual-pane")).paddingLeft) -
            parseFloat(getComputedStyle($("visual-pane")).paddingRight),
        ),
      true,
    );
    $("preview-scroll").scrollTop = scroll;
    lastRendered = value;
  }
  show("preview", !!value);
  show("preview-empty", !value);
  applyView();
}
new ResizeObserver(() => renderPreview(true)).observe($("result-body"));
$("preview").addEventListener("click", (event) => {
  const group = (event.target as Element).closest<SVGGElement>("[data-unit]");
  if (!group) return;
  const offset = Number(group.dataset.unit);
  lessonOffset = offset;
  lessonPart = offset - characterAt(state.validRaw, offset).index;
  setDisclosure($<HTMLDetailsElement>("reading"), true);
  updateLesson();
});
async function exportImage(kind: "svg" | "png") {
  if (!state.validCode || busy || composing || exporting) return;
  exporting = true;
  refresh();
  const content = state.validCode,
    mode = prefs.mode,
    size = cellSize,
    grid = prefs.grid;
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue("--accent").trim(),
    bg = styles.getPropertyValue("--surface").trim();
  const stale = state.error ? "上一次有效结果" : "完整编码";
  text("export-status", `正在生成${stale}的 ${kind.toUpperCase()}…`);
  try {
    // 先让出一帧显示反馈；导出不裁切或套用预览限量。
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (content.length > 100000)
      throw new Error(
        "完整图像超过 100,000 个盲文字符的导出上限，未生成截断文件。请复制完整编码，或减少单次内容。",
      );
    const dimensions = imageDimensions(content, size);
    if (
      kind === "png" &&
      (dimensions.width * dimensions.height * 4 > 32000000 ||
        dimensions.height * 2 > 16000)
    )
      throw new Error(
        "完整 PNG 超出安全画布尺寸。请改用 SVG，仍会保留全部编码。",
      );
    const svg = await makeImage({
      code: content,
      mode,
      size,
      grid,
      accent,
      bg,
    });
    if (kind === "svg")
      saveBlob(
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
        "eoiles.svg",
      );
    else await savePng(svg);
    text(
      "export-status",
      `已导出${stale} · ${content.length} 个盲文字符，包含前后空白单元。`,
    );
  } catch (error) {
    text(
      "export-status",
      error instanceof Error ? error.message : "导出失败，转换和复制仍然可用。",
    );
  } finally {
    exporting = false;
    refresh();
  }
}
function closeExport(restoreFocus = false) {
  const inside = $("export-menu").contains(document.activeElement);
  show("export-menu", false);
  button("export-toggle").setAttribute("aria-expanded", "false");
  if (restoreFocus && inside)
    button("export-toggle").focus({ preventScroll: true });
}
button("export-toggle").onclick = (event) => {
  const open = button("export-toggle").getAttribute("aria-expanded") !== "true";
  show("export-menu", open);
  button("export-toggle").setAttribute("aria-expanded", String(open));
  if (open && event.detail === 0)
    button("export-png").focus({ preventScroll: true });
};
document.addEventListener("click", (event) => {
  if (!$("export-control").contains(event.target as Node)) closeExport();
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    button("export-toggle").getAttribute("aria-expanded") === "true"
  ) {
    event.preventDefault();
    closeExport(true);
  }
});
for (const kind of ["svg", "png"] as const) {
  button(`export-${kind}`).onclick = () => {
    closeExport(true);
    void exportImage(kind);
  };
}

function selectedUnit() {
  const example = !state.validCode;
  const value = example ? readingExamples[exampleIndex] : state.validRaw;
  const character = characterAt(value, example ? 0 : lessonOffset);
  const part = Math.min(lessonPart, character.text.length - 1);
  const index = character.index + part;
  return {
    value,
    character,
    part,
    index,
    unit: value[index],
    number: value.charCodeAt(index),
    format: example ? state.format : state.validFormat,
    example,
  };
}
function updateCharacterPicker() {
  const { value, character, part, example } = selectedUnit();
  text("reading-context", example ? "试读示例" : "选择文字");
  button("character-prev").hidden = example;
  button("character-next").hidden = example;
  button("character-prev").disabled = character.index === 0;
  button("character-next").disabled = character.end >= value.length;
  const fragment = document.createDocumentFragment();
  const entries = example
    ? readingExamples.map((text, index) => ({ text, index }))
    : (() => {
        const before = [],
          after = [];
        let cursor = character.index;
        for (let i = 0; i < 2 && cursor > 0; i++) {
          const item = characterAt(value, cursor - 1);
          before.unshift(item);
          cursor = item.index;
        }
        cursor = character.end;
        for (let i = 0; i < 2 && cursor < value.length; i++) {
          const item = characterAt(value, cursor);
          after.push(item);
          cursor = item.end;
        }
        return [...before, character, ...after];
      })();
  for (const item of entries) {
    const el = document.createElement("button");
    el.className = "character-choice";
    el.dataset.keepFocus = "";
    el.dataset.character = String(item.index);
    el.textContent = characterLabel(item.text);
    el.title = item.text;
    el.setAttribute(
      "aria-label",
      `查看${example ? "示例" : "文字"} ${characterLabel(item.text)}`,
    );
    el.setAttribute(
      "aria-pressed",
      String(item.index === (example ? exampleIndex : character.index)),
    );
    fragment.append(el);
  }
  // 保留键盘正在操作的选字按钮，不影响主编辑区。
  const focused = $("character-choices").contains(document.activeElement)
    ? (document.activeElement as HTMLElement).dataset.character
    : undefined;
  $("character-choices").replaceChildren(fragment);
  if (focused !== undefined)
    $("character-choices")
      .querySelector<HTMLButtonElement>(`[data-character="${focused}"]`)
      ?.focus({ preventScroll: true });
  show("part-control", character.text.length > 1);
  text(
    "part-label",
    `${characterLabel(character.text)} · 第 ${part + 1} / ${character.text.length} 组`,
  );
  button("part-prev").disabled = part === 0;
  button("part-next").disabled = part === character.text.length - 1;
}
function updateLesson() {
  stopLesson();
  lessonStep = -1;
  const { unit, number, format } = selectedUnit();
  const order = readingOrder(format);
  const stale = state.validCode && (state.error || busy);
  text(
    "reading-format",
    `${stale ? "上次有效结果 · " : ""}${formatNames[format]}`,
  );
  text(
    "reading-description",
    format === "remap"
      ? "先从上到下读左列，再读右列。"
      : "从右下角开始，按编号从高位读到低位。",
  );
  updateCharacterPicker();
  for (const [byte, id, value] of [
    [0, "byte-high", number >> 8],
    [1, "byte-low", number & 255],
  ] as const) {
    $(id).innerHTML =
      `<span class="byte-name">${byte ? "后" : "前"} 8 位</span><span class="byte-bits">${tobin(
        value,
        8,
      )
        .split("")
        .map(
          (bit: string, index: number) =>
            `<span data-bit-step="${byte * 8 + index}" data-on="${bit}">${bit}</span>`,
        )
        .join("")}</span>`;
  }
  const encoded = encode(unit, format),
    svg = $<SVGSVGElement>("reading-svg");
  svg.setAttribute("viewBox", "0 0 340 145");
  svg.dataset.format = format;
  let markup = "";
  for (let byte = 0; byte < 2; byte++)
    bits(encoded[byte]).forEach((on: number, k: number) => {
      const x = 25 + byte * 175 + Math.floor(k / 4) * 65,
        y = 18 + (k % 4) * 33;
      const step = order.indexOf(k);
      markup += `<circle class="lesson-bit" data-on="${on}" data-step="${byte * 8 + step}" data-position="${k}" cx="${x}" cy="${y}" r="8"/><text class="lesson-num" data-number-step="${byte * 8 + step}" x="${x + 15}" y="${y + 4}">${step + 1}</text><path class="lesson-arrow" data-arrow="${byte * 8 + step}" d="M${x - 20} ${y}h8m-4-4 4 4-4 4"/>`;
    });
  svg.innerHTML = markup;
  text("reading-status", "按图中的 1–8 读取，先前 8 位，再后 8 位。");
}
function stopLesson() {
  clearTimeout(lessonTimer);
  lessonTimer = 0;
  button("read-play").innerHTML =
    icon("play") + '<span class="button-label">播放顺序</span>';
}
function stepLesson() {
  lessonStep = (lessonStep + 1) % 16;
  document
    .querySelectorAll<SVGElement>("[data-step]")
    .forEach((el) =>
      el.classList.toggle("active", Number(el.dataset.step) === lessonStep),
    );
  document
    .querySelectorAll<SVGElement>("[data-arrow]")
    .forEach((el) =>
      el.classList.toggle("active", Number(el.dataset.arrow) === lessonStep),
    );
  document
    .querySelectorAll<HTMLElement>("[data-bit-step]")
    .forEach((el) =>
      el.classList.toggle("active", Number(el.dataset.bitStep) === lessonStep),
    );
  document
    .querySelectorAll<SVGElement>("[data-number-step]")
    .forEach((el) =>
      el.classList.toggle(
        "active",
        Number(el.dataset.numberStep) === lessonStep,
      ),
    );
  const { unit, format } = selectedUnit(),
    byte = Math.floor(lessonStep / 8),
    step = lessonStep % 8;
  const k = readingOrder(format)[step];
  const bit = bits(encode(unit, format)[byte])[k];
  text(
    "reading-status",
    `${byte ? "后" : "前"} 8 位 · 第 ${step + 1} 步：${k < 4 ? "左" : "右"}列第 ${(k % 4) + 1} 行，读作 ${bit}。`,
  );
}
button("read-step").onclick = () => {
  stopLesson();
  stepLesson();
};
button("read-reset").onclick = updateLesson;
button("read-play").onclick = () => {
  if (lessonTimer) {
    stopLesson();
    return;
  }
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) {
    stepLesson();
    return;
  }
  if (lessonStep === 15) lessonStep = -1;
  const tick = () => {
    stepLesson();
    if (lessonStep < 15) lessonTimer = window.setTimeout(tick, 500);
    else stopLesson();
  };
  button("read-play").innerHTML =
    icon("pause") + '<span class="button-label">暂停</span>';
  tick();
};
$("character-choices").onclick = (event) => {
  const el = (event.target as Element).closest<HTMLButtonElement>(
    "[data-character]",
  );
  if (!el) return;
  if (state.validCode) lessonOffset = Number(el.dataset.character);
  else exampleIndex = Number(el.dataset.character);
  lessonPart = 0;
  updateLesson();
};
button("character-prev").onclick = () => {
  const { character } = selectedUnit();
  lessonOffset = Math.max(0, character.index - 1);
  lessonPart = 0;
  updateLesson();
};
button("character-next").onclick = () => {
  const { character, value } = selectedUnit();
  lessonOffset = Math.min(value.length - 1, character.end);
  lessonPart = 0;
  updateLesson();
};
button("part-prev").onclick = () => {
  lessonPart = Math.max(0, selectedUnit().part - 1);
  updateLesson();
};
button("part-next").onclick = () => {
  const { part, character } = selectedUnit();
  lessonPart = Math.min(character.text.length - 1, part + 1);
  updateLesson();
};
$("reading").addEventListener("toggle", () => {
  if (!$<HTMLDetailsElement>("reading").open) stopLesson();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopLesson();
});
function updateMobileBar() {
  const rect = button("copy-code").getBoundingClientRect();
  const vp = window.visualViewport;
  const top = vp?.offsetTop ?? 0;
  const bottom = top + (vp?.height ?? window.innerHeight);
  // 悬停位移与子像素取整可能产生约 1px 的边界差，不重复显示复制入口。
  const visible = rect.top >= top - 2 && rect.bottom <= bottom + 2;
  show("mobile-bar", !!(state.raw || state.code) && !visible);
}
let mobileFrame = 0;
window.addEventListener(
  "scroll",
  () => {
    cancelAnimationFrame(mobileFrame);
    mobileFrame = requestAnimationFrame(updateMobileBar);
  },
  { passive: true },
);
function viewportChanged() {
  const vp = window.visualViewport;
  const inset = vp
    ? Math.max(0, window.innerHeight - vp.height - vp.offsetTop)
    : 0;
  document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
  updateMobileBar();
}
window.visualViewport?.addEventListener("resize", viewportChanged);
window.visualViewport?.addEventListener("scroll", viewportChanged);
window.addEventListener("resize", viewportChanged);
document
  .querySelectorAll<HTMLElement>("[data-icon]")
  .forEach((el) => (el.outerHTML = icon(el.dataset.icon!)));
code.placeholder = "编码会出现在这里。\n也可粘贴点阵，立即还原原文。";
const brandCode = enc("eoiles");
text("brand-code", brandCode);
// 品牌小标同样来自默认算法：e 的低字节，不手填装饰编码。
renderSvg($<SVGSVGElement>("logo-mark"), enc("e").slice(1), 7, 22);
applyTheme();
applyView();
refresh();
updateLesson();
viewportChanged();

initMotion();
