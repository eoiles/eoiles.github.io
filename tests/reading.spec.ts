import { test, expect } from "@playwright/test";
import { enc } from "../src/core.js";
import { encode } from "../src/protocol.js";
import fs from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("format choice applies immediately to last edited side and undo restores both", async ({
  page,
}) => {
  await page.locator("#raw").fill(" A中😀\t ");
  await page
    .locator("#raw")
    .evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(1, 3));
  await page.locator("#settings summary").click();
  await page.locator("#format-native").click();
  await expect(page.locator("#code")).toHaveValue(
    encode(" A中😀\t ", "native"),
  );
  await expect(page.locator("#raw")).toHaveValue(" A中😀\t ");
  await expect(page.locator("#raw")).toBeFocused();
  expect(
    await page
      .locator("#raw")
      .evaluate((el: HTMLTextAreaElement) => [
        el.selectionStart,
        el.selectionEnd,
      ]),
  ).toEqual([1, 3]);
  await expect(page.locator("#format-native")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#source-note")).toContainText("保留原文");
  await page.locator("#undo").click();
  await expect(page.locator("#code")).toHaveValue(enc(" A中😀\t "));
  await expect(page.locator("#format-remap")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const code = encode("历史编码😀", "native");
  await page.locator("#code").fill(code);
  const interpreted = await page.locator("#raw").inputValue();
  await page.locator("#format-native").click();
  await expect(page.locator("#code")).toHaveValue(code);
  await expect(page.locator("#raw")).toHaveValue("历史编码😀");
  await expect(page.locator("#source-note")).toContainText("保留编码");
  await expect(page.locator("#code")).toBeFocused();
  await page.locator("#undo").click();
  await expect(page.locator("#code")).toHaveValue(code);
  await expect(page.locator("#raw")).toHaveValue(interpreted);
  await expect(page.locator("#format-remap")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("empty tutorial has working examples without changing input", async ({
  page,
}) => {
  await page.locator("#reading summary").click();
  await expect(page.locator("#reading-context")).toHaveText("试读示例");
  await expect(page.locator("#character-choices button")).toHaveText([
    "A",
    "中",
    "😀",
  ]);
  await expect(page.locator("#character-prev")).toBeHidden();
  for (const [char, binary] of [
    ["中", "0100111000101101"],
    ["A", "0000000001000001"],
    ["😀", "1101100000111101"],
  ]) {
    await page
      .getByRole("button", { name: `查看示例 ${char}`, exact: true })
      .click();
    expect((await page.locator(".byte-bits").allTextContents()).join("")).toBe(
      binary,
    );
    await expect(page.locator("#raw")).toHaveValue("");
    await expect(page.locator("#code")).toHaveValue("");
  }
  await expect(page.locator("#part-next")).toBeEnabled();
  await page.locator("#part-next").click();
  await expect(page.locator("#part-label")).toHaveText("😀 · 第 2 / 2 组");
  expect((await page.locator(".byte-bits").allTextContents()).join("")).toBe(
    "1101111000000000",
  );
  await page.locator("#part-prev").click();
  await expect(page.locator("#part-label")).toHaveText("😀 · 第 1 / 2 组");
});

test("both formats teach actual bit order, every step and every single set byte", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.locator("#settings summary").click();
  await page.locator("#reading summary").click();
  const orders = {
    remap: [0, 1, 2, 3, 4, 5, 6, 7],
    native: [7, 3, 6, 5, 4, 2, 1, 0],
  };
  const labels = {
    remap: ["1", "2", "3", "4", "5", "6", "7", "8"],
    native: ["8", "7", "6", "2", "5", "4", "3", "1"],
  };
  for (const format of ["remap", "native"] as const) {
    await page.locator(`#format-${format}`).click();
    await expect(page.locator("#reading-svg")).toHaveAttribute(
      "data-format",
      format,
    );
    expect(
      (await page.locator(".lesson-num").allTextContents()).slice(0, 8),
    ).toEqual(labels[format]);
    for (let step = 0; step < 16; step++) {
      await page.locator("#read-step").click();
      const active = page.locator(".lesson-bit.active");
      await expect(active).toHaveCount(1);
      await expect(active).toHaveAttribute("data-step", String(step));
      await expect(active).toHaveAttribute(
        "data-position",
        String(orders[format][step % 8]),
      );
      await expect(page.locator(".byte-bits .active")).toHaveAttribute(
        "data-bit-step",
        String(step),
      );
      await expect(active).toHaveAttribute("data-on", "0000000001000001"[step]);
    }
    for (let step = 0; step < 8; step++) {
      await page.locator("#raw").fill(String.fromCharCode(128 >> step));
      const on = page.locator('.lesson-bit[data-on="1"]');
      await expect(on).toHaveCount(1);
      await expect(on).toHaveAttribute(
        "data-position",
        String(orders[format][step]),
      );
      await expect(on).toHaveAttribute("data-step", String(8 + step));
    }
    // Reset to empty sample A so next format also verifies empty-state switching.
    await page.locator("#raw").fill("");
  }
});

test("character navigation keeps emoji, accents and ZWJ sequences together", async ({
  page,
}) => {
  await page.locator("#raw").fill("A中😀é👩‍💻 Z");
  await page.locator("#reading summary").click();
  await expect(page.locator("#reading-context")).toHaveText("选择文字");
  for (const char of ["中", "😀", "é", "👩‍💻", "空格", "Z"]) {
    await page.locator("#character-next").click();
    await expect(
      page.locator('.character-choice[aria-pressed="true"]'),
    ).toHaveText(char);
  }
  await expect(page.locator("#character-next")).toBeDisabled();
  await page.locator("#character-prev").click();
  await expect(
    page.locator('.character-choice[aria-pressed="true"]'),
  ).toHaveText("空格");
  await page.getByRole("button", { name: "查看文字 👩‍💻", exact: true }).click();
  await expect(page.locator("#part-label")).toHaveText("👩‍💻 · 第 1 / 5 组");
  await page.locator("#part-next").click();
  await expect(page.locator("#part-label")).toHaveText("👩‍💻 · 第 2 / 5 组");
  await page.locator("#mode-dots").click();
  await page.locator('#preview [data-unit="3"]').click();
  await expect(
    page.locator('.character-choice[aria-pressed="true"]'),
  ).toHaveText("😀");
  await expect(page.locator("#part-label")).toHaveText("😀 · 第 2 / 2 组");
});

test("invalid input keeps useful lesson in its real format until repaired", async ({
  page,
}) => {
  await page.locator("#raw").fill("A");
  await page.locator("#code").fill(enc("A") + "X");
  await page.locator("#settings summary").click();
  await page.locator("#reading summary").click();
  await page.locator("#format-native").click();
  await expect(page.locator("#code")).toHaveValue(enc("A") + "X");
  await expect(page.locator("#raw")).toHaveValue("A");
  await expect(page.locator("#reading-format")).toHaveText(
    "上次有效结果 · 自然顺序",
  );
  await expect(page.locator("#reading-svg")).toHaveAttribute(
    "data-format",
    "remap",
  );
  await page.locator("#code").fill(encode("A", "native"));
  await expect(page.locator("#reading-format")).toHaveText("Unicode 原生");
  await expect(page.locator("#reading-svg")).toHaveAttribute(
    "data-format",
    "native",
  );
  await expect(page.locator("#error-panel")).toBeHidden();
});

test("rapid format changes on long text reject outdated work and keep small picker", async ({
  page,
}) => {
  await page.locator("#settings summary").click();
  await page.locator("#raw").fill("😀中".repeat(6000));
  await page.locator("#format-native").click();
  await page.locator("#format-remap").click();
  await page.locator("#raw").fill("最新😀");
  await expect(page.locator("#code")).toHaveValue(enc("最新😀"));
  await expect(page.locator("#reading-svg")).toHaveAttribute(
    "data-format",
    "remap",
  );
  await page.waitForTimeout(400);
  await expect(page.locator("#code")).toHaveValue(enc("最新😀"));
  await page.locator("#raw").fill("字".repeat(13000));
  await expect(page.locator("#code")).toHaveValue(enc("字".repeat(13000)));
  expect(
    await page.locator("#character-choices button").count(),
  ).toBeLessThanOrEqual(5);
});

test("principle shows distinct Python algorithms and actual protocol numbers", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.locator("#principle > summary").click();
  const source = await fs.readFile(
    new URL("../src/concept.py", import.meta.url),
    "utf8",
  );
  expect(await page.locator("#concept-code").textContent()).toBe(source);
  expect(source.trim().split("\n")).toHaveLength(7);
  await expect(page.locator("#concept-code .syntax-string")).toContainText([
    '"73654210"',
    '"76514320"',
  ]);
  await expect(page.locator("#principle")).not.toContainText("src/core.js");
  await expect(page.locator("#principle")).not.toContainText("287f510");
  await page.locator("#settings summary").click();
  await page.locator("#reading summary").click();
  for (const theme of ["dark", "light"]) {
    await page.locator("#theme").selectOption(theme);
    for (const width of [320, 375, 430]) {
      await page.setViewportSize({ width, height: 812 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      const styles = await page.locator("#concept-code").evaluate((el) => ({
        height: el.clientHeight,
        scroll: el.scrollHeight,
        colors: [...el.querySelectorAll("span")].map(
          (t) => getComputedStyle(t).color,
        ),
      }));
      expect(styles.scroll - styles.height).toBeLessThanOrEqual(1);
      expect(new Set(styles.colors).size).toBeGreaterThanOrEqual(3);
    }
  }
  await expect(page.locator("#concept-result")).toHaveText("65 → ⢂ → 65");
  await expect(page.locator(".concept-numbers")).toContainText("73654210");
  await expect(page.locator(".concept-numbers")).toContainText("76514320");
  await expect(page.locator(".concept-numbers")).toContainText("10240");
  await expect(page.locator(".concept-numbers")).toContainText("256");
  await page.locator("#format-native").click();
  const native = await fs.readFile(
    new URL("../src/concept-native.py", import.meta.url),
    "utf8",
  );
  expect(await page.locator("#concept-code").textContent()).toBe(native);
  await expect(page.locator("#concept-code")).not.toContainText("重排");
  await expect(page.locator("#concept-code")).toContainText("10240");
  await expect(page.locator("#concept-heading")).toHaveText(
    "Unicode 原生 · Python 示例",
  );
  await expect(page.locator("#concept-result")).toHaveText("65 → ⡁ → 65");
  await page.locator("#format-remap").click();
  expect(await page.locator("#concept-code").textContent()).toBe(source);
  await page.locator("#format-native").click();
  await expect(page.locator("#principle-description")).toContainText(
    "Unicode 点位",
  );
});

test("capture reading revision", async ({ page }, info) => {
  test.skip(!process.env.EOILES_CAPTURE, "Opt-in reading screenshots");
  await page.locator("#theme").selectOption("dark");
  await page.locator("#settings summary").click();
  await page.locator("#reading summary").click();
  for (const format of ["remap", "native"]) {
    await page.locator(`#format-${format}`).click();
    await page
      .getByRole("button", { name: "查看示例 中", exact: true })
      .click();
    await page.locator("#read-step").click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `${process.env.EOILES_CAPTURE}/${info.project.name}-reading-${format}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.locator("#format-remap").click();
  await page.locator("#principle > summary").click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `${process.env.EOILES_CAPTURE}/${info.project.name}-source.png`,
    fullPage: true,
    animations: "disabled",
  });
});

test("capture compact Python concept", async ({ page }, info) => {
  test.skip(!process.env.EOILES_CAPTURE, "Opt-in concept screenshot");
  await page.locator("#settings summary").click();
  await page.locator("#principle > summary").click();
  for (const format of ["remap", "native"]) {
    await page.locator(`#format-${format}`).click();
    for (const theme of ["dark", "light"]) {
      await page.locator("#theme").selectOption(theme);
      await page
        .locator("#principle")
        .screenshot({
          path: `${process.env.EOILES_CAPTURE}/${info.project.name}-${format}-${theme}.png`,
          animations: "disabled",
        });
    }
  }
});
