# Design System — Breaking Accelerator

## Couleurs

| Nom | Hex | Usage |
|-----|-----|-------|
| Cream | `#F5F3EF` | Fond principal |
| Cream Dark | `#EBE8E0` | Sections alternées, cards |
| Cream Darker | `#E5E1D8` | Hover sur cards |
| Charcoal | `#1C1C1C` | Sections sombres, footer, nav CTA |
| Stone 900 | `#1C1C1C` | Texte principal, boutons primaires |
| Stone 600 | `#57534e` | Texte secondaire |
| Stone 500 | `#78716c` | Sous-titres, labels |
| Stone 400 | `#a8a29e` | Texte désactivé, séparateurs |
| Stone 300 | `#d6d3d1` | Bordures |

## Typographie

| Famille | Poids | Usage |
|---------|-------|-------|
| DM Serif Display | Regular + Italic | Tous les titres (h1-h6), brand name |
| Manrope | 300, 400, 500, 600, 700 | Corps, nav, labels, boutons |

**Tailles titres :**
- H1 hero : `text-6xl md:text-8xl lg:text-9xl`, tracking-tighter, line-height 0.9
- H2 sections : `text-4xl md:text-6xl`, tracking-tight
- H3 : `text-4xl md:text-5xl`, tracking-tight
- H4 cards : `text-3xl`, tracking-tight
- H5 journal : `text-2xl`, tracking-tight

**Labels/catégories :** `text-xs uppercase tracking-widest font-medium text-stone-500`

## Espacement

- Section padding : `py-20 md:py-24 px-6 md:px-12`
- Max width contenu : `max-w-4xl mx-auto` (texte centré) / `max-w-7xl mx-auto` (full width)
- Gap cards : `gap-8`
- Gap sections internes : `space-y-8`

## Composants récurrents

### Bouton primaire (fond sombre)
```html
<a href="..." class="px-8 py-4 bg-stone-900 text-[#F5F3EF] rounded-full hover:bg-stone-700 transition-colors font-medium">
  Texte du bouton →
</a>
```

### Bouton secondaire (outline)
```html
<a href="..." class="px-8 py-4 border border-stone-300 text-stone-900 rounded-full hover:bg-stone-200 transition-all font-medium">
  Texte du bouton
</a>
```

### Card (fond crème)
```html
<div class="group bg-[#EBE8E0] p-8 md:p-10 rounded-2xl hover:bg-[#E5E1D8] transition-colors duration-300 flex flex-col h-full">
  <!-- contenu -->
</div>
```

### Section sombre
```html
<section class="py-20 px-6 md:px-12 bg-[#1C1C1C] text-[#F5F3EF] rounded-t-[3rem]">
  <!-- contenu -->
</section>
```

### Article Journal (card minimaliste)
```html
<a href="..." class="group block border-t border-stone-300 pt-6">
  <span class="text-xs text-stone-500 uppercase tracking-widest font-medium block mb-4">CATÉGORIE</span>
  <h5 class="text-2xl font-serif text-stone-900 mb-4 group-hover:text-stone-600 transition-colors">Titre</h5>
  <span class="inline-flex items-center text-sm font-semibold uppercase tracking-wider text-stone-900">
    Lire l'article →
  </span>
</a>
```

## Layout de nouvelle page

Pour créer une nouvelle page, utilise ce template :

```astro
---
import Layout from '../layouts/Layout.astro';

const LP_URL = 'https://breaking.dancingaccelerator.com/f6c65326';
---

<Layout title="Titre de la page | Breaking Accelerator" description="Description SEO">
  <!-- Sections ici -->
</Layout>
```

## Images

- Dossier : `/public/images/`
- `hero.jpg` : photo hero homepage (Bboy Junior)
- `junior-action.jpg` : photo section sombre (Bboy Junior en action)
- Format recommandé : JPG, max 800KB, 1400px de large minimum

## Déploiement

- `npm run dev` → preview local sur `localhost:4321`
- `npm run build` → build dans `dist/`
- `git push` → déploiement automatique Cloudflare Pages
