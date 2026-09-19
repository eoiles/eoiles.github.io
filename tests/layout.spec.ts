import { test, expect } from "@playwright/test";
import { enc } from "../src/core.js";

test("mobile conversion fits the first screen and shared result views never shift layout", async ({
  page,
}) => {
  await page.goto("/");
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height });
    await page.locator("#mode-code").click();
    await page.locator("#raw").fill("转换是一切的起点😀");
    await page.evaluate(() => scrollTo(0, 0));
    const metrics = () =>
      page.evaluate(() => {
        const raw = document.querySelector("#raw")!.getBoundingClientRect();
        const copy = document
          .querySelector("#copy-code")!
          .getBoundingClientRect();
        const result = document
          .querySelector("#result-body")!
          .getBoundingClientRect();
        return {
          raw: raw.bottom,
          copy: copy.bottom,
          result: result.bottom,
          top: result.top,
          width: document.documentElement.scrollWidth,
        };
      });
    const before = await metrics();
    expect(before.raw).toBeLessThan(height);
    expect(before.copy).toBeLessThan(height);
    expect(before.result).toBeLessThan(height);
    expect(before.width).toBe(width);
    for (const mode of ["dots", "tiles", "code"]) {
      await page.locator(`#mode-${mode}`).click();
      const after = await metrics();
      expect(after.top).toBeCloseTo(before.top, 1);
      expect(after.result).toBeCloseTo(before.result, 1);
      await expect(page.locator("#code")).toHaveValue(
        enc("转换是一切的起点😀"),
      );
      await expect(page.locator("#raw")).toBeFocused();
    }
    await expect(page.locator("#mobile-bar")).toBeHidden();
  }
});

test("code selection, scroll and decode source survive result view changes", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#code").fill(enc("原文😀\n".repeat(100)));
  await page.locator("#code").evaluate((el: HTMLTextAreaElement) => {
    el.setSelectionRange(12, 20);
    el.scrollTop = 100;
  });
  const read = () =>
    page
      .locator("#code")
      .evaluate((el: HTMLTextAreaElement) => [
        el.selectionStart,
        el.selectionEnd,
        el.scrollTop,
      ]);
  const before = await read();
  await page.locator("#mode-tiles").click();
  await expect(page.locator("#code")).toBeHidden();
  await expect(page.locator("#mode-tiles")).toBeFocused();
  await page.locator("#edit-code").click();
  await expect(page.locator("#code")).toBeFocused();
  expect(await read()).toEqual(before);
  await page.keyboard.insertText(enc("中"));
  const encoded = await page.locator("#code").inputValue();
  await expect(page.locator("#status-text")).toHaveText("已还原");
  expect(encoded).toBe(
    enc("原文😀\n".repeat(100)).slice(0, 12) +
      enc("中") +
      enc("原文😀\n".repeat(100)).slice(20),
  );
  await page.locator("#mode-dots").click();
  await page.locator("#mode-tiles").click();
  await page.reload();
  await expect(page.locator("#mode-tiles")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#raw")).toHaveValue("");
  await page.locator("#edit-code").click();
  await page.locator("#code").fill(enc("粘贴即可还原"));
  await expect(page.locator("#raw")).toHaveValue("粘贴即可还原");
});
