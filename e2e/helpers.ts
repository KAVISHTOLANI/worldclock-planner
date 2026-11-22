import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/** Fails if the page scrolls horizontally at the current viewport width. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);
}

/** Saves a README screenshot into docs/. */
export async function snap(page: Page, name: string) {
  mkdirSync('docs', { recursive: true });
  await page.screenshot({ path: `docs/${name}.png`, fullPage: false });
}

/** Checks the layout at phone width and captures a mobile screenshot. */
export async function checkMobile(page: Page, name = 'mobile') {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(150);
  await expectNoHorizontalScroll(page);
  await snap(page, name);
  await page.setViewportSize({ width: 1280, height: 800 });
}
