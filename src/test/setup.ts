import '@testing-library/jest-dom'

// ResizeObserver n'est pas disponible dans JSDOM — nécessaire pour Recharts ResponsiveContainer
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
