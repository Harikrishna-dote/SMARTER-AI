import { test, expect } from '@playwright/test';

test.describe('Autonomous Tutor Workflow', () => {
  test('should progress from topic entry to active practice', async ({ page }) => {
    // 1. Navigate to the classroom
    await page.goto('/classroom');

    // 2. Select topic and start lesson
    await page.fill('input[placeholder="Try Quadratic equations"]', 'Intro to Python');
    await page.click('text=Start Realistic AI Class');

    // 3. Verify lesson initiation (Greeting)
    // Wait for the AI tutor to render content in the blackboard
    const blackboard = page.locator('.no-scrollbar');
    await expect(blackboard).toBeVisible();

    // 4. Simulate user interaction (responding to the assessment)
    // Wait for input to be ready
    const chatInput = page.locator('input[placeholder="Type your response..."]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('I know basic variables.');
    await chatInput.press('Enter');

    // 5. Verify progression (Expectation: Explanation stage begins)
    // Based on tutor brain logic, we expect content update
    await expect(page.locator('text=Explanation')).toBeVisible();
    
    // 6. Simulate interaction (moving to practice)
    await chatInput.fill('I understand, let\'s practice.');
    await chatInput.press('Enter');

    // 7. Verify progression (Expectation: Practice stage)
    await expect(page.locator('text=Practice')).toBeVisible();
  });
});
