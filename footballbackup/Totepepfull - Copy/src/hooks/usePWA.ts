import { useState, useEffect } from 'react';

interface PWAHook {
  isInstalled: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  isOnline: boolean;
}

// Add a safety check for React
const isReactAvailable = () => {
  try {
    return typeof useState === 'function' && typeof useEffect === 'function';
  } catch {
    return false;
  }
};

export const usePWA = (): PWAHook => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || !isReactAvailable()) {
    return {
      isInstalled: false,
      isStandalone: false,
      canInstall: false,
      isOnline: true
    };
  }

  try {
    const [isInstalled, setIsInstalled] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [canInstall, setCanInstall] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
      // Check if app is installed/standalone
      const checkStandalone = () => {
        try {
          const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                            (window.navigator as any).standalone ||
                            document.referrer.includes('android-app://');
          setIsStandalone(standalone);
          setIsInstalled(standalone);
        } catch (error) {
          console.warn('Error checking standalone mode:', error);
          setIsStandalone(false);
          setIsInstalled(false);
        }
      };

      // Check if app can be installed
      const handleBeforeInstallPrompt = (e: Event) => {
        try {
          e.preventDefault();
          setCanInstall(true);
        } catch (error) {
          console.warn('Error handling beforeinstallprompt:', error);
          setCanInstall(false);
        }
      };

      // Handle online/offline status
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      // Handle app installation
      const handleAppInstalled = () => {
        setIsInstalled(true);
        setCanInstall(false);
      };

      try {
        checkStandalone();

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
          window.removeEventListener('appinstalled', handleAppInstalled);
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      } catch (error) {
        console.warn('Error setting up PWA event listeners:', error);
        return () => {};
      }
    }, []);

    return {
      isInstalled,
      isStandalone,
      canInstall,
      isOnline
    };
  } catch (error) {
    console.warn('Error initializing usePWA hook:', error);
    // Return safe defaults
    return {
      isInstalled: false,
      isStandalone: false,
      canInstall: false,
      isOnline: true
    };
  }
};