interface PublicPageMetadataOptions {
  title: string;
  description: string;
  canonicalPath?: string;
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
  const description = options.description.trim();
  const origin = window.location.origin;
  const canonicalPath = options.canonicalPath || window.location.pathname;
  const canonicalUrl = new URL(canonicalPath, origin).toString();
  const pageTitle = title.includes('CourtMastr') ? title : `${title} | CourtMastr`;

  document.title = pageTitle;

  upsertMetaTag('meta[name="description"]', 'name', 'description', description);
  upsertMetaTag('meta[property="og:title"]', 'property', 'og:title', pageTitle);
  upsertMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
  upsertMetaTag('meta[property="og:type"]', 'property', 'og:type', options.ogType || 'website');
  upsertMetaTag('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  upsertMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', pageTitle);
  upsertMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  upsertMetaTag(
    'meta[name="robots"]',
    'name',
    'robots',
    options.noIndex ? 'noindex, nofollow' : 'index, follow'
  );
  upsertCanonical(canonicalUrl);
};
