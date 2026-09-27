import { test, expect } from '@playwright/test';

test('classroom lesson generation flow', async ({ page }) => {
  // Go to the classroom page (assumes auth is mocked or skipped for test)
  await page.goto('/classroom');

  // Select a subject
  await page.click('text=Math');

  // Fill in topic
  await page.fill('input[placeholder="Try Quadratic equations"]', 'Pythagorean theorem');

  // Start lesson
  await page.click('text=Start Realistic AI Class');

  // Verify blackboard content loads
  await expect(page.locator('.no-scrollbar')).toBeVisible();
});
