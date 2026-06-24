/**
 * Match Cache using IndexedDB
 * Stores matches in chunks to prevent memory overload
 * Allows progressive loading and persistence across reloads
 */

const DB_NAME = 'TotelepepMatchCache';
const DB_VERSION = 2; // Incremented to add betslip store
const STORE_NAME = 'matches';
const BETSLIP_STORE_NAME = 'betslip'; // Betslip persistence
const CHUNK_SIZE = 100; // Load and save in chunks of 100 matches
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes - refresh odds data

// Helper to get source-specific betslip key
const getBetslipKey = (sourceId: string = 'default'): string => `betslip_${sourceId}`;

interface MatchCacheEntry {
  id: string;
  cacheKey: string; // e.g., "date_2026-06-18_totelepep"
  match: any; // TotelepepMatch
  timestamp: number;
}

interface CacheMetadata {
  cacheKey: string;
  totalMatches: number;
  loadedMatches: number;
  isComplete: boolean;
  lastUpdated: number;
}

// Open database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store for matches
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('cacheKey', 'cacheKey', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Create metadata store
      if (!db.objectStoreNames.contains('metadata')) {
        const metadataStore = db.createObjectStore('metadata', { keyPath: 'cacheKey' });
      }
      
      // Create betslip store
      if (!db.objectStoreNames.contains(BETSLIP_STORE_NAME)) {
        db.createObjectStore(BETSLIP_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
};

// Save a chunk of matches to IndexedDB
export const saveMatchesChunk = async (
  matches: any[],
  cacheKey: string,
  loadedCount: number,
  totalCount: number,
  isComplete: boolean = false
): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME, 'metadata'], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const metadataStore = transaction.objectStore('metadata');

    // Save matches
    const entries: MatchCacheEntry[] = matches.map(match => ({
      id: `${cacheKey}_${match.id}`, // Include cacheKey in ID to prevent cross-date overwrites
      cacheKey,
      match,
      timestamp: Date.now()
    }));

    entries.forEach(entry => {
      store.put(entry);
    });

    // Update metadata
    metadataStore.put({
      cacheKey,
      totalMatches: totalCount,
      loadedMatches: loadedCount,
      isComplete,
      lastUpdated: Date.now()
    });

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => {
        if (isComplete) {
          console.log(`[IndexedDB] ${cacheKey}: Save complete - ${loadedCount}/${totalCount} matches saved`);
          // Verify save by reading back immediately
          setTimeout(async () => {
            try {
              const { matches } = await getCachedMatches(cacheKey);
              console.log(`[IndexedDB Verify] ${cacheKey}: Read back ${matches?.length || 0} matches`);
            } catch (e) {
              console.error(`[IndexedDB Verify] ${cacheKey}: Failed to verify`, e);
            }
          }, 100);
        }
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error(`[IndexedDB] ${cacheKey}: Save failed!`, error);
  }
};

// Get cached matches for a specific cache key
export const getCachedMatches = async (cacheKey: string): Promise<{
  matches: any[];
  metadata: CacheMetadata | null;
}> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME, 'metadata'], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const metadataStore = transaction.objectStore('metadata');

    // Get metadata
    const metadataRequest = metadataStore.get(cacheKey);
    const metadata: CacheMetadata | null = await new Promise((resolve) => {
      metadataRequest.onsuccess = () => resolve(metadataRequest.result || null);
      metadataRequest.onerror = () => resolve(null);
    });

    // Get all matches for this cache key
    const index = store.index('cacheKey');
    const matchesRequest = index.getAll(cacheKey);
    const matches: any[] = await new Promise((resolve, reject) => {
      matchesRequest.onsuccess = () => {
        const entries: MatchCacheEntry[] = matchesRequest.result;
        console.log(`[IndexedDB Read] ${cacheKey}: Found ${entries.length} entries`);
        resolve(entries.map(entry => entry.match));
      };
      matchesRequest.onerror = () => reject(matchesRequest.error);
    });

    // Filter out past matches (kickoff time has passed)
    const now = new Date();
    const validMatches = matches.filter(match => {
      if (!match.date || !match.kickoff) return true; // Keep if missing data
      
      try {
        // Parse match datetime (e.g., "2026-06-18" + "13:59")
        const matchDateTime = new Date(`${match.date}T${match.kickoff}`);
        return matchDateTime > now; // Keep only future matches
      } catch {
        return true; // Keep if can't parse
      }
    });

    // If we filtered out matches, update the cache
    if (validMatches.length < matches.length) {
      // Note: We don't delete here to avoid write transaction on read
      // Deletion will happen when new data is saved
    }

    return { matches: validMatches, metadata };
  } catch (error) {
    return { matches: [], metadata: null };
  }
};

