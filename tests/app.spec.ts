import { test, expect } from "@playwright/test";
import { enc } from "../src/core.js";
import { encode } from "../src/protocol.js";
import fs from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("first visit, exact vectors, live edits, last-edited side", async ({
  page,
}) => {
  await expect(page.locator("#raw")).toHaveValue("");
  await expect(page.locator("#raw")).not.toBeFocused();
  await expect(page.locator("#reading")).not.toHaveAttribute("open");
  await page.locator("#raw").fill("A中😀");
  await expect(page.locator("#code")).toHaveValue(
    "\u2800\u2882\u283A\u289C\u284B\u28DC\u287B\u2800",
  );
  await page.locator("#raw").press("End");
  await page.locator("#raw").pressSequentially(" abc");
  await expect(page.locator("#raw")).toBeFocused();
  await expect(page.locator("#code")).toHaveValue(enc("A中😀 abc"));
  await page.locator("#code").fill(enc("  中文\t👩‍💻 é\n "));
  await expect(page.locator("#raw")).toHaveValue("  中文\t👩‍💻 é\n ");
  await expect(page.locator("#code")).toBeFocused();
});

test("IME composition does not convert unfinished text or steal selection", async ({
  page,
}) => {
  await page.locator("#raw").fill("A");
  await page.locator("#raw").evaluate((el: HTMLTextAreaElement) => {
    el.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    el.value = "Azhong";
    el.setSelectionRange(6, 6);
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        isComposing: true,
        inputType: "insertCompositionText",
        data: "zhong",
      }),
    );
  });
  await expect(page.locator("#code")).toHaveValue(enc("A"));
  await expect(page.locator("#status-text")).toContainText("正在输入");
  await page.locator("#raw").evaluate((el: HTMLTextAreaElement) => {
    el.value = "A中";
    el.setSelectionRange(2, 2);
    el.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "中" }),
    );
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: "中",
      }),
    );
  });
  await expect(page.locator("#code")).toHaveValue(enc("A中"));
  await expect(page.locator("#raw")).toBeFocused();
  expect(
    await page
      .locator("#raw")
      .evaluate((el: HTMLTextAreaElement) => [
        el.selectionStart,
        el.selectionEnd,
      ]),
  ).toEqual([2, 2]);
});

test("view morph keeps SVG nodes and exact encoding; true single-bit positions", async ({
  page,
}) => {
  await page.locator("#mode-dots").click();
  const input = String.fromCharCode(128, 64, 32, 16, 8, 4, 2, 1);
  await page.locator("#raw").fill(input);
  await expect(page.locator("#preview .byte")).toHaveCount(16);
  const positions = await page
    .locator("#preview .visual-group")
    .evaluateAll((groups) =>
      groups.map((group) =>
        Array.from(group.querySelectorAll(".byte")[1].querySelectorAll(".bit"))
          .filter((bit) => bit.getAttribute("data-on") === "1")
          .map((bit) => [
            Number(bit.getAttribute("x")) / Number(bit.getAttribute("width")),
            Number(bit.getAttribute("y")) / Number(bit.getAttribute("height")),
          ]),
      ),
    );
  expect(positions).toEqual([
    [[0, 0]],
    [[0, 1]],
    [[0, 2]],
    [[0, 3]],
    [[1, 0]],
    [[1, 1]],
    [[1, 2]],
    [[1, 3]],
  ]);
  await page
    .locator("#preview .bit")
    .first()
    .evaluate((el) => el.setAttribute("data-test-identity", "same"));
  const previewHeight = () =>
    page
      .locator("#preview-surface")
      .evaluate((el) => el.getBoundingClientRect().height);
  const beforeMorph = await previewHeight();
  await page.locator("#mode-tiles").click();
  await expect.poll(previewHeight).toBeCloseTo(beforeMorph, 2);
  await expect(page.locator("#preview-surface")).toHaveAttribute(
    "data-mode",
    "tiles",
  );
  await expect(page.locator("#preview .bit").first()).toHaveAttribute(
    "data-test-identity",
    "same",
  );
  await expect(page.locator("#code")).toHaveValue(enc(input));
  await page.locator("#theme").selectOption("light");
  await expect
    .poll(() =>
      page
        .locator('#preview .bit[data-on="1"]')
        .first()
        .evaluate((el) => getComputedStyle(el).fill),
    )
    .toBe("rgb(0, 0, 0)");
  await expect
    .poll(() =>
      page
        .locator('#preview .bit[data-on="0"]')
        .first()
        .evaluate((el) => getComputedStyle(el).fill),
    )
    .toBe("rgb(255, 255, 255)");
  await page.locator("#theme").selectOption("dark");
  await expect
    .poll(() =>
      page
        .locator('#preview .bit[data-on="1"]')
        .first()
        .evaluate((el) => getComputedStyle(el).fill),
    )
    .toBe("rgb(0, 0, 0)");
});

