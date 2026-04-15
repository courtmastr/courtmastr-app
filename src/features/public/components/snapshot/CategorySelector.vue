<script setup lang="ts">
import type { CategorySnapshot } from '@/types';

interface Props {
  categories: CategorySnapshot[];
  modelValue: string;  // selected category id
}

const props = defineProps<Props>();
const emit = defineEmits<{ 'update:modelValue': [id: string] }>();
</script>

<template>
  <div class="cat-selector">
    <div class="cat-selector__label">Division</div>
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
  animation: fadeUp 0.4s ease both;
  animation-delay: 0.3s;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
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
  animation: chipBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 12px rgba(21,101,192,0.45);
}
@keyframes chipBounce {
  from { transform: scale(0.88); }
  to   { transform: scale(1); }
}
</style>
