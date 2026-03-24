'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  async function handleRegister() {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get registration options from server
      const optionsRes = await fetch('/api/auth/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        setError(data.error || 'Failed to start registration');
        setLoading(false);
        return;
      }

      const options: PublicKeyCredentialCreationOptionsJSON = await optionsRes.json();

      // Start WebAuthn registration
      let attResp;
      try {
        attResp = await startRegistration(options);
      } catch (err: any) {
        setError(err.message || 'Biometric authentication failed');
        setLoading(false);
        return;
      }

      // Verify registration with server
      const verifyRes = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          response: attResp,
        }),
      });

      if (verifyRes.ok) {
        router.push('/');
      } else {
        const data = await verifyRes.json();
        setError(data.error || 'Registration verification failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get authentication options from server
      const optionsRes = await fetch('/api/auth/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        setError(data.error || 'User not found');
        setLoading(false);
        return;
      }

      const options: PublicKeyCredentialRequestOptionsJSON = await optionsRes.json();

      // Start WebAuthn authentication
      let asseResp;
      try {
        asseResp = await startAuthentication(options);
      } catch (err: any) {
        setError(err.message || 'Biometric authentication failed');
        setLoading(false);
        return;
      }

      // Verify authentication with server
      const verifyRes = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          response: asseResp,
        }),
      });

      if (verifyRes.ok) {
        router.push('/');
      } else {
        const data = await verifyRes.json();
        setError(data.error || 'Login verification failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ 
      backgroundColor: 'var(--page-bg)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div className="w-full max-w-md">
        <div className="rounded-2xl shadow-lg p-8" style={{ backgroundColor: 'var(--card-bg)' }}>
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Todo App
            </h1>
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
              Sign in with your passkey
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Username Field */}
            <div>
              <label 
                htmlFor="username" 
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-body)' }}
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 rounded-lg border transition-all"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-body)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-primary)';
                  e.target.style.outline = 'none';
                  e.target.style.boxShadow = '0 0 0 3px var(--focus-ring)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-color)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div 
                className="p-3 rounded-lg text-sm flex items-center gap-2"
                style={{ backgroundColor: '#fed7d7', color: '#c53030' }}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-medium text-white transition-all"
              style={{
                backgroundColor: loading ? '#93c5fd' : 'var(--accent-primary)'
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in with Passkey'
              )}
            </button>

            {/* Register Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleRegister}
                disabled={loading}
                className="text-sm font-medium transition-all"
                style={{ color: 'var(--accent-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Don&apos;t have an account? <span className="font-semibold">Register</span>
              </button>
            </div>
          </form>

          {/* Info Box */}
          <div 
            className="mt-8 p-4 rounded-lg text-sm leading-relaxed"
            style={{ backgroundColor: 'var(--panel-bg)', color: 'var(--text-muted)' }}
          >
            <strong className="font-semibold" style={{ color: 'var(--text-body)' }}>Passkeys</strong> use your device&apos;s biometrics (fingerprint, face recognition) or PIN for secure authentication. No passwords needed!
          </div>
        </div>
      </div>
    </div>
  );
}
