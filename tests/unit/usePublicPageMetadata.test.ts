import { beforeEach, describe, expect, it } from 'vitest';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';

const clearMetadata = (): void => {
  const selectors = [
    'meta[name="description"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:type"]',
    'meta[property="og:url"]',
    'meta[name="twitter:card"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'meta[name="robots"]',
    'link[rel="canonical"]',
  ];

  selectors.forEach((selector) => {
    const node = document.head.querySelector(selector);
    if (node?.parentNode) {
      node.parentNode.removeChild(node);
    }
  });
};

describe('usePublicPageMetadata', () => {
  beforeEach(() => {
    document.title = '';
    clearMetadata();
  });

  it('sets document title and description for public pages', () => {
    usePublicPageMetadata({
      title: 'Pricing',
      description: 'Free Beta pricing for CourtMastr.',
      canonicalPath: '/pricing',
    });

    expect(document.title).toContain('Pricing');
    expect(document.title).toContain('CourtMastr');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toContain('Free Beta');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toContain('/pricing');
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content'))
      .toContain('/pricing');
  });
});