// Get cache metadata
export const getCacheMetadata = async (cacheKey: string): Promise<CacheMetadata | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction('metadata', 'readonly');
    const store = transaction.objectStore('metadata');
    const request = store.get(cacheKey);

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    return null;
  }
};

// Check if cache is expired (older than 30 minutes)
export const isCacheExpired = async (cacheKey: string): Promise<boolean> => {
  const metadata = await getCacheMetadata(cacheKey);
  if (!metadata) return true; // No cache = expired
  
  const age = Date.now() - metadata.lastUpdated;
  return age > CACHE_EXPIRY;
};

// Delete past matches from IndexedDB
export const deletePastMatches = async (cacheKey: string): Promise<number> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const index = store.index('cacheKey');
    const matchesRequest = index.getAll(cacheKey);
    
    let deletedCount = 0;
    const now = new Date();
    
    matchesRequest.onsuccess = () => {
      const entries: MatchCacheEntry[] = matchesRequest.result;
      
      entries.forEach(entry => {
        const match = entry.match;
        if (!match.date || !match.kickoff) return;
        
        try {
          const matchDateTime = new Date(`${match.date}T${match.kickoff}`);
          if (matchDateTime <= now) {
            store.delete(entry.id);
            deletedCount++;
          }
        } catch {
          // Skip if can't parse
        }
      });
    };
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    
    if (deletedCount > 0) {
    }
    
    return deletedCount;
  } catch (error) {
    return 0;
  }
};

// Clear cached matches for a specific cache key
export const clearCacheMatches = async (cacheKey: string): Promise<void> => {
  console.log(`[ClearCache] Clearing cache: ${cacheKey}`);
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME, 'metadata'], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const metadataStore = transaction.objectStore('metadata');

    // Get all matches for this cache key
    const index = store.index('cacheKey');
    const matchesRequest = index.getAll(cacheKey);

    matchesRequest.onsuccess = () => {
      const entries: MatchCacheEntry[] = matchesRequest.result;
      entries.forEach(entry => {
        store.delete(entry.id);
      });
    };

    // Delete metadata
    metadataStore.delete(cacheKey);

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
  }
};

// Clear all cached matches
export const clearAllCacheMatches = async (): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME, 'metadata'], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const metadataStore = transaction.objectStore('metadata');

    store.clear();
    metadataStore.clear();

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
  }
};

// Get chunk size
export const getChunkSize = (): number => CHUNK_SIZE;

