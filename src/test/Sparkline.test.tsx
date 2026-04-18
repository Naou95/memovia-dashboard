import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from '@/components/shared/Sparkline'

describe('Sparkline', () => {
  it('renders an svg with a polyline path for 6 values', () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 4, 5, 6]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    const paths = container.querySelectorAll('path')
    // one fill path (filled=true default) + one stroke path
    expect(paths.length).toBe(2)
  })

  it('returns null when data length < 2 (guard against div-by-zero in scaling)', () => {
    const { container } = render(<Sparkline data={[]} />)
    expect(container.querySelector('svg')).toBeNull()

    const { container: c2 } = render(<Sparkline data={[42]} />)
    expect(c2.querySelector('svg')).toBeNull()
  })

  it('renders a flat horizontal line when all values are equal (max === min edge)', () => {
    const { container } = render(<Sparkline data={[100, 100, 100, 100]} />)
    const strokePath = container.querySelectorAll('path')[1]
    expect(strokePath).toBeInTheDocument()
    // All points should share the same y coordinate → verify no NaN in path
    const d = strokePath.getAttribute('d') ?? ''
    expect(d).not.toContain('NaN')
  })

  it('does not clip when data includes zero', () => {
    const { container } = render(<Sparkline data={[0, 50, 100, 25, 0]} />)
    const strokePath = container.querySelectorAll('path')[1]
    const d = strokePath.getAttribute('d') ?? ''
    expect(d).not.toContain('NaN')
    expect(d).toMatch(/^M/)
  })

  it('renders the end-point marker circle', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />)
    expect(container.querySelector('circle')).toBeInTheDocument()
  })

  it('skips the filled area when filled=false', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} filled={false} />)
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBe(1)
  })
})
