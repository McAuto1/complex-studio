import { useState, useEffect, ReactNode } from 'react';

const listeners = new Set<(path: string) => void>();
let currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/home';

function notify() {
  listeners.forEach(fn => fn(currentPath));
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    currentPath = window.location.pathname + window.location.search;
    notify();
  });
}

export function navigate(to: string) {
  if (currentPath === to) return;
  window.history.pushState(null, '', to);
  currentPath = to;
  notify();
}

export function useLocation() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    listeners.add(setPath);
    return () => {
      listeners.delete(setPath);
    };
  }, []);
  return [path, navigate] as const;
}

export function Link({ href, children, className }: { href: string, children: ReactNode, className?: string }) {
  return (
    <a 
      href={href} 
      className={className} 
      onClick={(e) => { 
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault(); 
        navigate(href); 
      }}
    >
      {children}
    </a>
  );
}