// Clean up stale date caches (older than today)
export const cleanupStaleDateCaches = async (): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME, 'metadata'], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const metadataStore = transaction.objectStore('metadata');
    
    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Get all metadata to find date caches
    const allMetadata = await new Promise<any[]>((resolve, reject) => {
      const request = metadataStore.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    
    // Find date caches older than today
    const staleCaches = allMetadata.filter(meta => {
      // Only process date caches (not all_matches)
      if (!meta.cacheKey.startsWith('date_')) return false;
      
      // Extract date from cacheKey: date_2026-06-15_all_all_totelepep
      const parts = meta.cacheKey.split('_');
      if (parts.length < 2) return false;
      
      const cacheDate = parts[1]; // 2026-06-15
      
      // Check if this date is older than today
      return cacheDate < todayStr;
    });
    
    if (staleCaches.length === 0) {
      console.log('[Cleanup] No stale date caches found');
      return;
    }
    
    console.log(`[Cleanup] Found ${staleCaches.length} stale date caches, removing...`);
    
    // Remove stale caches
    for (const meta of staleCaches) {
      // Get all matches for this cache key
      const index = store.index('cacheKey');
      const matches = await new Promise<any[]>((resolve, reject) => {
        const request = index.getAll(meta.cacheKey);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      
      // Delete each match
      for (const match of matches) {
        store.delete(match.id);
      }
      
      // Delete metadata
      metadataStore.delete(meta.cacheKey);
      
      console.log(`[Cleanup] Removed stale cache: ${meta.cacheKey} (${matches.length} matches)`);
    }
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    
    console.log('[Cleanup] Stale date cache cleanup complete');
  } catch (error) {
    console.error('[Cleanup] Error cleaning up stale caches:', error);
  }
};

// Update odds for specific matches only (for visible range updates)
export const updateMatchesInCache = async (
  matches: any[],
  cacheKey: string,
  totalCount: number
): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME, 'metadata'], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const metadataStore = transaction.objectStore('metadata');

    // Update each match
    const entries: MatchCacheEntry[] = matches.map(match => ({
      id: `${cacheKey}_${match.id}`, // Include cacheKey in ID to prevent cross-date overwrites
      cacheKey,
      match,
      timestamp: Date.now()
    }));

    entries.forEach(entry => {
      store.put(entry); // Upsert: update if exists, insert if new
    });

    // Update metadata timestamp
    const metadata = await new Promise<CacheMetadata | null>((resolve) => {
      const req = metadataStore.get(cacheKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (metadata) {
      metadata.lastUpdated = Date.now();
      metadataStore.put(metadata);
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
  }
};

// ========================================
// BETSLIP PERSISTENCE
// ========================================

// Save betslip selections to IndexedDB (source-specific)
export const saveBetslip = async (selections: any[], sourceId: string = 'default'): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(BETSLIP_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(BETSLIP_STORE_NAME);
    
    const betslipKey = getBetslipKey(sourceId);
    
    // Clear existing selections for this source
    const existingRequest = store.getAll();
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result || [];
      existing.forEach(item => {
        if (item.betslipKey === betslipKey) {
          store.delete(item.id);
        }
      });
    };
    
    // Wait for deletion to complete
    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
    
    // Start new transaction for saving
    const saveTransaction = db.transaction(BETSLIP_STORE_NAME, 'readwrite');
    const saveStore = saveTransaction.objectStore(BETSLIP_STORE_NAME);
    
    // Save new selections with source key
    selections.forEach((selection, index) => {
      saveStore.put({
        id: `${betslipKey}_selection_${index}`,
        betslipKey,
        ...selection,
        timestamp: Date.now()
      });
    });

    await new Promise<void>((resolve, reject) => {
      saveTransaction.oncomplete = () => resolve();
      saveTransaction.onerror = () => reject(saveTransaction.error);
    });
    
    console.log(`[Betslip] Saved ${selections.length} selections for source: ${sourceId}`);
  } catch (error) {
    console.error('[Betslip] Error saving:', error);
  }
};

// Load betslip selections from IndexedDB (source-specific)
export const loadBetslip = async (sourceId: string = 'default'): Promise<any[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(BETSLIP_STORE_NAME, 'readonly');
    const store = transaction.objectStore(BETSLIP_STORE_NAME);
    
    const betslipKey = getBetslipKey(sourceId);
    const request = store.getAll();
    
    return new Promise<any[]>((resolve, reject) => {
      request.onsuccess = () => {
        const selections = request.result
          .filter(item => item.betslipKey === betslipKey) // Filter by source
          .sort((a, b) => a.id.localeCompare(b.id)) // Maintain order
          .map(({ id, betslipKey, timestamp, ...selection }) => selection); // Remove metadata
        resolve(selections);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Betslip] Error loading:', error);
    return [];
  }
};

// Clear betslip from IndexedDB (source-specific)
export const clearBetslip = async (sourceId: string = 'default'): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(BETSLIP_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(BETSLIP_STORE_NAME);
    
    const betslipKey = getBetslipKey(sourceId);
    
    // Only clear selections for this source
    const request = store.getAll();
    request.onsuccess = () => {
      const items = request.result || [];
      items.forEach(item => {
        if (item.betslipKey === betslipKey) {
          store.delete(item.id);
        }
      });
    };

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    
    console.log(`[Betslip] Cleared selections for source: ${sourceId}`);
  } catch (error) {
    console.error('[Betslip] Error clearing:', error);
  }
};
