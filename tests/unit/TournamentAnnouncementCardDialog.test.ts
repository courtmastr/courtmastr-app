import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import TournamentAnnouncementCardDialog from '@/features/tournaments/components/TournamentAnnouncementCardDialog.vue';
import html2canvas from 'html2canvas';

vi.mock('html2canvas', () => ({
  default: vi.fn(),
}));

const mountView = () => shallowMount(TournamentAnnouncementCardDialog, {
  props: {
    modelValue: true,
    tournamentName: 'Spring Open',
    tournamentDate: new Date('2026-03-15T00:00:00.000Z'),
    tournamentLocation: 'Dallas, TX',
    logoUrl: '/logo.svg',
  },
  global: {
    renderStubDefaultSlot: true,
    stubs: [
      'v-dialog',
      'v-card',
      'v-card-title',
      'v-card-text',
      'v-card-actions',
      'v-chip',
      'v-spacer',
      'v-btn',
    ],
  },
});

describe('TournamentAnnouncementCardDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(html2canvas).mockResolvedValue({
      toDataURL: () => 'data:image/png;base64,abc',
    } as unknown as HTMLCanvasElement);
  });

  it('calls html2canvas and triggers link download on export', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const wrapper = mountView();

    const buttons = wrapper.findAll('v-btn-stub');
    const downloadButton = buttons.find((button) => button.text().includes('Download PNG'));
    expect(downloadButton).toBeTruthy();

    await downloadButton?.trigger('click');
    await flushPromises();

    expect(html2canvas).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
