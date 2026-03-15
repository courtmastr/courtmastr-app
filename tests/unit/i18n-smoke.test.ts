import { beforeEach, describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { installI18n, resetI18nForTests, useI18n } from '@/i18n';

const I18nProbe = defineComponent({
  setup() {
    const { t, setLocale } = useI18n();
    return {
      t,
      setLocale,
    };
  },
  template: `
    <div>
      <p data-test="hero">{{ t('home.heroTitle') }}</p>
      <p data-test="cta">{{ t('home.ctaCreateFreeAccount') }}</p>
      <p data-test="missing">{{ t('home.missingKey') }}</p>
      <button data-test="set-es" @click="setLocale('es')">set-es</button>
    </div>
  `,
});

const mountProbe = () => mount(I18nProbe, {
  global: {
    plugins: [{ install: installI18n }],
  },
});

describe('i18n smoke', () => {
  beforeEach(() => {
    resetI18nForTests();
  });

  it('uses english as default locale and falls back to key for unknown translation', () => {
    const wrapper = mountProbe();

    expect(document.documentElement.lang).toBe('en');
    expect(wrapper.get('[data-test="hero"]').text()).toBe('Run tournament operations with confidence.');
    expect(wrapper.get('[data-test="cta"]').text()).toBe('Create Free Account');
    expect(wrapper.get('[data-test="missing"]').text()).toBe('home.missingKey');
  });

  it('switches to spanish locale and updates translated values', async () => {
    const wrapper = mountProbe();

    await wrapper.get('[data-test="set-es"]').trigger('click');

    expect(document.documentElement.lang).toBe('es');
    expect(wrapper.get('[data-test="hero"]').text()).toBe('Gestiona tu torneo con confianza.');
    expect(wrapper.get('[data-test="cta"]').text()).toBe('Crear Cuenta Gratis');
  });
});
