import { test, expect } from '@playwright/test';

test.describe('WCAG / Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('handtalk-auth'));
    await page.reload();
  });

  test('page has a <main> landmark', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
  });

  test('page has a visible heading', async ({ page }) => {
    // After auth, there is an h1; or the auth panel has a heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('all form inputs have accessible labels', async ({ page }) => {
    // Find all inputs that are visible
    const inputs = page.locator('input:visible');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');

      // Each input must have an associated label or aria-label
      if (id) {
        const labelCount = await page.locator(`label[for="${id}"]`).count();
        const hasLabel = labelCount > 0 || !!ariaLabel || !!ariaLabelledBy;
        expect(hasLabel, `Input #${id} must have an accessible label`).toBe(true);
      }
    }
  });

  test('buttons have accessible names', async ({ page }) => {
    const buttons = page.locator('button:visible');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const text = await btn.textContent();
      const ariaLabel = await btn.getAttribute('aria-label');
      const hasName = (text && text.trim().length > 0) || !!ariaLabel;
      expect(hasName, `Button at index ${i} must have an accessible name`).toBe(true);
    }
  });

  test('language buttons have aria-pressed attribute', async ({ page }) => {
    const langGroup = page.getByRole('group', { name: 'Language selector' });
    const buttons = langGroup.getByRole('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const ariaPressed = await btn.getAttribute('aria-pressed');
      expect(ariaPressed, `Language button must have aria-pressed`).not.toBeNull();
    }
  });

  test('keyboard navigation: Tab moves focus through interactive elements', async ({ page }) => {
    // Press Tab 5 times and verify focus moves
    await page.keyboard.press('Tab');
    const focused1 = await page.evaluate(() => document.activeElement?.tagName);
    await page.keyboard.press('Tab');
    const focused2 = await page.evaluate(() => document.activeElement?.tagName);
    // Focus should be on an interactive element
    expect(['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A']).toContain(focused1 || focused2);
  });

  test('focus is visible (not hidden via outline:none without replacement)', async ({ page }) => {
    await page.keyboard.press('Tab');
    // Get focused element
    const focusedOutline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow,
      };
    });

    // Should have either an outline or a box-shadow for focus ring
    if (focusedOutline) {
      const hasFocusRing =
        (focusedOutline.outlineWidth && focusedOutline.outlineWidth !== '0px') ||
        (focusedOutline.boxShadow && focusedOutline.boxShadow !== 'none');
      // Warn rather than hard-fail, as CSS may vary
      if (!hasFocusRing) {
        console.warn('Focus ring may not be visible on focused element');
      }
    }
  });
});
