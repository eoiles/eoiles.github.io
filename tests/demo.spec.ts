import { test, expect } from "@playwright/test";
import { enc } from "../src/core.js";

test("record the main interaction", async ({ browser }, info) => {
  test.skip(
    !process.env.EOILES_CAPTURE || info.project.name !== "chromium",
    "Opt-in video",
  );
  const dir = process.env.EOILES_CAPTURE!;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 },
    recordVideo: { dir, size: { width: 1280, height: 960 } },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  await page.goto(process.env.EOILES_BASE_URL || "http://127.0.0.1:5173");
  await page.locator("#theme").selectOption("dark");
  await page.waitForTimeout(650);
  await page.locator("#raw").fill("你好，eoiles。");
  await expect(page.locator("#code")).toHaveValue(enc("你好，eoiles。"));
  await page.waitForTimeout(650);
  await page.locator("#copy-code").click();
  await page.waitForTimeout(800);
  await page.locator("#mode-tiles").click();
  await page.waitForTimeout(900);
  await page.locator("#theme").selectOption("light");
  await page.waitForTimeout(800);
  await page.locator("#theme").selectOption("dark");
  await page.waitForTimeout(650);
  await page.locator("#settings summary").click();
  await page.waitForTimeout(650);
  await page.locator("#settings summary").click();
  await page.waitForTimeout(400);
  await page.locator("#mode-dots").click();
  await page.waitForTimeout(700);
  await page.locator("#clear").click();
  await page.waitForTimeout(600);
  await page.locator("#undo").click();
  await page.waitForTimeout(650);
  await page.locator("#reading summary").click();
  await page.locator("#read-play").click();
  await page.waitForTimeout(4500);
  await page.locator("#read-play").click();
  const video = page.video()!;
  await context.close();
  await video.saveAs(dir + "/interaction-demo.webm");
  await video.delete();
});
