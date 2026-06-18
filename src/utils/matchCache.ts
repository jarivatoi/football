/**
 * Match Cache using IndexedDB
 * Stores matches in chunks to prevent memory overload
 * Allows progressive loading and persistence across reloads
 */

const DB_NAME = 'TotelepepMatchCache';
const DB_VERSION = 1;
const STORE_NAME = 'matches';
const CHUNK_SIZE = 100; // Load and save in chunks of 100 matches
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes - refresh odds data

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
