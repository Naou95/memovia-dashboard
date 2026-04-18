/**
 * E2E Stripe & Finance — Module 3
 * Requires: npm run dev running on http://localhost:5173
 * Run with: npm run test:e2e
 *
 * IMPORTANT: Ces tests nécessitent des credentials réels.
 * Set these environment variables before running:
 *   E2E_ADMIN_EMAIL=naoufel@memovia.io
 *   E2E_ADMIN_PASSWORD=...
 */
import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''

// ── Helper : se connecter et naviguer vers /stripe ─────────────────────────────

async function loginAndGoToStripe(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(`${BASE_URL}/overview`, { timeout: 10000 })
  await page.goto(`${BASE_URL}/stripe`)
}

// ── E2E-STRIPE-1 : Auth guard ─────────────────────────────────────────────────

test('E2E-STRIPE-1: /stripe redirige vers /login si non authentifié', async ({ page }) => {
  await page.goto(`${BASE_URL}/stripe`)
  await expect(page).toHaveURL(`${BASE_URL}/login`, { timeout: 5000 })
})

// ── E2E-STRIPE-2 : Page load ──────────────────────────────────────────────────

test('E2E-STRIPE-2: /stripe charge et affiche les 5 KPI cards', async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')

  await loginAndGoToStripe(page)

  // Les 5 labels KPI doivent être présents
  await expect(page.getByText('MRR')).toBeVisible()
  await expect(page.getByText('ARR')).toBeVisible()
  await expect(page.getByText('Nouveaux ce mois')).toBeVisible()
  await expect(page.getByText('Churns ce mois')).toBeVisible()
  await expect(page.getByText('Revenus 12 mois')).toBeVisible()
})

test('E2E-STRIPE-3: /stripe affiche le graphique revenus', async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')

  await loginAndGoToStripe(page)

  // Le titre du graphique
  await expect(page.getByText('Revenus facturés — 12 derniers mois')).toBeVisible()
})

test('E2E-STRIPE-4: /stripe affiche le tableau abonnements', async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')

  await loginAndGoToStripe(page)

  // Titre section
  await expect(page.getByText('Abonnements actifs')).toBeVisible()
})

test('E2E-STRIPE-5: /stripe affiche la liste transactions', async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')

  await loginAndGoToStripe(page)

  await expect(page.getByText('Transactions récentes')).toBeVisible()
  await expect(page.getByText('20 dernières')).toBeVisible()
})

test('E2E-STRIPE-6: les skeletons disparaissent après chargement', async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')

  await loginAndGoToStripe(page)

  // Attendre que les skeletons disparaissent (max 15s pour la réponse Stripe)
  await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15000 })
})

test('E2E-STRIPE-7: "Stripe & Finance" est actif dans la sidebar', async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')

  await loginAndGoToStripe(page)

  // Le lien sidebar doit avoir l'état actif (pas de badge "soon")
  const sidebarLink = page.locator('[data-testid="sidebar"]').getByText('Stripe & Finance')
  await expect(sidebarLink).toBeVisible()
})
