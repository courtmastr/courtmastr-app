import { ref, type Ref } from 'vue';

const clampIndex = (index: number, itemCount: number): number => {
  if (itemCount <= 0) return -1;
  if (index < 0) return -1;
  if (index >= itemCount) return itemCount - 1;
  return index;
};

export interface ActiveIndexNavigation {
  activeIndex: Ref<number>;
  resetActiveIndex: () => void;
  syncActiveIndex: (itemCount: number) => void;
  setActiveIndex: (index: number, itemCount: number) => void;
  moveActiveIndex: (delta: 1 | -1, itemCount: number) => void;
}

export const useActiveIndexNavigation = (): ActiveIndexNavigation => {
  const activeIndex = ref(-1);

  const resetActiveIndex = (): void => {
    activeIndex.value = -1;
  };

  const syncActiveIndex = (itemCount: number): void => {
    activeIndex.value = clampIndex(activeIndex.value, itemCount);
  };

  const setActiveIndex = (index: number, itemCount: number): void => {
    activeIndex.value = clampIndex(index, itemCount);
  };

  const moveActiveIndex = (delta: 1 | -1, itemCount: number): void => {
    if (itemCount <= 0) {
      activeIndex.value = -1;
      return;
    }

    if (activeIndex.value === -1) {
      activeIndex.value = delta > 0 ? 0 : itemCount - 1;
      return;
    }

    const next = (activeIndex.value + delta + itemCount) % itemCount;
    activeIndex.value = next;
  };

  return {
    activeIndex,
    resetActiveIndex,
    syncActiveIndex,
    setActiveIndex,
    moveActiveIndex,
  };
};