test("clear, example, and format actions preserve recoverable content", async ({
  page,
}) => {
  await page.locator("#raw").fill("我的内容😀");
  await page.locator("#clear").click();
  await expect(page.locator("#raw")).toHaveValue("");
  await page.locator("#undo").click();
  await expect(page.locator("#raw")).toHaveValue("我的内容😀");
  await page.locator("#example").click();
  await expect(page.locator("#raw")).toHaveValue("把想法，变成另一种形状。");
  await page.locator("#undo").click();
  await expect(page.locator("#raw")).toHaveValue("我的内容😀");
  await page.locator("#settings summary").click();
  await page.locator("#format-native").click();
  await expect(page.locator("#raw")).toHaveValue("我的内容😀");
  await expect(page.locator("#code")).toHaveValue(
    encode("我的内容😀", "native"),
  );
  await page.locator("#undo").click();
  await expect(page.locator("#code")).toHaveValue(enc("我的内容😀"));
  await page.locator("#code").fill(encode("历史内容", "native"));
  await page.locator("#format-native").click();
  await expect(page.locator("#raw")).toHaveValue("历史内容");
  await expect(page.locator("#code")).toHaveValue(encode("历史内容", "native"));
});

test("invalid input, odd length, explicit cleanup and recovery", async ({
  page,
}) => {
  await page.locator("#raw").fill("A");
  await page.locator("#code").fill("\u2800\u2882 X");
  await expect(page.locator("#code")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#error-message")).toContainText("第 3 个");
  await expect(page.locator("#raw")).toHaveValue("A");
  await expect(page.locator("#preview-label")).toContainText("上次有效");
  await page.locator("#code").fill("\u2800");
  await expect(page.locator("#error-message")).toContainText("缺少配对");
  await page.locator("#code").fill(" \u2800\u2882\n\t");
  await page.locator("#clean").click();
  await expect(page.locator("#code")).toHaveValue("\u2800\u2882");
  await expect(page.locator("#error-panel")).toBeHidden();
  await page.locator("#undo").click();
  await expect(page.locator("#code")).toHaveValue(" \u2800\u2882\n\t");
  await page.locator("#code").fill(enc("修好了"));
  await expect(page.locator("#raw")).toHaveValue("修好了");
  await expect(page.locator("#error-panel")).toBeHidden();
});

test("clipboard success near action and permission-denied fallback", async ({
  page,
  browserName,
}) => {
  await page.locator("#raw").fill(" A😀 ");
  if (browserName === "chromium") {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator("#copy-code").click();
    await expect(page.locator("#copy-code")).toContainText("已复制");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      enc(" A😀 "),
    );
    await expect(page.locator("#raw")).toBeFocused();
  }
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
      configurable: true,
    }),
  );
  await page.locator("#copy-code").click();
  await expect(page.locator("#copy-fallback")).toBeVisible();
  await expect(page.locator("#fallback-text")).toHaveValue(enc(" A😀 "));
  await page.locator("#select-fallback").click();
  const selected = await page
    .locator("#fallback-text")
    .evaluate((el: HTMLTextAreaElement) =>
      el.value.slice(el.selectionStart, el.selectionEnd),
    );
  expect(selected).toBe(enc(" A😀 "));
});

test("CRLF paste is preserved in model, including subsequent edits", async ({
  page,
}) => {
  await page.locator("#raw").focus();
  await page.locator("#raw").evaluate((el) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", " a\r\nb\rc\t ");
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }),
    );
  });
  await expect(page.locator("#code")).toHaveValue(enc(" a\r\nb\rc\t "));
  await page.locator("#raw").press("End");
  await page.locator("#raw").pressSequentially("z");
  await expect(page.locator("#code")).toHaveValue(enc(" a\r\nb\rc\t z"));
});

