import { convert, type Request } from "./conversion";
self.onmessage = (event: MessageEvent<Request>) => {
  try {
    self.postMessage(convert(event.data));
  } catch {
    self.postMessage({
      id: event.data.id,
      error: {
        index: -1,
        message: "这次转换未完成。输入已保留，请减少单次内容后重试。",
      },
    });
  }
};
