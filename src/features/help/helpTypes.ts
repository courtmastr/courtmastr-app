export type HelpRole = 'organizer' | 'scorekeeper' | 'checkin' | 'player' | 'public' | 'platform';

export interface HelpRoleFilter {
  value: HelpRole;
  label: string;
  icon: string;
}

export interface HelpScreenshot {
  title: string;
  alt: string;
  src?: string;
  notApplicableReason?: string;
}

export interface HelpStep {
  title: string;
  details: string[];
}

export interface HelpProblem {
  problem: string;
  fix: string;
}

export interface HelpTechnicalNote {
  title: string;
  body: string;
  sourceReferences: string[];
}

export interface HelpTopic {
  slug: string;
  title: string;
  summary: string;
  purpose: string;
  audience: HelpRole[];
  beforeYouStart: string[];
  steps: HelpStep[];
  screenshots: HelpScreenshot[];
  commonProblems: HelpProblem[];
  relatedTopics: string[];
  technicalNotes: HelpTechnicalNote[];
}
