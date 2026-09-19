// Textarea 会将 CRLF/CR 显示为 LF；在模型中保留未编辑的原始换行序列。
export const displayText = (text: string) => text.replace(/\r\n?/g, "\n");
export function modelOffset(text: string, offset: number) {
  let i = 0,
    count = 0;
  while (i < text.length && count < offset) {
    if (text[i] === "\r" && text[i + 1] === "\n") i++;
    i++;
    count++;
  }
  return i;
}
export function replaceRange(
  model: string,
  start: number,
  end: number,
  insert: string,
) {
  return (
    model.slice(0, modelOffset(model, start)) +
    insert +
    model.slice(modelOffset(model, end))
  );
}
export function reconcile(model: string, next: string) {
  const old = displayText(model);
  let start = 0,
    end = 0;
  while (
    start < old.length &&
    start < next.length &&
    old[start] === next[start]
  )
    start++;
  while (
    end < old.length - start &&
    end < next.length - start &&
    old[old.length - 1 - end] === next[next.length - 1 - end]
  )
    end++;
  return replaceRange(
    model,
    start,
    old.length - end,
    next.slice(start, next.length - end),
  );
}
