<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { gsap } from 'gsap';
import type { CategorySnapshot } from '@/types';

interface Props {
  categories: CategorySnapshot[];
  modelValue: string;  // selected category id
}

const props = defineProps<Props>();
const emit = defineEmits<{ 'update:modelValue': [id: string] }>();

const selectorRef = ref<HTMLElement | null>(null);
let ctx: ReturnType<typeof gsap.context> | null = null;

onMounted(() => {
  if (!selectorRef.value) return;
  ctx = gsap.context(() => {
    const mm = gsap.matchMedia();
    mm.add({ reduce: '(prefers-reduced-motion: reduce)' }, (context) => {
      const { reduce } = (context as unknown as { conditions: { reduce: boolean } }).conditions;
      if (reduce) return;
      gsap.from('.cat-selector', { y: 10, autoAlpha: 0, duration: 0.3, ease: 'power2.out' });
      gsap.from('.cat-chip', {
        y: 8, autoAlpha: 0, scale: 0.88,
        duration: 0.35,
        ease: 'back.out(1.7)',
        stagger: { each: 0.06, from: 'start' },
        delay: 0.1,
      });
    });
  }, selectorRef.value);
});

onUnmounted(() => { ctx?.revert(); });
</script>

<template>
  <div
    ref="selectorRef"
    class="cat-selector"
  >
    <div class="cat-selector__label">
      Division
    </div>
    <div class="cat-selector__chips">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="cat-chip"
        :class="{ 'cat-chip--active': cat.id === modelValue }"
        @click="emit('update:modelValue', cat.id)"
      >
        {{ cat.name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.cat-selector {
  background: #1e293b;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  position: relative;
}
.cat-selector::after {
  content: '';
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 36px;
  background: linear-gradient(to left, #1e293b 20%, transparent);
  pointer-events: none;
  z-index: 1;
}
.cat-selector__label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}
.cat-selector__chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.cat-selector__chips::-webkit-scrollbar {
  display: none;
}
.cat-chip {
  flex-shrink: 0;
  border: none;
  padding: 10px 18px;
  min-height: 44px;
  border-radius: 22px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  touch-action: manipulation;
  display: flex;
  align-items: center;
}
.cat-chip:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
.cat-chip--active {
  background: linear-gradient(135deg, #1d4ed8, #6d28d9);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 0 12px rgba(21,101,192,0.45);
}
</style>
