<script setup lang="ts">
const currentYear = new Date().getFullYear();
</script>

<template>
  <footer class="public-website-footer">
    <v-container class="public-website-footer__container py-6">
      <nav
        class="public-website-footer__links"
        aria-label="Public site links"
      >
        <router-link to="/about">
          About
        </router-link>
        <router-link to="/pricing">
          Pricing
        </router-link>
        <router-link to="/privacy">
          Privacy
        </router-link>
        <router-link to="/terms">
          Terms
        </router-link>
      </nav>

      <p class="public-website-footer__copy">
        © {{ currentYear }} Marvy Technologies · by CourtMastr · Powered by CourtMastr
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

.public-website-footer__links a:focus-visible {
  outline: 2px solid rgba(var(--v-theme-primary), 0.84);
  outline-offset: 2px;
  color: rgba(var(--v-theme-primary), 0.96);
  background: rgba(var(--v-theme-primary), 0.1);
}

.public-website-footer__copy {
  margin: 0;
  text-align: center;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
