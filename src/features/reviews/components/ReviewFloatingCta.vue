<script setup lang="ts">
defineEmits<{
  click: [];
}>();
</script>

<template>
  <v-btn
    variant="tonal"
    color="primary"
    class="review-floating-cta"
    prepend-icon="mdi-star-outline"
    size="small"
    aria-label="Leave a review"
    @click="$emit('click')"
  >
    Share Feedback
  </v-btn>
</template>

<style scoped>
.review-floating-cta {
  position: fixed;
  right: max(14px, env(safe-area-inset-right));
  bottom: max(14px, env(safe-area-inset-bottom));
  z-index: 7;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-transform: none;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.18);
  opacity: 0.94;
  transition: transform 180ms ease-out, opacity 180ms ease-out;
}

.review-floating-cta:hover {
  transform: translateY(-2px);
  opacity: 1;
}

@media (max-width: 640px) {
  .review-floating-cta {
    bottom: max(10px, env(safe-area-inset-bottom));
    right: max(10px, env(safe-area-inset-right));
  }
}

@media (prefers-reduced-motion: reduce) {
  .review-floating-cta {
    transition: none;
  }

  .review-floating-cta:hover {
    transform: none;
  }
}
</style>
