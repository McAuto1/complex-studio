import { useLocation, Link } from './router';

export type NavItem = {
  label: string;
  href: string;
  key: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/home', key: 'home' },
  { label: 'Explore', href: '/explore', key: 'explore' },
  { label: 'Calculator', href: '/calculator', key: 'calculator' },
  { label: 'Cinematic', href: '/cinematic', key: 'cinematic' },
  { label: 'About', href: '/about', key: 'about' },
];

export function Navigation({ className = 'site-nav' }: { className?: string }) {
  const [fullPath] = useLocation();
  const pathname = fullPath.split('?')[0];
  const normalizedKey = (pathname === '/' || pathname === '' || pathname === '/home')
    ? 'home'
    : pathname.replace('/', '');

  // Filter out the current page from its own navigation
  const visibleItems = NAV_ITEMS.filter(item => item.key !== normalizedKey);

  return (
    <nav className={className}>
      {visibleItems.map(item => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
