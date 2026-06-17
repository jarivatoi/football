/**
 * Clear User Session - Debug Utility
 * 
 * Run this in browser console to clear saved session:
 * 
 * import('./src/utils/clearSession.ts').then(mod => mod.clearSession());
 * 
 * Or manually clear:
 * - Open DevTools > Application > IndexedDB
 * - Delete TotelepepUserDB database
 * - Refresh page
 */

export const clearSession = async () => {
  try {
    // Clear from IndexedDB
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('TotelepepUserDB');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    const transaction = db.transaction('userSessions', 'readwrite');
    const store = transaction.objectStore('userSessions');
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
    };
    
    clearRequest.onerror = () => {
    };
  } catch (error) {
  }
};

// Make it available in console
if (typeof window !== 'undefined') {
  (window as any).clearSession = clearSession;
}
