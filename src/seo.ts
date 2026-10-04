import { useEffect } from 'react';

export interface RouteMeta {
  title: string;
  description: string;
  canonicalPath: string;
}

const BASE_URL = 'https://complex-studio.vercel.app';

export const ROUTE_METADATA: Record<string, RouteMeta> = {
  '/': {
    title: 'Complex Studio — Mathematical Visualizer',
    description: 'Interactive mathematical visualization for real and complex functions. Explore 2D graphs, domain coloring, and cinematic 3D surfaces in real-time WebGL.',
    canonicalPath: '/',
  },
  '/home': {
    title: 'Complex Studio — Mathematical Visualizer',
    description: 'Interactive mathematical visualization for real and complex functions. Explore 2D graphs, domain coloring, and cinematic 3D surfaces in real-time WebGL.',
    canonicalPath: '/', // /home canonicalizes to /
  },
  '/calculator': {
    title: '3D Function Calculator — Complex Studio',
    description: 'Explore real and complex functions with interactive 2D graphs, domain coloring, multi-axis 3D surfaces, and point inspection under your cursor.',
    canonicalPath: '/calculator',
  },
  '/cinematic': {
    title: 'Complex Function 3D Visualizer — Complex Studio',
    description: 'Cinematic 3D mathematical surfaces with studio lighting, polar wrapped grids, analytic height caps, and high-resolution PNG export.',
    canonicalPath: '/cinematic',
  },
  '/explore': {
    title: 'Mathematical Function Gallery — Complex Studio',
    description: 'Curated gallery of real and complex functions. Discover branch points, essential singularities, periodic manifolds, and the Riemann zeta function.',
    canonicalPath: '/explore',
  },
  '/about': {
    title: 'About Complex Studio — Interactive Mathematical Workbench',
    description: 'Learn about Complex Studio, an interactive visualizer built to make difficult real and complex mathematical functions easier to see and understand.',
    canonicalPath: '/about',
  },
  '/riemann-zeta': {
    title: 'Riemann Zeta Function — Interactive 3D Visualization | Complex Studio',
    description: 'Explore the Riemann zeta function in the complex plane. Interactive 3D surface mapping logarithmic magnitude ln(|ζ(s)|), critical strip, and nontrivial zeros.',
    canonicalPath: '/riemann-zeta',
  },
};

export function updatePageMeta(fullPath: string) {
  if (typeof document === 'undefined') return;

  const pathname = fullPath.split('?')[0] || '/';
  const meta = ROUTE_METADATA[pathname] || ROUTE_METADATA['/'];

  // 1. Update Document Title
  document.title = meta.title;

  // 2. Update or Create Meta Description
  let descTag = document.querySelector('meta[name="description"]');
  if (!descTag) {
    descTag = document.createElement('meta');
    descTag.setAttribute('name', 'description');
    document.head.appendChild(descTag);
  }
  descTag.setAttribute('content', meta.description);

  // 3. Update or Create Meta Title
  let titleMeta = document.querySelector('meta[name="title"]');
  if (titleMeta) {
    titleMeta.setAttribute('content', meta.title);
  }

  // 4. Update Canonical Link
  let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  const canonicalUrl = `${BASE_URL}${meta.canonicalPath}`;
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // 5. Update Open Graph Meta
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', meta.title);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', meta.description);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', canonicalUrl);

  // 6. Update Twitter Meta
  const twTitle = document.querySelector('meta[name="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', meta.title);

  const twDesc = document.querySelector('meta[name="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', meta.description);

  const twUrl = document.querySelector('meta[name="twitter:url"]');
  if (twUrl) twUrl.setAttribute('content', canonicalUrl);
}

export function usePageMeta(fullPath: string) {
  useEffect(() => {
    updatePageMeta(fullPath);
  }, [fullPath]);
}
