import { test, expect } from "@playwright/test";
import { enc } from "../src/core.js";

test("live SVG edits preserve existing cells and match all current bits", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#raw").fill("A中😀");
  await expect(page.locator("#preview .byte")).toHaveCount(8);
  await page
    .locator("#preview .bit")
    .first()
    .evaluate((el) => el.setAttribute("data-retained", "yes"));
  for (const raw of ["B中😀 é", "B", "B\u0000😀\t", "", "恢复"]) {
    await page.locator("#raw").fill(raw);
    await expect(page.locator("#code")).toHaveValue(enc(raw));
    await expect(page.locator("#preview .byte")).toHaveCount(raw.length * 2);
    const rendered = await page
      .locator("#preview .byte")
      .evaluateAll((bytes) =>
        bytes.map((byte) =>
          Array.from(byte.querySelectorAll(".bit")).map((bit) =>
            bit.getAttribute("data-on"),
          ),
        ),
      );
    const weights = [1, 2, 4, 64, 8, 16, 32, 128];
    expect(rendered).toEqual(
      enc(raw)
        .split("")
        .map((c) =>
          weights.map((w) => String(Number(!!((c.charCodeAt(0) - 10240) & w)))),
        ),
    );
    if (raw.startsWith("B"))
      await expect(page.locator("#preview .bit").first()).toHaveAttribute(
        "data-retained",
        "yes",
      );
  }
});

test("repeated disclosure and menu actions settle correctly without stealing editor selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#raw").fill("细节有自己的节奏");
  await page
    .locator("#raw")
    .evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(2, 4));
  await page.locator("#reading summary").evaluate((el: HTMLElement) => {
    el.click();
    el.click();
    el.click();
  });
  await expect(page.locator("#reading summary")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect
    .poll(() =>
      page.locator("#reading").evaluate((el) => el.getAnimations().length),
    )
    .toBe(0);
  await expect(page.locator("#reading")).toHaveAttribute("open", "");
  await expect(page.locator("#raw")).toBeFocused();
  expect(
    await page
      .locator("#raw")
      .evaluate((el: HTMLTextAreaElement) => [
        el.selectionStart,
        el.selectionEnd,
      ]),
  ).toEqual([2, 4]);
  await page.locator("#reading summary").click();
  await expect(page.locator("#reading")).not.toHaveAttribute("open");
  await page.locator("#export-toggle").evaluate((el: HTMLElement) => {
    el.click();
    el.click();
    el.click();
  });
  await expect(page.locator("#export-menu")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("#export-menu").evaluate((el: HTMLElement) => el.inert),
    )
    .toBe(false);
  await page.keyboard.press("Escape");
  await expect(page.locator("#export-menu")).toBeHidden();
  await page.locator("#mode-tiles").click();
  await page.locator("#mode-dots").click();
  await expect(page.locator("#code")).toHaveValue(enc("细节有自己的节奏"));
  await expect(page.locator("#preview-surface")).not.toHaveAttribute(
    "data-morphing",
  );
});

test("reduced motion settles active panels and leaves conversion immediately available", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#raw").fill("即时转换");
  await page
    .locator("#reading summary")
    .evaluate((el: HTMLElement) => el.click());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#reading summary")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect
    .poll(() =>
      page.locator("#reading").evaluate((el) => el.getAnimations().length),
    )
    .toBe(0);
  await page.locator("#reading summary").click();
  await expect(page.locator("#reading")).not.toHaveAttribute("open");
  await page.locator("#mode-tiles").click();
  await expect(page.locator("#preview-surface")).not.toHaveAttribute(
    "data-morphing",
  );
  await page.locator("#raw").fill("仍然即时");
  await expect(page.locator("#code")).toHaveValue(enc("仍然即时"));
  await expect(page.locator("html")).not.toHaveClass(/page-enter/);
});
