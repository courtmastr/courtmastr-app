import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ScoringQrDialog from '@/features/tournaments/components/ScoringQrDialog.vue';

const mockDeps = vi.hoisted(() => ({
  toDataURL: vi.fn(),
  clipboardWriteText: vi.fn(),
  routerResolve: vi.fn(),
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: mockDeps.toDataURL,
  },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    resolve: mockDeps.routerResolve,
  }),
}));

const mountDialog = (props?: Partial<{ modelValue: boolean; tournamentId: string }>) => shallowMount(
  ScoringQrDialog,
  {
    props: {
      modelValue: false,
      tournamentId: 't1',
      ...props,
    },
    global: {
      stubs: [
        'BaseDialog',
        'v-spacer',
        'v-btn',
        'v-img',
        'v-skeleton-loader',
        'v-text-field',
      ],
    },
  }
);

describe('ScoringQrDialog', () => {
  beforeEach(() => {
    mockDeps.toDataURL.mockReset().mockResolvedValue('data:image/png;base64,abc');
    mockDeps.clipboardWriteText.mockReset().mockResolvedValue(undefined);
    mockDeps.routerResolve.mockReset().mockReturnValue({
      href: '/tournaments/t1/scoring-access',
    });

    vi.stubGlobal('window', {
      location: { origin: 'https://courtmastr.com' },
    } as Window & typeof globalThis);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: mockDeps.clipboardWriteText,
      },
    } as unknown as Navigator);
  });

  it('builds the share link from the volunteer scoring route', async () => {
    const wrapper = mountDialog();

    await wrapper.setProps({ modelValue: true });
    await nextTick();

    expect(mockDeps.routerResolve).toHaveBeenCalledWith({
      name: 'volunteer-scoring-access',
      params: { tournamentId: 't1' },
    });
    expect(mockDeps.toDataURL).toHaveBeenCalledWith(
      'https://courtmastr.com/tournaments/t1/scoring-access',
      { width: 240, margin: 1 }
    );
  });

  it('copies the volunteer scoring access link', async () => {
    const wrapper = mountDialog();

    await nextTick();
    await (wrapper.vm as unknown as { copyLink: () => Promise<void> }).copyLink();

    expect(mockDeps.clipboardWriteText).toHaveBeenCalledWith(
      'https://courtmastr.com/tournaments/t1/scoring-access'
    );
    expect(wrapper.emitted('copied')).toEqual([[]]);
  });
});
