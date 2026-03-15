import {
  BRAND_NAME,
  BRAND_SOCIAL_IMAGE_PATH,
  DEFAULT_PUBLIC_META_DESCRIPTION,
} from '@/constants/branding';

interface PublicPageMetadataOptions {
  title: string;
  description: string;
  canonicalPath?: string;
  socialImagePath?: string;
  ogType?: 'website' | 'article';
  noIndex?: boolean;
}

const upsertMetaTag = (
  selector: string,
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string
): void => {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const upsertCanonical = (canonicalUrl: string): void => {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', canonicalUrl);
};

export const usePublicPageMetadata = (options: PublicPageMetadataOptions): void => {
  const title = options.title.trim();
  const description = options.description.trim() || DEFAULT_PUBLIC_META_DESCRIPTION;
  const origin = window.location.origin;
  const canonicalPath = options.canonicalPath || window.location.pathname;
  const canonicalUrl = new URL(canonicalPath, origin).toString();
  const socialImagePath = options.socialImagePath || BRAND_SOCIAL_IMAGE_PATH;
  const socialImageUrl = new URL(socialImagePath, origin).toString();
  const pageTitle = title.includes(BRAND_NAME) ? title : `${title} | ${BRAND_NAME}`;

  document.title = pageTitle;

  upsertMetaTag('meta[name="application-name"]', 'name', 'application-name', BRAND_NAME);
  upsertMetaTag('meta[name="apple-mobile-web-app-title"]', 'name', 'apple-mobile-web-app-title', BRAND_NAME);
  upsertMetaTag('meta[name="description"]', 'name', 'description', description);
  upsertMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', BRAND_NAME);
  upsertMetaTag('meta[property="og:title"]', 'property', 'og:title', pageTitle);
  upsertMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
  upsertMetaTag('meta[property="og:type"]', 'property', 'og:type', options.ogType || 'website');
  upsertMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  upsertMetaTag('meta[property="og:image"]', 'property', 'og:image', socialImageUrl);
  upsertMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', pageTitle);
  upsertMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  upsertMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', socialImageUrl);
  upsertMetaTag(
    'meta[name="robots"]',
    'name',
    'robots',
    options.noIndex ? 'noindex, nofollow' : 'index, follow'
  );
  upsertCanonical(canonicalUrl);
};
