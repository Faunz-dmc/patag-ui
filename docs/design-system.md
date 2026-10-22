# PATAG design system

## Brand and typography

Ink Navy #182B49; Tangerine #F26A32; Warm Paper #F7F1EB; white #FFFFFF; charcoal #26313B; original slate #6C7783. Supporting text uses darker #586471 where needed. Approved peach fills #FDD3BC and #FEE8DD give emphasis without making the whole interface orange. Status chips always include words.

Lilita One is bundled for display moments; Arial is the supporting face. Android requests Arial and falls back to platform sans where unavailable; a licensed Arial font is not redistributed. Official wordmark and mascot assets are preserved. The mascot is used in citizen hero/onboarding/help; operational pages prioritize evidence and work.

## Layout tokens

Web: 84px compact rail, expandable labelled navigation, fluid content with 32px desktop gutters, 20px panel gaps. Major surfaces use 24px radii, fields 14px and primary controls pill radii. Spacing steps 4/8/12/16/20/24/32px. Layouts collapse for tablet and phone; data tables retain horizontal scrolling within their own container.

Flutter: PatagTokens defines 20px gap, 24px surface radius, 16px field radius and 160ms motion. SafeArea protects custom bottom navigation. Reporting preserves a separate step action area and draft state.

## Component patterns

- Display headings: 30–36px native, 32px web, responsive citizen hero. Body 14–16px; supporting labels generally 12px and above, compact badges 11px.
- Summary: one peach feature number plus supporting white metrics; citizen uses a single navy summary with subordinate counts.
- Actions: navy-on-orange web primary action; white-on-navy citizen hero action; quieter outlined secondary controls.
- Inputs: labelled fields, readable neutral fill, visible border and focused outline; error/success states keep explicit text.
- Navigation: pill top navigation and utility rail on web; navy five-item citizen bottom bar with prominent report action.
- Cards: varied sizes by information priority, minimal resting shadows, flat white or peach surfaces. Shadows reserved for overlays/floating navigation.
- Status: textual chips, progress milestone overview and full event history. Awaiting Verification is distinct from Resolved.
- Evidence: before/after panels and large upload controls retain the original validation and administrative approval boundary.
- Charts: single Tangerine series, light gridlines, restrained ticks and actual record counts.
- Motion: short named-property transitions, no decorative looping animation; web reduced-motion override retained.

Implementation: admin-web/src/styles/premium.css, maintenance-web/src/styles/premium.css, citizen-mobile/lib/app/theme.dart and shared/widgets/ui.dart. Browser citizen equivalent: browser-preview/citizen-premium.css.

The interactive preview uses 12 fictional Malolos cases, two fictional crews and clearly labelled demonstration evidence. It is independent of real backend authentication and saves edits in the browser. Map tiles require internet.
