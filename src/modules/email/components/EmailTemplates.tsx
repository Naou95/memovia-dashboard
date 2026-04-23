import { FileText, Handshake, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface EmailTemplate {
  id: string
  label: string
  description: string
  icon: LucideIcon
  subject: string
  body: string
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'prise-contact-cfa',
    label: 'Prise de contact CFA',
    description: 'Premier contact avec un Centre de Formation d\'Apprentis',
    icon: Handshake,
    subject: 'MEMOVIA AI — Solution de mémorisation pour vos apprenants',
    body: `Bonjour,

Je me permets de vous contacter concernant MEMOVIA AI, une plateforme EdTech française dédiée à la mémorisation intelligente pour les étudiants en formation professionnelle.

Nous accompagnons déjà plusieurs CFA dans l'amélioration des taux de réussite aux examens grâce à :
— Un système de révision espacée piloté par IA
— Des parcours adaptés à chaque référentiel de formation
— Un suivi pédagogique en temps réel pour les formateurs

Seriez-vous disponible pour un échange de 20 minutes afin de voir si MEMOVIA pourrait correspondre à vos enjeux ?

Bien cordialement,
Naoufel Bassou
Fondateur — MEMOVIA AI
https://memovia.io`,
  },
  {
    id: 'relance-silence',
    label: 'Relance après silence',
    description: 'Relance polie après absence de réponse',
    icon: Clock,
    subject: 'Petite relance — MEMOVIA AI',
    body: `Bonjour,

Je me permets de revenir vers vous au sujet de mon précédent message concernant MEMOVIA AI.

Je comprends parfaitement que votre emploi du temps soit chargé. Si le sujet vous intéresse toujours, je reste disponible pour un échange rapide à votre convenance.

Dans le cas contraire, n'hésitez pas à me le faire savoir, je ne vous solliciterai plus.

Bien à vous,
Naoufel Bassou
MEMOVIA AI`,
  },
  {
    id: 'proposition-commerciale',
    label: 'Proposition commerciale',
    description: 'Envoi d\'une proposition commerciale structurée',
    icon: FileText,
    subject: 'Proposition commerciale MEMOVIA AI — [Nom de l\'établissement]',
    body: `Bonjour,

Suite à notre échange, je reviens vers vous avec notre proposition commerciale pour l'équipement de vos apprenants avec MEMOVIA AI.

Périmètre proposé :
— Nombre d'apprenants : [à compléter]
— Durée d'engagement : 12 mois
— Formations couvertes : [à préciser]

Ce que nous incluons :
— Accès illimité à la plateforme pour tous les apprenants
— Tableau de bord formateur avec suivi individualisé
— Import du référentiel et personnalisation du contenu
— Support pédagogique dédié

Tarif : [à compléter] € HT / apprenant / an

Je reste à votre disposition pour ajuster ces éléments et répondre à vos questions. Nous pouvons démarrer dès signature sous 5 jours ouvrés.

Cordialement,
Naoufel Bassou
Fondateur — MEMOVIA AI
naoufel@memovia.io`,
  },
]

interface EmailTemplatesProps {
  onSelect: (template: EmailTemplate) => void
}

export function EmailTemplates({ onSelect }: EmailTemplatesProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="flex shrink-0 items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Templates d'email
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Cliquez pour pré-remplir un nouveau message
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-3">
          {EMAIL_TEMPLATES.map((template) => {
            const Icon = template.icon
            return (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className="group flex items-start gap-4 rounded-[8px] border p-4 text-left transition-colors hover:border-[var(--memovia-violet)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--memovia-violet)] focus-visible:ring-offset-2"
                style={{
                  borderColor: 'var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
                  style={{
                    backgroundColor: 'var(--memovia-violet-light)',
                    color: 'var(--memovia-violet)',
                  }}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {template.label}
                  </div>
                  <div
                    className="mt-0.5 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {template.description}
                  </div>
                  <div
                    className="mt-2 truncate text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {template.subject}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
