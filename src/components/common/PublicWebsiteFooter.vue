<script setup lang="ts">
import { useRoute } from 'vue-router';
import { BRAND_COMPANY_NAME, BRAND_POWERED_BY } from '@/constants/branding';

const currentYear = new Date().getFullYear();
const route = useRoute();

interface PublicFooterLink {
  label: string;
  to: string;
  icon: string;
}

const footerLinks: PublicFooterLink[] = [
  { label: 'Home', to: '/', icon: 'mdi-home-outline' },
  { label: 'About', to: '/about', icon: 'mdi-information-outline' },
  { label: 'Pricing', to: '/pricing', icon: 'mdi-cash-multiple' },
  { label: 'Help', to: '/help', icon: 'mdi-help-circle-outline' },
  { label: 'Privacy', to: '/privacy', icon: 'mdi-shield-check-outline' },
  { label: 'Terms', to: '/terms', icon: 'mdi-file-document-outline' },
];

const isActiveLink = (path: string): boolean =>
  path === '/help' ? route.path.startsWith('/help') : route.path === path;
</script>

<template>
  <footer class="public-website-footer">
    <v-container class="public-website-footer__container py-6">
      <nav
        class="public-website-footer__links"
        aria-label="Public site links"
      >
        <router-link
          v-for="link in footerLinks"
          :key="link.to"
          :to="link.to"
          :class="{ 'is-active': isActiveLink(link.to) }"
          :aria-current="isActiveLink(link.to) ? 'page' : undefined"
        >
          <v-icon
            :icon="link.icon"
            size="14"
            class="public-website-footer__link-icon"
          />
          <span>{{ link.label }}</span>
        </router-link>
      </nav>

      <p class="public-website-footer__tagline">
        Industry-standard tournament operations for badminton organizers.
      </p>

      <p class="public-website-footer__copy">
        © {{ currentYear }} {{ BRAND_COMPANY_NAME }} · {{ BRAND_POWERED_BY }}
      </p>
    </v-container>
  </footer>
</template>

<style scoped>
.public-website-footer {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background:
    linear-gradient(180deg, rgba(var(--v-theme-surface), 0.96) 0%, rgba(239, 246, 255, 0.92) 100%);
}

.public-website-footer__container {
  max-width: 1280px;
}

.public-website-footer__links {
  display: flex;
  flex-wrap: wrap;
  column-gap: 18px;
  row-gap: 8px;
  justify-content: center;
  align-items: center;
  margin-bottom: 10px;
}

.public-website-footer__links a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.72);
  text-decoration: none;
  border-radius: 999px;
  padding: 4px 10px;
  transition: color 160ms ease-out, background-color 160ms ease-out;
}

.public-website-footer__links a:hover {
  color: rgba(var(--v-theme-primary), 0.96);
  background: rgba(var(--v-theme-primary), 0.08);
}

.public-website-footer__links a.is-active {
  color: rgba(var(--v-theme-primary), 0.98);
  background: rgba(var(--v-theme-primary), 0.14);
}

.public-website-footer__links a:focus-visible {
  outline: 2px solid rgba(var(--v-theme-primary), 0.84);
  outline-offset: 2px;
  color: rgba(var(--v-theme-primary), 0.96);
  background: rgba(var(--v-theme-primary), 0.1);
}

.public-website-footer__link-icon {
  color: rgba(var(--v-theme-secondary), 0.88);
}

.public-website-footer__links a.is-active .public-website-footer__link-icon,
.public-website-footer__links a:hover .public-website-footer__link-icon {
  color: rgba(var(--v-theme-primary), 0.92);
}

.public-website-footer__tagline {
  margin: 0 0 8px;
  text-align: center;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), 0.64);
}

.public-website-footer__copy {
  margin: 0;
  text-align: center;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

@media (prefers-reduced-motion: reduce) {
  .public-website-footer__links a {
    transition: none;
  }
}
</style>
