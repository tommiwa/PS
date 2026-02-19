let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installPromptListeners: Array<(available: boolean) => void> = [];

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            console.log('[PWA] New version available. Refresh to update.');
          }
        });
      });

      console.log('[PWA] Service worker registered successfully');
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  });
}

export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyListeners(false);
    console.log('[PWA] App installed successfully');
  });
}

function notifyListeners(available: boolean) {
  installPromptListeners.forEach((cb) => cb(available));
}

export function onInstallPromptChange(callback: (available: boolean) => void) {
  installPromptListeners.push(callback);
  callback(deferredPrompt !== null);
  return () => {
    installPromptListeners = installPromptListeners.filter((cb) => cb !== callback);
  };
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notifyListeners(false);
  return outcome === 'accepted';
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}
