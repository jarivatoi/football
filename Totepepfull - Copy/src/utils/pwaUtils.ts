// PWA utility functions

// Check if we're in a supported environment for Service Workers
const isServiceWorkerSupported = (): boolean => {
  return (
    'serviceWorker' in navigator &&
    !window.location.hostname.includes('stackblitz') &&
    !window.location.hostname.includes('webcontainer')
  );
};

// Check if we're in a supported environment for Background Sync
const isBackgroundSyncSupported = (): boolean => {
  return (
    isServiceWorkerSupported() &&
    'sync' in window.ServiceWorkerRegistration.prototype
  );
};

export const registerServiceWorker = async (): Promise<void> => {
  if (isServiceWorkerSupported()) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', registration);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, notify user
              console.log('New content available, please refresh');
              showUpdateNotification();
            }
          });
        }
      });
      
    } catch (error) {
      console.warn('Service Worker registration failed:', error);
    }
  } else {
    console.info('Service Worker not supported in this environment (StackBlitz/WebContainer)');
  }
};

export const showUpdateNotification = (): void => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Totelepep Update Available', {
      body: 'A new version is available. Refresh to update.',
      icon: '/icon-192.png',
      tag: 'app-update'
    });
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const scheduleBackgroundSync = (): void => {
  if (isBackgroundSyncSupported()) {
    navigator.serviceWorker.ready.then((registration) => {
      return registration.sync.register('background-sync-matches');
    }).catch((error) => {
      console.warn('Background sync registration failed:', error);
    });
  } else {
    console.info('Background sync not supported in this environment');
  }
};

export const checkForUpdates = async (): Promise<void> => {
  if (isServiceWorkerSupported()) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
    }
  }
};

export const clearCache = async (): Promise<void> => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('All caches cleared');
  }
};

export const getCacheSize = async (): Promise<number> => {
  if ('caches' in window && 'storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }
  return 0;
};

export const isStandalone = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone ||
         document.referrer.includes('android-app://');
};