# Design System MEMOVIA Dashboard — Style Qonto

## Philosophie
Sobre, professionnel, lisible. Inspiré de app.qonto.com (le vrai dashboard, pas le site marketing).
Sidebar blanche. Cards épurées. Données en premier. Pas de violet partout.

## Tokens CSS — à mettre dans index.css
```css
--bg-app: #F8F8F8;
--bg-card: #FFFFFF;
--bg-sidebar: #FFFFFF;
--bg-hover: #F4F3FF;
--bg-active: #EDE9FF;
--border: #E5E7EB;
--border-subtle: #F3F4F6;
--text-primary: #111827;
--text-secondary: #6B7280;
--text-muted: #9CA3AF;
--memovia-violet: #7C3AED;
--memovia-violet-light: #EDE9FF;
--success: #16A34A;
--success-bg: #F0FDF4;
--success-bar: #4ADE80;
--danger: #DC2626;
--danger-bg: #FEF2F2;
--danger-bar: #F87171;
--warning: #D97706;
--warning-bg: #FFFBEB;
--shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
--shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--radius: 8px;
```

## Sidebar
- Largeur 220px, fond blanc, border-right 1px solid #E5E7EB
- Items : padding 8px 12px, radius 6px, icône 16px gris, label 13px 500
- Actif : fond #EDE9FF, texte + icône #7C3AED
- Hover : fond #F4F3FF
- Groupes : 11px uppercase #9CA3AF, margin-top 16px
- Bas : avatar + nom + rôle, border-top, padding 12px 16px

## KPI Cards
- Fond blanc, border 1px #E5E7EB, radius 8px, padding 20px, shadow-xs
- Label : 13px 500 #6B7280
- Valeur : 28px 700 tabular-nums #111827
- Trend pill : 12px 600, vert/rouge selon direction
- Footer optionnel : 12px #9CA3AF

## Graphiques Recharts
- Grid : strokeDasharray "4 4", stroke #F3F4F6
- Axes : tick 11px #9CA3AF, axisLine false, tickLine false
- MRR/violet : fill #7C3AED, area fill #EDE9FF opacity 0.15
- Entrées : #4ADE80 (vert)
- Sorties : #F87171 (rouge-saumon)
- Trésorerie line : stroke #3B82F6, area fill #EFF6FF opacity 0.3
- Tooltip : fond blanc, border #E5E7EB, radius 6px
- Bar radius top : 4px

## Tableaux
- Header : bg #F9FAFB, 11px uppercase #9CA3AF, padding 10px 16px
- Pas d'alternance, séparateurs border-bottom 1px #F3F4F6
- Hover ligne : #FAFAFA
- Cellule padding : 12px 16px

## Boutons
- Primary : bg #111827, blanc, radius 6px, padding 8px 16px
- Secondary : bg blanc, border #E5E7EB, texte #111827
- Ghost : bg transparent, texte #6B7280, hover bg #F3F4F6
- Icon btn : 32×32px, radius 6px

## Badges statuts
- Actif : bg #F0FDF4, texte #16A34A
- En cours : bg #EFF6FF, texte #2563EB
- Annulation : bg #FEF2F2, texte #DC2626
- Neutre : bg #F9FAFB, texte #6B7280
- Chaud : bg #FFFBEB, texte #D97706
- Pill : radius 20px, padding 2px 8px, 12px 500

## Responsive
- Desktop >1280px : sidebar 220px fixe
- Tablette 768-1280px : sidebar 60px icônes seules
- Mobile <768px : sidebar cachée, hamburger

## À éviter absolument
- Sidebar sombre
- Fond violet sur grandes surfaces
- Cards avec ombre lourde
- Texte < 12px sur données importantes
- Icônes mélangées (Lucide uniquement)