test("long asynchronous input, stale-result protection, privacy", async ({
  page,
}) => {
  await page.locator("#raw").fill("长文😀".repeat(20000));
  await page.locator("#raw").fill("最新输入");
  await expect(page.locator("#code")).toHaveValue(enc("最新输入"));
  await page.waitForTimeout(400);
  await expect(page.locator("#code")).toHaveValue(enc("最新输入"));
  await page.locator("#raw").fill("长".repeat(15000));
  await expect(page.locator("#code")).toHaveValue(enc("长".repeat(15000)));
  await expect(page.locator("#preview-count")).toContainText("256 / 30000");
  await expect(page.locator("#preview .byte")).toHaveCount(256);
  await page.locator("#theme").selectOption("light");
  const saved = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    url: location.href,
  }));
  expect(JSON.stringify(saved)).not.toContain("最新输入");
  expect(Object.keys(saved.local)).toEqual(["eoiles.preferences"]);
  expect(saved.session).toEqual({});
  await page.reload();
  await expect(page.locator("#raw")).toHaveValue("");
  await expect(page.locator("#theme")).toHaveValue("light");
});

test("SVG and PNG contain full cells, including blank cells at both ends", async ({
  page,
}) => {
  await page.locator("#raw").fill("\u0000A\u0000");
  await page.locator("#mode-tiles").click();
  const svgDownload = page.waitForEvent("download");
  await page.locator("#export-toggle").click();
  await page.locator("#export-svg").click();
  const svgPath = await (await svgDownload).path();
  const svg = await fs.readFile(svgPath!, "utf8");
  expect((svg.match(/class="byte"/g) || []).length).toBe(6);
  expect((svg.match(/class="bit"/g) || []).length).toBe(48);
  expect(svg).toContain('width="204" height="64"');
  const pngDownload = page.waitForEvent("download");
  await page.locator("#export-toggle").click();
  await page.locator("#export-png").click();
  const png = await fs.readFile((await (await pngDownload).path())!);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(408);
  expect(png.readUInt32BE(20)).toBe(128);
});

test("tutorial is opt-in, selects characters and reduced motion steps", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#raw").fill("😀A");
  await page.locator("#reading summary").click();
  await expect(page.locator("#character-choices button")).toHaveText([
    "😀",
    "A",
  ]);
  await expect(page.locator("#part-label")).toHaveText("😀 · 第 1 / 2 组");
  await page.locator("#read-play").click();
  await expect(page.locator("#reading-status")).toContainText("第 1 步");
  await page.waitForTimeout(600);
  await expect(page.locator("#reading-status")).toContainText("第 1 步");
  await page.locator("#read-step").click();
  await expect(page.locator("#reading-status")).toContainText("第 2 步");
  await page.getByRole("button", { name: "查看文字 A", exact: true }).click();
  await expect(page.locator("#part-control")).toBeHidden();
  await expect(page.locator("#byte-low .byte-bits")).toHaveText("01000001");
});

test("responsive widths, landscape, keyboard-sized viewport, no overflow", async ({
  page,
}) => {
  await page.locator("#example").click();
  await page.locator("#mode-tiles").click();
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [430, 932],
    [844, 390],
    [375, 360],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    const textarea = page.locator("#raw");
    expect(
      await textarea.evaluate((el) =>
        parseFloat(getComputedStyle(el).fontSize),
      ),
    ).toBeGreaterThanOrEqual(16);
    if (width < 640) {
      await page.locator("#copy-code").scrollIntoViewIfNeeded();
      await expect(page.locator("#mobile-bar")).toBeHidden();
      expect(
        (await page.locator("#copy-code").boundingBox())!.height,
      ).toBeGreaterThanOrEqual(40);
    }
  }
});

test("PNG pixels preserve white end cells and true black modules", async ({
  page,
}) => {
  await page.locator("#raw").fill("\u0000A\u0000");
  await page.locator("#mode-tiles").click();
  const download = page.waitForEvent("download");
  await page.locator("#export-toggle").click();
  await page.locator("#export-png").click();
  const png = await fs.readFile((await (await download).path())!);
  const pixels = await page.evaluate(async (b64) => {
    const image = new Image();
    image.src = "data:image/png;base64," + b64;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    return [
      [22, 22],
      [218, 50],
      [386, 50],
    ].map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
  }, png.toString("base64"));
  expect(pixels).toEqual([
    [255, 255, 255, 255],
    [0, 0, 0, 255],
    [255, 255, 255, 255],
  ]);
});

test("large SVG exports all data beyond preview; PNG refuses oversized canvas", async ({
  page,
}) => {
  await page.locator("#raw").fill("A".repeat(1100));
  await expect(page.locator("#preview .byte")).toHaveCount(256);
  const download = page.waitForEvent("download");
  await page.locator("#export-toggle").click();
  await page.locator("#export-svg").click();
  const svg = await fs.readFile((await (await download).path())!, "utf8");
  expect((svg.match(/class="byte"/g) || []).length).toBe(2200);
  await page.locator("#raw").fill("A".repeat(3000));
  await page.locator("#export-toggle").click();
  await page.locator("#export-png").click();
  await expect(page.locator("#export-status")).toContainText(
    "超出安全画布尺寸",
  );
  await expect(page.locator("#code")).toHaveValue(enc("A".repeat(3000)));
});

