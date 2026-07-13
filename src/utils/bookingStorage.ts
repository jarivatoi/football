// IndexedDB helper for storing parlay booking history

const DB_NAME = 'ParlayBookingsDB';
const DB_VERSION = 2; // Incremented to support new Bet Refund Mode individual financial fields
const STORE_NAME = 'bookings';

export interface SavedBooking {
  id: string;
  bookingRef: string;
  selections: any[];
  stake: number;
  potentialWin: number;
  tax?: number;        // Tax amount deducted
  bonus?: number;      // Bonus amount added
  netPayout?: number;  // Final net payout
  timestamp: number;
  formattedDateTime: string;
  apiSource?: string;
  // Bet Refund Mode fields
  betRefundMode?: boolean;  // Whether this is part of a Bet Refund Mode bet
  betRefundType?: 'main' | 'refund';  // Type of bet in Bet Refund Mode
  betRefundGroupId?: string;  // Group ID to link related main/refund bets
  betRefundPairRef?: string;  // The other booking ref (main stores refund ref, refund stores main ref)
  betRefundOtherStake?: number;  // The stake of the other bet
  betRefundOtherWin?: number;  // The potential win of the other bet
  // Individual bet financial data for Bet Refund Mode
  betRefundMainStake?: number;
  betRefundMainTax?: number;
  betRefundMainBonus?: number;
  betRefundMainNetPayout?: number;
  betRefundRefundStake?: number;
  betRefundRefundTax?: number;
  betRefundRefundBonus?: number;
  betRefundRefundNetPayout?: number;
}

// Open database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// Save booking to IndexedDB
export const saveBookingToDB = async (booking: SavedBooking): Promise<void> => {
  const db = await openDB();



  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(booking);

    request.onsuccess = () => {

      resolve();
    };
    request.onerror = () => reject(new Error('Failed to save booking'));
  });
};

// Get all bookings from IndexedDB
export const getAllBookingsFromDB = async (): Promise<SavedBooking[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev'); // Descending order (newest first)

    const bookings: SavedBooking[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        bookings.push(cursor.value);

        cursor.continue();
      } else {
        resolve(bookings);
      }
    };

    request.onerror = () => reject(new Error('Failed to get bookings'));
  });
};

// Delete booking from IndexedDB
export const deleteBookingFromDB = async (bookingId: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(bookingId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete booking'));
  });
};

// Clear all bookings from IndexedDB
export const clearAllBookingsFromDB = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to clear bookings'));
  });
};
