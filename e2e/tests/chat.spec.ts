import { test, expect } from '@playwright/test';

const TEST_TOKEN = process.env.E2E_TEST_TOKEN;

// Helper: inject a fake auth token so we skip real login
async function injectAuth(page: import('@playwright/test').Page, token = 'test-token') {
  const fakeAuth = {
    accessToken: token,
    user: { id: 'test-user', email: 'test@example.com', displayName: 'Test User' },
  };
  await page.evaluate((auth) => {
    localStorage.setItem('handtalk-auth', JSON.stringify(auth));
  }, fakeAuth);
}

test.describe('Chat workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Use real token from env if provided, otherwise skip auth-dependent tests
    if (TEST_TOKEN) {
      await injectAuth(page, TEST_TOKEN);
      await page.reload();
    }
  });

  test('unauthenticated user sees auth panel, not chat', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('handtalk-auth'));
    await page.reload();
    await expect(page.locator('form, [data-testid="auth-panel"]').or(
      page.locator('#field-email')
    )).toBeVisible();
    await expect(page.locator('#chat-question')).not.toBeVisible();
  });

  test.describe('when authenticated', () => {
    test.skip(!TEST_TOKEN, 'E2E_TEST_TOKEN not set');

    test('chat textarea has accessible label', async ({ page }) => {
      const textarea = page.locator('#chat-question');
      await expect(textarea).toBeVisible();
      // Should have aria-label or associated label
      const ariaLabel = await textarea.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });

    test('settings drawer has accessible aside label', async ({ page }) => {
      const settingsBtn = page.getByRole('button', { name: /settings|configurações|configuración/i });
      await settingsBtn.click();
      const aside = page.locator('aside.settings-drawer');
      await expect(aside).toBeVisible();
      const label = await aside.getAttribute('aria-label');
      expect(label).toBeTruthy();
    });

    test('can type in chat textarea', async ({ page }) => {
      const textarea = page.locator('#chat-question');
      await textarea.fill('What is WCAG?');
      await expect(textarea).toHaveValue('What is WCAG?');
    });

    test('send button is disabled when textarea is empty', async ({ page }) => {
      const textarea = page.locator('#chat-question');
      await textarea.fill('');
      const sendBtn = page.getByRole('button', { name: /send|enviar|enviar/i });
      await expect(sendBtn).toBeDisabled();
    });

    test('send button enables when textarea has content', async ({ page }) => {
      const textarea = page.locator('#chat-question');
      await textarea.fill('Test question');
      const sendBtn = page.getByRole('button', { name: /send|enviar/i });
      await expect(sendBtn).toBeEnabled();
    });

    test('language switcher changes placeholder language', async ({ page }) => {
      const enBtn = page.getByRole('button', { name: 'EN' });
      await enBtn.click();
      const textarea = page.locator('#chat-question');
      const placeholder = await textarea.getAttribute('placeholder');
      expect(placeholder).toMatch(/WCAG|ADA|Section 508/i);
    });

    test('logout button clears session and shows auth panel', async ({ page }) => {
      const logoutBtn = page.getByRole('button', { name: /logout|sair|cerrar sesión/i });
      await logoutBtn.click();
      await expect(page.locator('#field-email')).toBeVisible({ timeout: 5000 });
    });
  });
});
