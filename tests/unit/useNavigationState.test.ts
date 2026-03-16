import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Vuetify's useDisplay and vue-router before importing composable
vi.mock('vuetify', () => ({
  useDisplay: () => ({ smAndDown: { value: false } }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Import AFTER mocks (module-level state reads localStorage on import)
// Use a fresh module for each test via vi.resetModules()
describe('useNavigationState', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.resetModules();
  });

  it('rail defaults to false when localStorage is empty', async () => {
    const { useNavigationState } = await import('@/composables/useNavigationState');
    const { rail } = useNavigationState();
    expect(rail.value).toBe(false);
  });

  it('rail reads persisted value from localStorage', async () => {
    localStorageMock.setItem('courtmaster_sidebar_rail', 'true');
    const { useNavigationState } = await import('@/composables/useNavigationState');
    const { rail } = useNavigationState();
    expect(rail.value).toBe(true);
  });

  it('collapseToRail sets rail to true and persists', async () => {
    const { useNavigationState } = await import('@/composables/useNavigationState');
    const { rail, collapseToRail } = useNavigationState();
    collapseToRail();
    expect(rail.value).toBe(true);
  });

  it('expandFromRail sets rail to false', async () => {
    localStorageMock.setItem('courtmaster_sidebar_rail', 'true');
    const { useNavigationState } = await import('@/composables/useNavigationState');
    const { rail, expandFromRail } = useNavigationState();
    expandFromRail();
    expect(rail.value).toBe(false);
  });

  it('sections default correctly — shareStream collapsed, others expanded', async () => {
    const { useNavigationState } = await import('@/composables/useNavigationState');
    const { sections } = useNavigationState();
    expect(sections.value.dayOf).toBe(true);
    expect(sections.value.results).toBe(true);
    expect(sections.value.prepare).toBe(true);
    expect(sections.value.shareStream).toBe(false);
  });

  it('toggleSection flips a section', async () => {
    const { useNavigationState } = await import('@/composables/useNavigationState');
    const { sections, toggleSection } = useNavigationState();
    expect(sections.value.dayOf).toBe(true);
    toggleSection('dayOf');
    expect(sections.value.dayOf).toBe(false);
    toggleSection('dayOf');
    expect(sections.value.dayOf).toBe(true);
  });

  it('sections are shared across composable calls (singleton)', async () => {
    const { useNavigationState } = await import('@/composables/useNavigationState');
    const a = useNavigationState();
    const b = useNavigationState();
    a.toggleSection('results');
    expect(b.sections.value.results).toBe(false);
  });

  it('rail is shared across composable calls (singleton)', async () => {
    const { useNavigationState } = await import('@/composables/useNavigationState');
    const a = useNavigationState();
    const b = useNavigationState();
    a.collapseToRail();
    expect(b.rail.value).toBe(true);
  });
});
