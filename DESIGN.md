# Brief Design — MEMOVIA Dashboard

## Référence visuelle principale
**Qonto** — dashboard fintech français. C'est le niveau de qualité et de sérieux visé.
Étudier attentivement : https://qonto.com

## Style général
- **Mode :** Light mode (fond principal blanc/gris très clair)
- **Sidebar :** Sombre (near-black #0F0F1A), icônes et labels blancs
- **Densité :** Fonctionnel et lisible — tout ce qui est utile visible, rien de superflu
- **Ton :** Professionnel, sobre, confiant — pas corporate froid, pas startup flashy

## Couleurs

### Palette principale
```css
--bg-primary: #F8F8FC;        /* fond principal pages */
--bg-secondary: #FFFFFF;      /* cards, panels */
--bg-sidebar: #0F0F1A;        /* sidebar gauche */
--border: #E8E8F0;            /* bordures légères */
--text-primary: #0F0F1A;      /* titres, texte principal */
--text-secondary: #6B6B80;    /* labels, sous-titres */
--text-muted: #9999AA;        /* texte tertiaire */
```

### Couleurs MEMOVIA (accent)
```css
--memovia-violet: #7C3AED;    /* actions primaires, éléments actifs sidebar */
--memovia-cyan: #00E5CC;      /* métriques clés, indicateurs positifs */
--memovia-violet-light: #EDE9FF; /* backgrounds subtils sur hover/actif */
```

### Couleurs sémantiques
```css
--success: #10B981;           /* positif, croissance */
--warning: #F59E0B;           /* attention, en attente */
--danger: #EF4444;            /* erreur, churn, alerte */
--info: #3B82F6;              /* informatif neutre */
```

## Typographie
- **Titres dashboard :** Geist (Vercel) ou Cal Sans — moderne, lisible, autorité
- **Corps de texte :** Geist Sans ou DM Sans — pas Inter (trop générique)
- **Chiffres/métriques :** Geist Mono ou tabular figures — alignement parfait
- **Taille base :** 14px pour le contenu dense, 16px pour les titres de section

## Layout

### Structure globale
```
┌─────────────┬────────────────────────────────────────┐
│   SIDEBAR   │           CONTENU PRINCIPAL             │
│   240px     │                                          │
│   sombre    │   Header (breadcrumb + actions)          │
│             │   ──────────────────────────────────     │
│  Logo       │   Contenu du module                      │
│  Navigation │                                          │
│  ─────────  │                                          │
│  User info  │                                          │
└─────────────┴────────────────────────────────────────┘
```

### Sidebar
- Logo MEMOVIA horizontal en haut (PNG fond transparent)
- Navigation avec icônes + labels, groupée par catégorie
- Élément actif : fond violet clair (#EDE9FF), texte violet (#7C3AED), barre gauche violette
- Hover : fond gris très léger
- En bas : avatar utilisateur + nom + rôle
- Largeur fixe : 240px desktop, icônes seules sur tablette

### Cards / Modules
- Fond blanc, border-radius 12px, ombre légère (box-shadow: 0 1px 3px rgba(0,0,0,0.08))
- Padding interne : 20px
- Titre de card : 14px, font-weight 600, text-secondary
- Valeur principale : 28-32px, font-weight 700, tabular figures

### Métriques clés (KPI cards)
- Icône colorée à gauche
- Valeur principale grande et grasse
- Label en dessous petit et gris
- Variation (↑ +12% vs mois dernier) en vert/rouge selon sens

## Page de login
- Fond blanc côté gauche (60%) : logo M seul centré, grand, avec dégradé violet/cyan
  Formulaire email + mot de passe épuré, bouton violet
- Fond sombre côté droit (40%) : illustration ou citation MEMOVIA
- Pas de header/footer — plein écran

## Logo
- **Sidebar :** logo horizontal complet (M + MEMOVIA.io), fond transparent, blanc sur fond sombre
- **Login :** M seul, grand, centré, dégradé violet → bleu → cyan conservé
- **Favicon :** M seul 32x32px
- Fichiers dans : `public/assets/logo-horizontal.png`, `public/assets/logo-icon.png`

## Animations (Emil Kowalski skill)
- Transitions de navigation : 200ms ease-out
- Apparition des cards : staggered fade-in + légère montée (translateY 8px → 0)
- Hover sur éléments cliquables : scale(1.01) + ombre légère, 150ms
- Chiffres qui s'animent au chargement (count-up)
- Skeleton loading sur toutes les données async
- Pas d'animations excessives — subtil et fonctionnel

## Composants clés

### Tableau de données
- Header gris très léger, sticky
- Alternance fond blanc / fond #FAFAFA sur les lignes
- Hover ligne : fond violet très clair
- Actions sur hover uniquement (edit, delete, view)
- Pagination propre en bas

### Badges de statut
- Prospect : gris pill
- En négociation : jaune pill
- Signé : vert pill
- Actif : cyan pill (couleur MEMOVIA)
- Résilié : rouge pill

### Notifications / Alertes
- Toast en bas à droite (pas en haut — moins intrusif)
- 3 niveaux : info (bleu), succès (vert), erreur (rouge)
- Auto-dismiss 4 secondes

## Ce qu'il faut absolument éviter
- Fond violet ou gradient violet sur toute la page (trop lourd)
- Police Inter ou Arial
- Cards avec trop d'ombres (donne un effet plastique)
- Boutons arrrondis à l'excès (border-radius > 10px sur les boutons)
- Icônes dépareillées (utiliser une seule librairie : Lucide React)
- Tableaux sans alternance ou sans hover
- Texte trop petit (< 13px) sur les données importantes
- Couleur cyan #00E5CC en fond sur de grandes surfaces (trop agressif)

## Commandes à utiliser
Après chaque module codé : `/polish` (Impeccable skill) pour nettoyer l'UI
Pour inspiration références : Taste Skill
