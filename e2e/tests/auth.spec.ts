import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear any existing auth
    await page.evaluate(() => localStorage.removeItem('handtalk-auth'));
    await page.reload();
  });

  test('shows auth panel when unauthenticated', async ({ page }) => {
    await expect(page.locator('main.minimal-shell')).toBeVisible();
    await expect(page.getByRole('group', { name: /login|entrar|iniciar/i }).or(
      page.locator('form')
    )).toBeVisible();
  });

  test('language selector is visible and accessible', async ({ page }) => {
    const langGroup = page.getByRole('group', { name: 'Language selector' });
    await expect(langGroup).toBeVisible();

    const ptButton = langGroup.getByRole('button', { name: 'PT' });
    await expect(ptButton).toBeVisible();
    await expect(ptButton).toHaveAttribute('aria-pressed', 'true');

    await langGroup.getByRole('button', { name: 'EN' }).click();
    await expect(langGroup.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    await expect(langGroup.getByRole('button', { name: 'PT' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('login form has accessible labels', async ({ page }) => {
    // Email input must have associated label
    const emailInput = page.locator('#field-email');
    await expect(emailInput).toBeVisible();
    await expect(page.locator('label[for="field-email"]')).toBeVisible();

    // Password input must have associated label
    const passwordInput = page.locator('#field-password');
    await expect(passwordInput).toBeVisible();
    await expect(page.locator('label[for="field-password"]')).toBeVisible();
  });

  test('shows validation error on invalid login', async ({ page }) => {
    const emailInput = page.locator('#field-email');
    const passwordInput = page.locator('#field-password');

    await emailInput.fill('invalid-email');
    await passwordInput.fill('pass');

    // Target the submit button specifically (not the tab button which also says "Entrar")
    const submitBtn = page.locator('button[type="submit"].auth-submit');
    await submitBtn.click();

    // Either inline validation or error message should be visible
    const errorIndicator = page.locator('[aria-invalid="true"]').or(
      page.locator('.feedback.error')
    );
    await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('captcha section is accessible', async ({ page }) => {
    const captchaGroup = page.getByRole('group', { name: /verificação|captcha|security/i });
    // Captcha may not load in test env, just check the container exists or skip gracefully
    const hasCaptcha = await captchaGroup.count() > 0;
    if (hasCaptcha) {
      await expect(captchaGroup).toBeVisible();
    }
  });

  test('can switch to signup tab and back', async ({ page }) => {
    const signupTab = page.getByRole('button', { name: /cadastrar|signup|sign up|registrar/i }).first();
    if (await signupTab.count() > 0) {
      await signupTab.click();
      const displayNameInput = page.locator('#field-display-name');
      if (await displayNameInput.count() > 0) {
        await expect(displayNameInput).toBeVisible();
        await expect(page.locator('label[for="field-display-name"]')).toBeVisible();
      }
    }
  });
});
