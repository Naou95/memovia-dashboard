import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DollarSign } from 'lucide-react'
import { KpiCard } from '@/components/shared/KpiCard'

describe('KpiCard', () => {
  const baseProps = {
    label: 'MRR',
    value: '360',
    unit: '€',
    accent: 'violet' as const,
    icon: DollarSign,
    isLoading: false,
    error: null,
  }

  it('affiche le label', () => {
    render(<KpiCard {...baseProps} />)
    expect(screen.getByText('MRR')).toBeInTheDocument()
  })

  it("affiche la valeur et l'unité", () => {
    render(<KpiCard {...baseProps} />)
    expect(screen.getByText('360')).toBeInTheDocument()
    expect(screen.getByText('€')).toBeInTheDocument()
  })

  it('affiche le skeleton quand isLoading=true', () => {
    render(<KpiCard {...baseProps} isLoading value={null} />)
    expect(screen.queryByText('360')).not.toBeInTheDocument()
    // Le skeleton est un div avec animate-pulse
    const { container } = render(<KpiCard {...baseProps} isLoading value={null} />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('affiche "Indisponible" si error et pas de loading', () => {
    render(<KpiCard {...baseProps} error="Erreur Stripe" value={null} />)
    expect(screen.getByText('Indisponible')).toBeInTheDocument()
  })

  it('affiche le delta positif avec signe +', () => {
    render(<KpiCard {...baseProps} delta={12} />)
    expect(screen.getByText('+12%')).toBeInTheDocument()
  })

  it('affiche le delta négatif', () => {
    render(<KpiCard {...baseProps} delta={-5} />)
    expect(screen.getByText('-5%')).toBeInTheDocument()
  })

  it("n'affiche pas de delta si non fourni", () => {
    const { container } = render(<KpiCard {...baseProps} />)
    expect(container.querySelector('[data-testid="delta"]')).toBeFalsy()
  })
})
