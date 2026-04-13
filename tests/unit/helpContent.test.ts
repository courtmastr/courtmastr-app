import { describe, expect, it } from 'vitest';
import {
  HELP_ROLE_FILTERS,
  getHelpTopicBySlug,
  getHelpTopicsForRole,
  helpTopics,
} from '@/features/help/helpContent';

describe('help content registry', () => {
  it('defines unique topic slugs and valid related topic links', () => {
    const slugs = helpTopics.map((topic) => topic.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    const slugSet = new Set(slugs);
    const brokenRelatedLinks = helpTopics.flatMap((topic) =>
      topic.relatedTopics
        .filter((slug) => !slugSet.has(slug))
        .map((slug) => `${topic.slug} -> ${slug}`)
    );

    expect(brokenRelatedLinks).toEqual([]);
  });

  it('covers every supported role with at least one topic', () => {
    for (const filter of HELP_ROLE_FILTERS) {
      expect(getHelpTopicsForRole(filter.value).length).toBeGreaterThan(0);
    }
  });

  it('requires user guide fields, screenshots, and technical source references', () => {
    for (const topic of helpTopics) {
      expect(topic.title).toBeTruthy();
      expect(topic.purpose).toBeTruthy();
      expect(topic.audience.length).toBeGreaterThan(0);
      expect(topic.beforeYouStart.length).toBeGreaterThan(0);
      expect(topic.steps.length).toBeGreaterThan(0);
      expect(topic.commonProblems.length).toBeGreaterThan(0);
      expect(topic.screenshots.length).toBeGreaterThan(0);

      for (const screenshot of topic.screenshots) {
        expect(
          Boolean(screenshot.src) || Boolean(screenshot.notApplicableReason)
        ).toBe(true);
        expect(screenshot.alt).toBeTruthy();
      }

      for (const note of topic.technicalNotes) {
        expect(note.sourceReferences.length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves topics by slug', () => {
    expect(getHelpTopicBySlug('run-a-tournament')).toMatchObject({
      slug: 'run-a-tournament',
      title: expect.stringContaining('tournament'),
    });
  });
});
