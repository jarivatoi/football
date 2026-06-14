// Update manager for PWA - handles automatic updates
class UpdateManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private refreshing = false;

  constructor() {
    this.init();
  }

  private async init() {
    if ('serviceWorker' in navigator) {
      try {
        // Register service worker
        this.registration = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none', // Always check for updates
          scope: '/'
        });

        console.log('✅ UpdateManager: Service worker registered');

        // Listen for updates
        this.registration.addEventListener('updatefound', () => {
          console.log('🔄 UpdateManager: Update found');
          this.handleUpdateFound();
        });

        // Listen for controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('🔄 UpdateManager: Controller changed');
          if (!this.refreshing) {
            this.refreshing = true;
            window.location.reload();
          }
        });

        // Check for updates immediately
        this.checkForUpdates();

        // Check for updates every 30 seconds when app is active
        setInterval(() => {
          if (document.visibilityState === 'visible') {
            this.checkForUpdates();
          }
        }, 30000);

        // Check for updates when app becomes visible
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            setTimeout(() => this.checkForUpdates(), 1000);
          }
        });

      } catch (error) {
        console.error('❌ UpdateManager: Service worker registration failed:', error);
      }
    }
  }

  private handleUpdateFound() {
    if (!this.registration) return;

    const newWorker = this.registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        console.log('✅ UpdateManager: New version available');
        this.updateAvailable = true;
        this.showUpdateNotification();
      }
    });
  }

  private showUpdateNotification() {
    // Create a subtle update notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 4px;">Update Available</div>
          <div style="font-size: 12px; opacity: 0.9;">New version ready to install</div>
        </div>
        <button id="update-btn" style="
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        ">Update</button>
      </div>
    `;

    // Add animation CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Handle update button click
    const updateBtn = notification.querySelector('#update-btn');
    updateBtn?.addEventListener('click', () => {
      this.applyUpdate();
      document.body.removeChild(notification);
      document.head.removeChild(style);
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
            document.head.removeChild(style);
          }
        }, 300);
      }
    }, 10000);
  }

  public async checkForUpdates() {
    if (!this.registration) return;

    try {
      console.log('🔄 UpdateManager: Checking for updates...');
      await this.registration.update();
    } catch (error) {
      console.error('❌ UpdateManager: Update check failed:', error);
    }
  }

  public applyUpdate() {
    if (!this.registration || !this.updateAvailable) return;

    console.log('🔄 UpdateManager: Applying update...');

    // Tell the waiting service worker to skip waiting
    if (this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  public forceUpdate() {
    console.log('🔄 UpdateManager: Forcing update...');
    
    // Clear all caches and reload
    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        ).then(() => {
          window.location.reload();
        });
      });
    } else {
      window.location.reload();
    }
  }
}

// Create global instance
export const updateManager = new UpdateManager();

// Add manual update check function for debugging
(window as any).checkForUpdates = () => updateManager.checkForUpdates();
(window as any).forceUpdate = () => updateManager.forceUpdate();