# Topbar Navigation Horizontal Layout Design Doc

## Intent & Why
GitHub Issue #37 requests converting the topbar navigation links into a horizontal layout without bullet dots on desktop and tablet screens, while keeping them vertically stacked on mobile screens. This modernizes the site navigation header, improves desktop screen space usage, and maintains touch-friendly vertical usability on smaller mobile screens.

## Goals, Non-Goals, & Anti-Goals
- **Goals**:
  - Remove bullet points (`list-style: none`, `padding-left: 0`) across all screen sizes.
  - Display navigation links horizontally with flexbox and clean spacing on desktop and tablet (`> 720px`).
  - Stack navigation links vertically on mobile screens (`<= 720px`).
  - Maintain active link styling (`.active-nav`) and hover behavior.
  - Ensure zero regressions across `index.html` and all 6 sub-pages in `pages/*.html`.
- **Non-Goals**:
  - Restructuring HTML navigation markup across HTML pages.
  - Adding hamburger menu toggles or drawer slideouts.
- **Anti-Goals**:
  - Breaking navigation link clickability or existing routing.
  - Changing visual appearance on mobile other than removing the bullet dots and cleaning margins.

## Constraints
- Must adhere to the project's centralized styling architecture in `src/index.css`.
- Must align with the existing responsive breakpoint (`@media (max-width: 720px)`).
- Must pass all production builds (`npm run build`) and test suites (`npm test`).

## Approaches Considered
1. **Responsive Flexbox in `src/index.css` (Chosen)**:
   - Configure `.nav-list` with `list-style: none`, `padding: 0`, and `display: flex; flex-direction: row; flex-wrap: wrap; gap: 16px; align-items: center;`.
   - In `@media (max-width: 720px)`, switch `.nav-list` to `flex-direction: column; align-items: flex-start; gap: 8px;`.
   - **Trade-offs**: Centralized, zero HTML changes required across pages, zero runtime overhead.
2. **Utility-First HTML Classes Across All Pages**:
   - Update `<ul>` markup in `index.html` and all pages in `pages/` with utility classes.
   - **Trade-offs**: Inconsistent with current centralized header styles and requires editing 7 HTML files.

## Builder Specifications
1. **`src/index.css`**:
   - Update `.nav-list` rule:
     ```css
     .nav-list {
       margin: 0 0 14px 0;
       padding: 0;
       list-style: none;
       display: flex;
       flex-direction: row;
       flex-wrap: wrap;
       align-items: center;
       gap: 16px;
     }

     .nav-list li {
       margin: 0;
     }
     ```
   - In `@media (max-width: 720px)`:
     ```css
     .nav-list {
       flex-direction: column;
       align-items: flex-start;
       gap: 8px;
     }
     ```
2. **Verification & Tests**:
   - Add automated test assertions verifying `.nav-list` rules in `src/index.css` (or dedicated nav test) so regressions are caught in CI.
   - Run `npm test` and `npm run build` to ensure clean exit code 0.
