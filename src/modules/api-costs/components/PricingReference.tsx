// Static pricing reference — hardcoded from official provider pricing pages.
// OpenAI: platform.openai.com/docs/pricing
// Gemini: ai.google.dev/pricing
// Gladia: gladia.io/pricing

interface PricingRow {
  provider: string
  model: string
  unit: string
  inputPrice: string
  outputPrice: string
  avgPerGeneration: string
  color: string
}

const PRICING: PricingRow[] = [
  {
    provider: 'OpenAI',
    model: 'GPT-4o mini',
    unit: 'Par 1M tokens',
    inputPrice: '$0.15',
    outputPrice: '$0.60',
    avgPerGeneration: '~$0.0009',
    color: '#7C3AED',
  },
  {
    provider: 'Gemini',
    model: 'Gemini 2.5 Flash',
    unit: 'Par 1M tokens',
    inputPrice: '$0.075',
    outputPrice: '$0.30',
    avgPerGeneration: '~$0.00045',
    color: '#4285F4',
  },
  {
    provider: 'Gladia',
    model: 'Audio (STT)',
    unit: 'Par heure audio',
    inputPrice: '$0.162',
    outputPrice: '—',
    avgPerGeneration: '~$0.0135 / 5 min',
    color: '#00C9B1',
  },
]

export function PricingReference() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="border-b border-[var(--border-color)] px-5 py-4">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Référence tarifaire</h3>
        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
          Estimation coût par génération — basée sur ~2 000 tokens input + 1 000 output
        </p>
      </div>
      <div className="divide-y divide-[var(--border-color)]">
        {PRICING.map((row) => (
          <div key={row.model} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">{row.provider}</div>
                <div className="text-[11px] text-[var(--text-muted)]">{row.model}</div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-6 text-right">
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Input</div>
                <div className="text-[12px] font-medium text-[var(--text-secondary)]">{row.inputPrice} / {row.unit.toLowerCase()}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Output</div>
                <div className="text-[12px] font-medium text-[var(--text-secondary)]">{row.outputPrice}</div>
              </div>
              <div className="min-w-[110px] text-right">
                <div className="text-[11px] text-[var(--text-muted)]">Moy / génération</div>
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{row.avgPerGeneration}</div>
              </div>
            </div>
            {/* Mobile: compact */}
            <div className="sm:hidden text-right">
              <div className="text-[11px] text-[var(--text-muted)]">Moy / génération</div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">{row.avgPerGeneration}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
