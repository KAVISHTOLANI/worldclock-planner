import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/** Fails if the page scrolls horizontally at the current viewport width. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);
  // body hides horizontal overflow, so also look for content that runs off-screen and gets clipped.
  const offenders = await page.evaluate(() => {
    const w = window.innerWidth;
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') return true;
      }
      return false;
    };
    return [...document.querySelectorAll('main *, header *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.right > w + 1 && s.position !== 'fixed' && s.visibility !== 'hidden' && !inScroller(el);
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`);
  });
  expect(offenders, 'elements running off the right edge').toEqual([]);
}

/** Saves a README screenshot into docs/. */
export async function snap(page: Page, name: string) {
  mkdirSync('docs', { recursive: true });
  await page.waitForTimeout(700); // let route transitions and reveals finish
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
