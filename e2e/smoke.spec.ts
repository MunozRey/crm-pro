import { test, expect } from '@playwright/test'

test.describe('CRM smoke', () => {
  test('loads login page with primary action', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /login|iniciar sesion/i })).toBeVisible()
  })

  test('rejects private route when unauthenticated', async ({ page }) => {
    await page.goto('/deals')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('register page renders main form', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('button', { name: /create account|crear cuenta|registrarse/i })).toBeVisible()
    await expect(page.getByRole('textbox').first()).toBeVisible()
  })

  test('forgot password page renders and allows submit', async ({ page }) => {
    await page.goto('/forgot-password')
    const email = page.getByPlaceholder(/you@company\.com|email@company\.com/i)
    await email.fill('qa@example.com')
    await page.getByRole('button', { name: /send link|enviar enlace/i }).click()
    await expect(page.getByText(/check your email|revisa tu email/i)).toBeVisible()
  })

  test('unknown route falls back to app and guards auth', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('mock login allows protected navigation', async ({ page }) => {
    await page.goto('/login')

    const demoUserBtn = page.getByRole('button', { name: /david@crmpro\.es/i })
    const hasDemoMode = (await demoUserBtn.count()) > 0
    test.skip(!hasDemoMode, 'Mock-mode smoke only (demo credentials not visible)')

    await demoUserBtn.click()
    await page.getByRole('button', { name: /login|iniciar sesion/i }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/inbox')
    await expect(page).not.toHaveURL(/\/login$/)
  })
})
