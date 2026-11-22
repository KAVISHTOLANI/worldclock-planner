import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

test('plan a meeting across cities by dragging', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.hb-row')).toHaveCount(5);
  await page.waitForTimeout(1000);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');
  await page.evaluate(() => localStorage.setItem('worldclock:cities', '[]'));
  await page.goto('./#/planner');
  await page.reload();
  await page.getByLabel('Date').fill('2026-03-04');
  await page.getByRole('button', { name: 'Load demo team (4 cities)' }).click();
  await expect(page.getByTestId('verdict')).toBeVisible();

  // Drag the meeting block to the far left of the track (London 00:00) -> unreasonable for London
  const track = page.locator('.tl-tracks');
  const box = (await track.boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 10);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByTestId('verdict')).toContainText('Unreasonable');
  await expect(page.getByTestId('verdict')).toContainText('London');

  // Drag to roughly 09:30 London -> should no longer be overnight for London
  await page.mouse.move(box.x + box.width * (10 / 24), box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * (10.1 / 24), box.y + 12);
  await page.mouse.up();
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', /^(09|10):/);

  await page.getByRole('button', { name: /^\d\d:\d\d$/ }).first().click();
  await page.getByLabel('Meeting name').fill('Quarterly planning');
  await page.getByRole('button', { name: 'Save meeting' }).click();
  await expect(page.getByText('Saved “Quarterly planning”.')).toBeVisible();
  await snap(page, 'planner');
  await checkMobile(page);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Saved meetings' }).click();
  await expect(page.getByRole('heading', { name: 'Quarterly planning' })).toBeVisible();
});
