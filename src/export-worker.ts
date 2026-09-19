import { exportSvg } from "./render";
self.onmessage = (
  event: MessageEvent<{
    code: string;
    mode: "dots" | "tiles";
    size: number;
    grid: boolean;
    accent: string;
    bg: string;
  }>,
) => {
  try {
    const { code, mode, size, grid, accent, bg } = event.data;
    self.postMessage({ svg: exportSvg(code, mode, size, grid, accent, bg) });
  } catch {
    self.postMessage({ error: "图像生成失败，转换与复制仍然可用。" });
  }
};
