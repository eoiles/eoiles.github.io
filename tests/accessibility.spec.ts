import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("WCAG AA: populated preview, error and expanded help in both themes", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  for (const theme of ["dark", "light"]) {
    await page.locator("#theme").selectOption(theme);
    await page.locator("#example").click();
    await page.locator("#reading summary").click();
    await page.locator("#settings summary").click();
    await page.locator("#principle summary").click();
    await page.locator("#code").fill("X");
    // 等待所有短过渡结束后度量最终颜色。
    await page.waitForTimeout(300);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          failure: n.failureSummary,
        })),
      })),
    ).toEqual([]);
    await page.locator("#reading summary").click();
    await page.locator("#settings summary").click();
    await page.locator("#principle summary").click();
  }
});
