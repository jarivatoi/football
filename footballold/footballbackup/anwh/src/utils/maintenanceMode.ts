/**
 * Maintenance Mode Utility
 * 
 * Provides easy methods to toggle maintenance mode for the app.
 * When enabled, users will see a maintenance screen instead of the app.
 */

export const maintenanceModeUtils = {
  /**
   * Enable maintenance mode
   * This will show the maintenance screen to all users
   */
  enable: () => {
    localStorage.setItem('maintenanceMode', 'true');
    console.log('✅ Maintenance mode ENABLED');
    console.log('📢 Users will now see the maintenance screen');
    // Don't reload - let the app handle it via state changes
    window.dispatchEvent(new CustomEvent('maintenanceModeChanged', { detail: { enabled: true } }));
  },

  /**
   * Disable maintenance mode
   * This will show the normal app to all users
   */
  disable: () => {
    localStorage.setItem('maintenanceMode', 'false');
    console.log('❌ Maintenance mode DISABLED');
    console.log('📢 Users will now see the normal app');
    // Don't reload - let the app handle it via state changes
    window.dispatchEvent(new CustomEvent('maintenanceModeChanged', { detail: { enabled: false } }));
  },

  /**
   * Check current maintenance mode status
   * @returns true if maintenance mode is enabled
   */
  isEnabled: (): boolean => {
    return localStorage.getItem('maintenanceMode') === 'true';
  },

  /**
   * Toggle maintenance mode
   * Switches between enabled and disabled states
   */
  toggle: () => {
    const currentState = maintenanceModeUtils.isEnabled();
    if (currentState) {
      maintenanceModeUtils.disable();
    } else {
      maintenanceModeUtils.enable();
    }
  }
};

// Expose to window object for easy access from browser console
if (typeof window !== 'undefined') {
  (window as any).maintenanceMode = maintenanceModeUtils;
}
