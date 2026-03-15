# CourtMastr Horizon Completion Status

Last verified: March 14, 2026

## Horizon 1 (Brand Rollout)

Status: ✅ Complete

- ✅ Brand asset updates (`src/assets/brand/courtmaster-mark.svg`, `src/assets/brand/courtmaster-lockup.svg`)
- ✅ Public shell powered-by footer + shared live badge (`src/components/common/TournamentPublicShell.vue`, `src/components/common/LiveBadge.vue`)
- ✅ Public schedule/scoring integrations (`src/features/public/views/PublicScheduleView.vue`, `src/features/public/views/PublicScoringView.vue`)
- ✅ Check-in branding updates (`src/features/checkin/views/SelfCheckInView.vue`, `src/features/checkin/views/FrontDeskCheckInView.vue`)
- ✅ OBS watermark integration (`src/features/obs/views/ObsScoreboardView.vue`, `src/features/obs/views/ObsScoreBugView.vue`, `src/features/obs/obs.css`)
- ✅ Homepage brand hero refresh (`src/features/public/views/HomeView.vue`, `src/features/public/components/PublicHeroSection.vue`)
- ✅ Printable QR card (`public/printables/qr-card.html`)

## Horizon 2A (Brand Foundation)

Status: ✅ Complete (code track)

- ✅ Public marketing IA routes + footer (`src/router/index.ts`, `src/components/common/PublicWebsiteFooter.vue`, `src/components/layout/AppLayout.vue`)
- ✅ Featured tournament metrics on homepage (`src/composables/useFeaturedTournamentMetrics.ts`, `src/features/public/views/HomeView.vue`)
- ✅ Social proof + moderated reviews system (`src/features/reviews/**`, `functions/src/reviews.ts`, `src/stores/reviews.ts`, `src/services/reviewsService.ts`)
- ✅ About/Pricing/Privacy/Terms pages with legal draft posture (`src/features/public/views/AboutView.vue`, `src/features/public/views/PricingView.vue`, `src/features/public/views/PrivacyView.vue`, `src/features/public/views/TermsView.vue`)
- ✅ White overlay logo + OBS white watermark usage (`src/assets/brand/courtmaster-mark-white.svg`, `src/features/obs/views/ObsScoreboardView.vue`, `src/features/obs/views/ObsScoreBugView.vue`)
- ✅ Organizer announcement card PNG generator (`src/features/tournaments/components/TournamentAnnouncementCardDialog.vue`, `src/features/tournaments/views/TournamentDashboardView.vue`)
- ✅ JSON-LD for public tournament surfaces (`src/components/common/TournamentPublicShell.vue`)
- ✅ External social ops checklist tracked (`docs/ops/horizon-2-social-checklist.md`)

## Horizon 3 (Brand Growth)

Status: ✅ Complete (code + checklist foundation)

- ✅ Landing page templates (`src/features/public/views/TournamentLandingTemplateView.vue`, `src/composables/useTournamentLandingTheme.ts`)
- ✅ Hall of Champions public experience (`src/features/public/views/HallOfChampionsView.vue`, `src/composables/useHallOfChampions.ts`)
- ✅ PWA install prompts on public pages (`src/composables/usePwaInstallPrompt.ts`, `src/features/public/views/PublicScheduleView.vue`, `src/features/public/views/PublicScoringView.vue`, `src/features/public/views/PublicBracketView.vue`)
- ✅ Multilingual foundation (EN/ES) and language toggle (`src/i18n/index.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/es.ts`, `src/components/layout/AppLayout.vue`, `src/features/public/views/HomeView.vue`, `src/features/public/components/PublicHeroSection.vue`)
- ✅ Sponsor branding feature remains active (`src/features/tournaments/components/TournamentBrandingCard.vue`, `src/components/common/TournamentBrandMark.vue`, `src/composables/useTournamentBranding.ts`)
- ✅ Ops-track checklist established (`docs/ops/horizon-3-growth-checklist.md`)

## Remaining Work

- Ops execution: artifacts in Horizon 3 checklist still require business-side completion and links.