test("worker and preference storage failures do not break conversion", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Worker", {
      value: class {
        constructor() {
          throw new Error("unavailable");
        }
      },
    });
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.reload();
  await page.locator("#raw").fill("中".repeat(11000));
  await expect(page.locator("#code")).toHaveValue(enc("中".repeat(11000)));
  await page.locator("#raw").fill("A");
  await expect(page.locator("#code")).toHaveValue(enc("A"));
  await page.locator("#theme").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("selection and textarea scroll survive tools, help and continuous edits", async ({
  page,
  browserName,
}) => {
  await page.locator("#raw").fill("line text\n".repeat(80));
  await page.locator("#raw").evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    el.setSelectionRange(300, 304);
    el.scrollTop = 180;
  });
  const before = await page
    .locator("#raw")
    .evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd,
      el.scrollTop,
    ]);
  await page.locator("#mode-tiles").click();
  await page.locator("#reading summary").click();
  await expect(page.locator("#raw")).toBeFocused();
  const after = await page
    .locator("#raw")
    .evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd,
      el.scrollTop,
    ]);
  expect(after).toEqual(before);
  await page.keyboard.insertText("NEW");
  const value = await page.locator("#raw").inputValue();
  await expect(page.locator("#code")).toHaveValue(enc(value));
});

test("system theme follows media and native mapped bits match their actual glyph", async ({
  page,
}) => {
  await page.locator("#theme").selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect
    .poll(() =>
      page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe("rgb(240, 241, 238)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() =>
      page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe("rgb(16, 18, 19)");
  await page.locator("#settings summary").click();
  await page.locator("#format-native").click();
  await page.locator("#raw").fill("A");
  await expect(page.locator("#code")).toHaveValue("\u2800\u2841");
  const bits = await page
    .locator("#preview .byte")
    .nth(1)
    .locator(".bit")
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-on"))));
  expect(bits).toEqual([1, 0, 0, 1, 0, 0, 0, 0]);
});

test("manual clipboard fallback preserves model CRLF on explicit copy", async ({
  page,
}) => {
  await page.locator("#code").fill(enc("A\r\nB\rC"));
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
      configurable: true,
    }),
  );
  await page.locator("#copy-raw").click();
  await page.locator("#select-fallback").click();
  const copied = await page.locator("#fallback-text").evaluate((el) => {
    const clipboardData = new DataTransfer();
    el.dispatchEvent(
      new ClipboardEvent("copy", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }),
    );
    return clipboardData.getData("text/plain");
  });
  expect(copied).toBe("A\r\nB\rC");
});

test("compact actions preserve editing, keyboard focus and contextual mobile copy", async ({
  page,
}) => {
  await page.locator("#raw").fill("更简单的形状");
  await page
    .locator("#raw")
    .evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(1, 3));
  await page.locator("#export-toggle").click();
  await expect(page.locator("#export-menu")).toBeVisible();
  await expect(page.locator("#raw")).toBeFocused();
  expect(
    await page
      .locator("#raw")
      .evaluate((el: HTMLTextAreaElement) => [
        el.selectionStart,
        el.selectionEnd,
      ]),
  ).toEqual([1, 3]);
  await page.locator("#mode-tiles").click();
  await expect(page.locator("#export-menu")).toBeHidden();
  await page.locator("#export-toggle").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#export-png")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#export-menu")).toBeHidden();
  await expect(page.locator("#export-toggle")).toBeFocused();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator("#copy-code").scrollIntoViewIfNeeded();
  await expect(page.locator("#mobile-bar")).toBeHidden();
  await page.setViewportSize({ width: 375, height: 360 });
  await page.locator("#raw").focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator("#mobile-bar")).toBeVisible();
  const bar = await page.locator("#mobile-bar").boundingBox();
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(361);
  expect(
    (await page.locator("#mobile-copy").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(42);
  await page
    .locator("#copy-code")
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect(page.locator("#mobile-bar")).toBeHidden();
  await page.locator("#clear").click();
  await expect(page.locator("#status-text")).toHaveText("已清空，可撤销");
  await page.locator("#undo").click();
  await expect(page.locator("#raw")).toHaveValue("更简单的形状");
});
