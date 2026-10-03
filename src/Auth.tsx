import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

export function Auth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession((prev) => prev || session);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (mounted) {
        setSession(session);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    try {
      setIsSigningIn(true);
      setError('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) {
        setError(error.message);
        setIsSigningIn(false);
      }
    } catch (err: any) {
      setError(err.message || 'Error signing in');
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div style={{ fontSize: '12px', color: '#8a9ab0', padding: '4px 8px' }}>...</div>;
  }

  if (session) {
    const user = session.user;
    const displayName = user.user_metadata?.full_name || user.email || 'User';
    const email = user.email;
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
    
    return (
      <div className="auth-menu-container" ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button 
          className="auth-btn" 
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ 
            background: 'transparent', border: '1px solid #3c4b63', color: '#e2e8f0', 
            padding: '2px 8px 2px 2px', borderRadius: '16px', fontSize: '13px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%' }} />
          ) : (
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#3c4b63', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span>{displayName} ▾</span>
        </button>
        {menuOpen && (
          <div className="auth-dropdown" style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '8px',
            background: '#161c24', border: '1px solid #293243', borderRadius: '6px',
            padding: '6px', minWidth: '180px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left'
          }}>
            <div style={{ padding: '4px 8px 8px 8px', borderBottom: '1px solid #293243', marginBottom: '2px' }}>
              <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              {email && <div style={{ fontSize: '11px', color: '#8895a7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{email}</div>}
              <div style={{ marginTop: '8px', display: 'inline-block', background: '#252d38', color: '#a0aec0', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #3c4b63' }}>Free Plan</div>
            </div>
            <button 
              onClick={handleSignOut}
              style={{
                width: '100%', background: 'transparent', border: 'none', color: '#e2e8f0',
                padding: '6px 8px', textAlign: 'left', fontSize: '13px', cursor: 'pointer',
                borderRadius: '4px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#293243'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {error && <span style={{ color: '#ff6b6b', fontSize: '12px' }}>{error}</span>}
      <button 
        className="auth-btn" 
        onClick={handleSignIn}
        disabled={isSigningIn}
        style={{ 
          background: '#293243', border: 'none', color: isSigningIn ? '#8895a7' : '#e2e8f0', 
          padding: '4px 12px', borderRadius: '4px', fontSize: '13px', cursor: isSigningIn ? 'not-allowed' : 'pointer',
          fontWeight: 500,
          opacity: isSigningIn ? 0.7 : 1
        }}
        onMouseEnter={(e) => { if (!isSigningIn) e.currentTarget.style.background = '#3c4b63'; }}
        onMouseLeave={(e) => { if (!isSigningIn) e.currentTarget.style.background = '#293243'; }}
      >
        {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
      </button>
    </div>
  );
}
