# Responsive Design Guidelines — StudySpace Admin

This document codifies the responsive patterns established across the frontend. All new pages and components **must** follow these conventions.

---

## 1. Breakpoint Reference

| Name | Max-Width | Target Devices |
|------|-----------|----------------|
| `xs` | `<576px` | Phones portrait |
| `sm` | `576px–767px` | Phones landscape |
| `md` | `768px–991px` | Tablets |
| `lg` | `992px–1199px` | Small desktops |
| `xl` | `1200px+` | Large desktops |

**Always use `max-width: 575.98px` / `991.98px` / etc.** — never round numbers — to avoid overlap with Bootstrap's own `min-width` breakpoints.

**Always place mobile-first overrides at the _end_ of the CSS file**, after all base/desktop rules.

**Always match the exact pixel suffix** used in Bootstrap:
- `max-width: 575.98px` (xs)
- `max-width: 767.98px` (sm)
- `max-width: 991.98px` (md)

---

## 2. Layout: Dashboard Shell

The sidebar behavior on mobile is handled in `DashboardShell.css`:

- **`<992px`**: Sidebar becomes a fixed off-canvas overlay, hidden by default (`translateX(-100%)`). Toggle class `.hc-shell--mobile-open` slides it in with a backdrop blur.
- **`<576px`**: Sidebar narrows to 260px; content area height accounts for 56px navbar.
- **`>=992px`**: Sidebar is inline (250px), collapsible to 86px via `.hc-shell--collapsed`.

**Do not** override `#layoutSidenav_nav` sizing outside `DashboardShell.css`.

---

## 3. Grid & Columns

### 3.1 Bootstrap Grid (preferred)

Use Bootstrap's `row` + `col-*` classes for all layout grids:

```jsx
{/* 4 columns on large, 2 on tablet, 1 on mobile */}
<div className="row g-3">
  <div className="col-6 col-md-4 col-lg-3">...</div>
  <div className="col-6 col-md-4 col-lg-3">...</div>
</div>
```

**Column count by breakpoint:**

| Content Type | Desktop (≥992px) | Tablet (768–991px) | Mobile (<768px) |
|-------------|------------------|---------------------|-----------------|
| Stat/metric tiles | 4 | 3 | 2 |
| Module/feature cards | 4 | 2 | 1 |
| Form fields (inline) | 2–3 | 2 | 1 |
| Sidebar panels | persistent | off-canvas | off-canvas |

### 3.2 CSS Grid Fallback

When using CSS Grid (e.g., `.pm-products-list`), wrap with `auto-fit` + `minmax()` and override in media queries:

```css
/* base */
.pm-products-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: var(--hc-space-6);
}

/* mobile override in component CSS */
@media (max-width: 768px) {
  .pm-products-list {
    grid-template-columns: 1fr;
  }
}
```

### 3.3 Full-Width Panels at <992px

For any page with `.col-lg-7` + `.col-lg-5` or `.col-lg-4` + `.col-lg-8` side-by-side panels, force full-width below 992px:

```css
@media (max-width: 991.98px) {
  .my-page .col-lg-7,
  .my-page .col-lg-5 {
    width: 100% !important;
    flex: 0 0 100% !important;
    max-width: 100% !important;
  }
}
```

---

## 4. Typography

Font scaling is automatic via `global.css` media queries:

| Element | Desktop | Mobile (<576px) |
|---------|---------|-----------------|
| `h1` | 2.25rem | ~1.65rem |
| `h2` | 1.875rem | 1.5rem |
| `h3` | 1.5rem | 1.25rem |
| `html` base | 16px | 14px |

**Do not** set fixed `font-size` in px — use `var(--hc-text-*)` or `rem`.

Page title banners (`.pm-header`, `.sm-header`, `.hc-feature-hero`) reduce heading size at `<768px`:

```css
@media (max-width: 768px) {
  .pm-header__title h1 {
    font-size: var(--hc-text-2xl); /* or ~1.5rem */
  }
}
@media (max-width: 575.98px) {
  .pm-header__title h1 {
    font-size: var(--hc-text-xl); /* or ~1.25rem */
  }
}
```

---

## 5. Tables

### 5.1 Horizontal Scroll (default approach)

All data tables **must** be wrapped in a container with `overflow-x: auto`:

```jsx
<div className="table-responsive">
  <table className="table">...</table>
</div>
```

Global CSS at `<576px` reduces cell padding to `0.5rem 0.625rem`.

### 5.2 Card-Style Stack (optional, for complex tables)

Add class `.table-responsive-stack` to the `<table>` element. On screens `<768px` the `<thead>` is hidden and each row becomes a bordered card with label/value pairs. Requires `data-label` attribute on every `<td>`:

```jsx
<td data-label="Status">{value}</td>
```

Use this only for tables with 5+ columns that become unreadable when scrolled.

---

## 6. Cards & Metrics

### 6.1 Metric Cards (`.metric-card` / `.eb-metric-card`)

- **Desktop (≥768px)**: Default sizing via `.metrics-grid` (auto-fit, min 280px).
- **Mobile (<768px)**: `grid-template-columns: 1fr` (single column).
- **Mobile (<576px)**: Reduce font sizes: `.metric-card__value` → `var(--hc-text-2xl)`, `.metric-card__icon` → 40px.

### 6.2 Module / Feature Cards (`.pm-product-card`, `.hc-feature-card`, `HomeModuleCard`)

Use Bootstrap grid for the container:
```jsx
<div className="row g-3">
  {items.map(item => (
    <div className="col-sm-6 col-lg-3" key={item.id}>
      <HomeModuleCard ... />
    </div>
  ))}
</div>
```

Full-width on mobile (`<576px`), 2 columns on tablet, 4 on desktop.

---

## 7. Forms

