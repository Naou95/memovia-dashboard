# Plan de refonte MEMOVIA Dashboard — Style Qonto

## Phase 1 — Fondations (PRIORITÉ MAX)
- [ ] index.css — variables CSS + reset
- [ ] tailwind.config.ts — couleurs custom
- [ ] Sidebar.tsx — fond blanc, nouveaux styles
- [ ] TopBar.tsx — épuration
- [ ] KpiCard.tsx — nouveau style
- [ ] Composants Recharts partagés

## Phase 2 — Modules Finance
- [ ] OverviewPage.tsx
- [ ] StripePage.tsx  
- [ ] QontoPage.tsx

## Phase 3 — Commercial
- [ ] ContractsPage.tsx
- [ ] CRMPage / LeadsPage
- [ ] TasksPage.tsx

## Phase 4 — Plateforme
- [ ] UsersPage.tsx
- [ ] RealtimePage.tsx
- [ ] RoadmapPage.tsx
- [ ] MonitoringPage.tsx
- [ ] AnalyticsPage.tsx

## Phase 5 — Opérations & Growth
- [ ] EmailPage.tsx
- [ ] GitHubPage.tsx
- [ ] SeoPage.tsx
- [ ] CalendarPage.tsx
- [ ] CopilotPage.tsx

## Phase 6 — Auth & Admin
- [ ] LoginPage.tsx
- [ ] AdminPage.tsx

## Règles obligatoires par phase
- Lire DESIGN_QONTO.md avant chaque module
- /polish après chaque module livré
- Tester responsive mobile
- Commit atomique par module
- tsc clean avant chaque push
