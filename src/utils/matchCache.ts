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
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes - refresh odds data

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
      id: match.id,
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
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to save matches chunk:', error);
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
      console.log(`[Cache Cleanup] Removed ${matches.length - validMatches.length} past matches`);
      // Note: We don't delete here to avoid write transaction on read
      // Deletion will happen when new data is saved
    }

    return { matches: validMatches, metadata };
  } catch (error) {
    console.error('Failed to get cached matches:', error);
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
    console.error('Failed to get cache metadata:', error);
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
      console.log(`[Cache Cleanup] Deleted ${deletedCount} past matches from IndexedDB`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Failed to delete past matches:', error);
    return 0;
  }
};

// Clear cached matches for a specific cache key
export const clearCacheMatches = async (cacheKey: string): Promise<void> => {
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
    console.error('Failed to clear cache matches:', error);
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
    console.error('Failed to clear all cache matches:', error);
  }
};

// Get chunk size
export const getChunkSize = (): number => CHUNK_SIZE;

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
      id: match.id,
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

    console.log(`[Cache Update] Updated ${matches.length} matches in cache`);
  } catch (error) {
    console.error('Failed to update matches in cache:', error);
  }
};

// ========================================
// BETSLIP PERSISTENCE
// ========================================

// Save betslip selections to IndexedDB
export const saveBetslip = async (selections: any[]): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(BETSLIP_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(BETSLIP_STORE_NAME);
    
    // Clear existing selections
    store.clear();
    
    // Save new selections
    selections.forEach((selection, index) => {
      store.put({
        id: `selection_${index}`,
        ...selection,
        timestamp: Date.now()
      });
    });

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    console.log(`[Betslip] Saved ${selections.length} selections to IndexedDB`);
  } catch (error) {
    console.error('Failed to save betslip:', error);
  }
};

// Load betslip selections from IndexedDB
export const loadBetslip = async (): Promise<any[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(BETSLIP_STORE_NAME, 'readonly');
    const store = transaction.objectStore(BETSLIP_STORE_NAME);
    
    const request = store.getAll();
    
    return new Promise<any[]>((resolve, reject) => {
      request.onsuccess = () => {
        const selections = request.result
          .sort((a, b) => a.id.localeCompare(b.id)) // Maintain order
          .map(({ id, timestamp, ...selection }) => selection); // Remove metadata
        
        console.log(`[Betslip] Loaded ${selections.length} selections from IndexedDB`);
        resolve(selections);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load betslip:', error);
    return [];
  }
};

// Clear betslip from IndexedDB
export const clearBetslip = async (): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(BETSLIP_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(BETSLIP_STORE_NAME);
    
    store.clear();

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    console.log('[Betslip] Cleared from IndexedDB');
  } catch (error) {
    console.error('Failed to clear betslip:', error);
  }
};