### 7.1 Inline Layout

Use `row g-3` with `col-md-*` for multi-field rows. Global CSS at `<576px` forces all `col-md-*` children to `width: 100%`.

```jsx
<div className="row g-3">
  <div className="col-md-6">
    <label>Name</label>
    <input className="form-control" />
  </div>
  <div className="col-md-6">
    <label>Email</label>
    <input className="form-control" />
  </div>
</div>
```

### 7.2 Filter Bars

Filter/search rows should stack vertically on mobile:

```jsx
<div className="d-flex gap-3 flex-wrap">
  <div className="flex-grow-1" style={{ minWidth: '280px' }}>
    <input className="form-control" placeholder="Search..." />
  </div>
  <select className="form-select" style={{ minWidth: '160px' }}>
    <option>Filter</option>
  </select>
</div>
```

CSS override:
```css
@media (max-width: 768px) {
  .my-filters { flex-direction: column; }
  .my-filters__search,
  .my-filters__select { width: 100%; }
}
```

---

## 8. Modals & Dialogs

Modal responsiveness is handled globally in `global.css`:

| Property | Desktop | Mobile (<576px) |
|----------|---------|-----------------|
| `--hc-modal-gap` | 0.9rem | 0.4rem |
| `max-width` | `min(100%, 500px)` | `calc(100% - 0.8rem)` |
| border-radius | 24px | 12px |

Inside the dashboard shell, modals are offset by the navbar height:
```css
.hc-dashboard-shell .modal.show .modal-dialog {
  margin-top: calc(60px + var(--hc-modal-gap));
}
```

**Modal footer buttons** stack full-width on mobile (handled globally in `global.css` section `MODAL BODY RESPONSIVE PADDING`).

---

## 9. Buttons

Use `.btn-modern` (custom) or Bootstrap `.btn` classes — they scale automatically.

- **Mobile (<576px)**: Buttons reduce padding via `.btn-modern` override (`var(--hc-space-1) var(--hc-space-3)`)
- Avoid fixed-width buttons. Use `width: 100%` on mobile + `auto` on desktop via breakpoint classes or media queries.

---

## 10. Navbar (`.hc-topnav`)

Defined in `AppNavbar.css` with three-tier responsive:

| Screen | Behavior |
|--------|----------|
| `>=992px` | Full nav: brand, search, org selector, user menu |
| `768–991px` | Brand name hidden, user meta hidden, search narrowed |
| `<768px` | Search hidden, non-essential icon buttons hidden, org label truncated |
| `<576px` | Brand minimal, org label hidden, all actions compact |

**Do not** add permanently visible desktop-only elements that break the nav layout on mobile.

---

## 11. Sidebar (`.hc-sidenav`)

Defined in `AppSideNavbar.css`:

| Screen | Touch targets | Spacing |
|--------|---------------|---------|
| `<992px` | `min-height: 44px` | Tighter padding |
| `<576px` | 26px icon / 28px avatar | Minimal padding |

All nav items must be usable at 44px height (WCAG touch target guideline).

---

## 12. Inline Styles — When You Must Use Them

If a component uses **inline styles** (e.g., `style={{ width: "260px" }}`), you must also add CSS class overrides in a component-specific `.css` file or in `global.css` using attribute selectors with `!important`:

```css
/* global.css or component CSS */
@media (max-width: 991.98px) {
  .my-container > div[style*="border-radius: 20px"][style*="display: flex"] {
    flex-direction: column !important;
  }
}
```

**Prefer CSS classes over inline styles in new code.**

---

## 13. Testing Checklist

Before merging any new page/component, test at these viewports:

- [ ] **375px** (iPhone SE): All content readable, no horizontal scroll, touch targets ≥44px
- [ ] **768px** (iPad portrait): Sidebar off-canvas, 2-column grids, tables scroll
- [ ] **1024px** (iPad landscape): Sidebar visible, 3-4 column grids
- [ ] **1440px+** (desktop): Full layout, no excessive whitespace

**Test interactions:**
- [ ] Sidebar toggle opens/closes on mobile (overlay + backdrop)
- [ ] Modals display correctly (not cut off, scrollable body)
- [ ] Tables scroll horizontally without breaking layout
- [ ] Forms stack vertically on mobile
- [ ] Filter bars wrap/stack on small screens
- [ ] All buttons are tappable (not overlapping)
- [ ] Dropdowns/selects are usable on mobile (not cut off)

---

## 14. CSS File Organization

```
Component CSS file (.e.g., ProductManager.css)
├── Base styles (desktop-first)
├── Component-specific breakpoints (768px, 576px)
└── Any !important overrides needed for inline styles

Global CSS (global.css)
├── Typography & base resets
├── Animations
├── Comprehensive breakpoints (applied site-wide)
├── Page-specific overrides (when no dedicated CSS exists)
└── Utility classes (.d-none-mobile, .d-none-tablet, .table-responsive-auto, etc.)
```

---

## 15. Key CSS Variables for Responsive Work

```css
/* from variables.css */
--hc-bp-sm: 576px;
--hc-bp-md: 768px;
--hc-bp-lg: 992px;

/* spacing — use instead of raw px */
--hc-space-4: 1rem;    /* mobile container padding */
--hc-space-6: 1.5rem;  /* desktop container padding */

/* font sizes */
--hc-text-xs: 0.75rem;   /* mobile table cells, badges */
--hc-text-sm: 0.875rem;  /* body copy, labels */
--hc-text-base: 1rem;
--hc-text-xl: 1.25rem;   /* mobile h3/page titles */
--hc-text-2xl: 1.5rem;   /* mobile h1/h2 */
```

Always reference these variables rather than hardcoding values.

---

*Last updated: June 2026 — corresponds to the responsive update pass across all existing pages.*
