interface SparklineProps {
  /** Series of numeric values, ordered oldest → newest */
  data: number[]
  width?: number
  height?: number
  /** Stroke color — accepts CSS vars like `var(--memovia-violet)` */
  color?: string
  /** If true, draws a filled area under the line with reduced opacity */
  filled?: boolean
  className?: string
}

export function Sparkline({
  data,
  width = 72,
  height = 24,
  color = 'var(--memovia-violet)',
  filled = true,
  className,
}: SparklineProps) {
  // Guard: need at least 2 points to draw a meaningful line
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min

  // Flat line case: all values equal — render at vertical center
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width
    const y = range === 0 ? height / 2 : height - ((value - min) / range) * height
    return { x, y }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  const areaD = `${pathD} L${width},${height} L0,${height} Z`
  const lastPoint = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden
      role="presentation"
      style={{ overflow: 'visible' }}
    >
      {filled && (
        <path
          d={areaD}
          fill={color}
          fillOpacity={0.12}
        />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r={2}
        fill={color}
      />
    </svg>
  )
}
