'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Variant = 'sidebar' | 'banner';

export function InstallPWA({ variant = 'sidebar' }: { variant?: Variant }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem('pwa-install-dismissed');
    if (stored === '1') setDismissed(true);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setIsInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  if (isInstalled || dismissed) return null;
  if (!installPrompt && !isIOS) return null;

  const isBanner = variant === 'banner';

  return (
    <div
      className={
        isBanner
          ? 'fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 border-t border-slate-600 bg-slate-800 px-4 py-3 shadow-lg'
          : 'border-t border-slate-700 p-3 space-y-2'
      }
    >
      {installPrompt ? (
        <>
          <p className={isBanner ? 'text-slate-300 text-sm' : 'text-slate-400 text-xs'}>
            Install Bluecounts for offline use
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleInstall}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Install app
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-300"
              aria-label="Dismiss"
            >
              Not now
            </button>
          </div>
        </>
      ) : isIOS ? (
        <>
          <p className={isBanner ? 'text-slate-300 text-sm' : 'text-slate-400 text-xs'}>
            Install: tap Share <span aria-hidden>⎋</span> then &quot;Add to Home Screen&quot;
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 text-slate-500 hover:text-slate-300 text-sm"
          >
            Dismiss
          </button>
        </>
      ) : null}
    </div>
  );
}
