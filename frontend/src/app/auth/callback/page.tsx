'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function GoogleCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (window.opener) {
      window.opener.postMessage(
        { type: 'GOOGLE_AUTH_CALLBACK', code, error },
        window.location.origin,
      );
      window.close();
    }
  }, [searchParams]);

  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p>Autenticando com Google...</p>
    </main>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><p>Autenticando com Google...</p></main>}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
