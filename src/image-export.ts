import { exportSvg, layout, type Mode } from "./render";
type ImageOptions = {
  code: string;
  mode: Mode;
  size: number;
  grid: boolean;
  accent: string;
  bg: string;
};
export function imageDimensions(code: string, size: number) {
  return layout(
    code.length,
    size,
    Math.min(16, Math.max(1, code.length / 2)) * size * 5 - size + 8,
  );
}
export async function makeImage(options: ImageOptions): Promise<string> {
  const { code, mode, size, grid, accent, bg } = options;
  if (code.length <= 2000) return exportSvg(code, mode, size, grid, accent, bg);
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./export-worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      reject(
        new Error(
          "此浏览器未允许后台生成大型图像。请复制完整编码，或减少内容后导出。",
        ),
      );
      return;
    }
    const timeout = window.setTimeout(
      () => finish(undefined, "图像生成超时。输入与完整编码已保留。"),
      30000,
    );
    function finish(svg?: string, error?: string) {
      clearTimeout(timeout);
      worker.terminate();
      if (svg) resolve(svg);
      else reject(new Error(error || "图像生成失败，完整编码仍可复制。"));
    }
    worker.onmessage = (event) => finish(event.data.svg, event.data.error);
    worker.onerror = (event) => {
      event.preventDefault();
      finish();
    };
    try {
      worker.postMessage(options);
    } catch {
      finish();
    }
  });
}
