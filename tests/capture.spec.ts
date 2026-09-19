import { test, expect } from "@playwright/test";
import { enc } from "../src/core.js";

test("capture desktop and mobile review artifacts", async ({ page }, info) => {
  test.skip(!process.env.EOILES_CAPTURE, "Opt-in review screenshots");
  await page.goto("/");
  await page.locator("#theme").selectOption("dark");
  if (info.project.name === "chromium") {
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.screenshot({
      path: process.env.EOILES_CAPTURE + "/desktop-empty.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.locator("#raw").fill("把想法，变成另一种形状。");
    await expect(page.locator("#code")).toHaveValue(
      enc("把想法，变成另一种形状。"),
    );
    await page.screenshot({
      path: process.env.EOILES_CAPTURE + "/desktop-dark.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.locator("#settings summary").click();
    await page.waitForTimeout(320);
    await page.screenshot({
      path: process.env.EOILES_CAPTURE + "/desktop-settings.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.locator("#settings summary").click();
    await page.locator("#mode-tiles").click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: process.env.EOILES_CAPTURE + "/desktop-tiles.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.locator("#theme").selectOption("light");
    await page.waitForTimeout(300);
    await page.screenshot({
      path: process.env.EOILES_CAPTURE + "/desktop-light.png",
      fullPage: true,
      animations: "disabled",
    });
  } else if (info.project.name === "mobile-chromium") {
    for (const width of [320, 375, 430]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
      await page.locator("#theme").selectOption("dark");
      await page.locator("#raw").fill("把想法，变成另一种形状。");
      await page.locator("#mode-code").click();
      await page.locator(".wordmark").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${process.env.EOILES_CAPTURE}/mobile-${width}-code.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page.locator("#mode-tiles").click();
      await page.locator(".wordmark").scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${process.env.EOILES_CAPTURE}/mobile-${width}-dark.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page.locator("#theme").selectOption("light");
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${process.env.EOILES_CAPTURE}/mobile-${width}-light.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
});
