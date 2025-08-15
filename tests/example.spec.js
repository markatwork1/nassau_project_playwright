// tests/example.spec.js
const { test, expect } = require('@playwright/test');

test('homepage has correct title', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await expect(page).toHaveTitle(/Test Saving App/);
});

test('shows 0 total unique test numbers', async ({ page }) => {
  await page.goto('http://localhost:5500');
  // Click the "View All Test Numbers" button
  await page.getByRole('button', { name: /View All Test Numbers/i }).click();
  // Wait for the section to appear
  const info = await page.locator('#allTestNumbersInfo');
  await expect(info).toContainText('Total unique test numbers: 0');
});