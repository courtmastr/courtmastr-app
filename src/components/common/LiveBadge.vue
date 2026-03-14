<script setup lang="ts">
// No props - this badge is shown or hidden by the parent view.
</script>

<template>
  <span
    class="live-badge"
    aria-label="Live"
  >
    <span
      class="live-badge__dot"
      aria-hidden="true"
    />
    LIVE
  </span>
</template>

<style scoped lang="scss">
.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background-color: #16a34a;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: 9999px;
  text-transform: uppercase;
  vertical-align: middle;
}

.live-badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #ffffff;
  animation: live-pulse 1.4s ease-in-out infinite;
}

@keyframes live-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.4;
    transform: scale(0.75);
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-badge__dot {
    animation: none;
  }
}
</style>
