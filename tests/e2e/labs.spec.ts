// @ts-ignore: allow importing Playwright test runner types when declarations are not resolved in this environment
import { test, expect, type Page } from '@playwright/test';

test.describe('Classroom Lab Engine Tests', () => {
  test('ScienceLab should render for gravity experiment', async ({ page }: { page: Page }) => {
    await page.goto('/classroom');
    // Simplified trigger - assuming AI tutor injects this for a physics topic
    await page.fill('input[placeholder="Try Quadratic equations"]', 'gravity');
    await page.click('text=Start Realistic AI Class');
    
    // Verify canvas exists
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('AttentionLab should render for AI topic', async ({ page }: { page: Page }) => {
    await page.goto('/classroom');
    await page.fill('input[placeholder="Try Quadratic equations"]', 'transformer attention');
    await page.click('text=Start Realistic AI Class');
    
    // Verify canvas exists
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});
