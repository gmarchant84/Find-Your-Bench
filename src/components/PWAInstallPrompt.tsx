import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    const wasDismissed = localStorage.getItem('fyb_pwa_dismissed');
    if (wasDismissed) return;

    // Check if already running as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // iOS detection — Safari doesn't support beforeinstallprompt
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      // Show iOS instructions after 30s on mobile
      const timer = setTimeout(() => setShowBanner(true), 30000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome: listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('fyb_pwa_dismissed', '1');
  };

  if (!showBanner || dismissed) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[150] animate-slide-up">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3 max-w-sm mx-auto">
        <img src="/fyb-logo.png" alt="FYB" className="w-10 h-10 rounded-xl object-contain flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Add to Home Screen</p>
          {isIOS ? (
            <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">
              Tap <span className="text-white font-semibold">Share</span> then{' '}
              <span className="text-white font-semibold">"Add to Home Screen"</span> for the full app experience.
            </p>
          ) : (
            <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">
              Install Find Your Bench for faster access and offline browsing.
            </p>
          )}
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-400 text-white rounded-lg text-xs font-bold transition"
            >
              <Download className="w-3.5 h-3.5" />
              Install App
            </button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-gray-400 hover:text-white transition flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
