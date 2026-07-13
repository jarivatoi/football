import { DEFAULT_SHIFT_COMBINATIONS } from '../constants';

interface DBSchema {
  schedule: {
    key: string;
    value: {
      date: string;
      shifts: string[];
    };
  };
  specialDates: {
    key: string;
    value: {
      date: string;
      isSpecial: boolean;
    };
  };
  settings: {
    key: string;
    value: any;
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: any;
    };
  };
  monthlySalaries: {
    key: string;
    value: {
      monthKey: string;
      salary: number;
    };
  };
  dateNotes: {
    key: string;
    value: {
      date: string;
      note: string;
    };
  };
  userSessions: {
    key: string;
    value: {
      userId: string;
      idNumber: string;
      surname?: string;
      name?: string;
      isAdmin: boolean;
    };
  };
}

class WorkScheduleDB {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'WorkScheduleDB';
  private readonly version = 6; // Incremented to force upgrade and create missing object stores
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise;
    }
    
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if IndexedDB is available (important for iPhone)
      if (!window.indexedDB) {
        console.error('❌ IndexedDB not supported');
        reject(new Error('IndexedDB not supported'));
        return;
      }
      
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('❌ Failed to open IndexedDB:', request.error);
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('schedule')) {
          db.createObjectStore('schedule', { keyPath: 'date' });
        }

        if (!db.objectStoreNames.contains('specialDates')) {
          db.createObjectStore('specialDates', { keyPath: 'date' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('monthlySalaries')) {
          db.createObjectStore('monthlySalaries', { keyPath: 'monthKey' });
        }

        if (!db.objectStoreNames.contains('dateNotes')) {
          db.createObjectStore('dateNotes', { keyPath: 'date' });
        }

        if (!db.objectStoreNames.contains('userSessions')) {
          db.createObjectStore('userSessions', { keyPath: 'userId' });
        }
      };
      
      // Add timeout for iPhone compatibility
      setTimeout(() => {
        if (!this.db) {
          console.error('❌ IndexedDB initialization timeout');
          reject(new Error('Database initialization timeout'));
        }
      }, 10000); // 10 second timeout
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db || this.db.readyState === 'closing' || this.db.readyState === 'closed') {
      // Database is closing/closed, need to reopen
      console.warn('⚠️ Database was closing, reopening...');
      this.db = null;
      await this.init();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async getSchedule(): Promise<Record<string, string[]>> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['schedule'], 'readonly');
      const store = transaction.objectStore('schedule');
      const request = store.getAll();

      request.onsuccess = () => {
        const result: Record<string, string[]> = {};
        request.result.forEach((item: { date: string; shifts: string[] }) => {
          result[item.date] = item.shifts;
        });
        resolve(result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get schedule'));
      };
    });
  }

  async setSchedule(schedule: Record<string, string[]>): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['schedule'], 'readwrite');
      const store = transaction.objectStore('schedule');

      // Add transaction error handling
      transaction.onerror = () => {
        console.error('❌ Transaction error:', transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };

      // Clear existing data
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        // Add new data
        let pendingOperations = 0;
        let completedOperations = 0;
        let hasError = false;
        
        Object.entries(schedule).forEach(([date, shifts]) => {
          if (shifts.length > 0) {
            pendingOperations++;
            const addRequest = store.add({ date, shifts });
            
            addRequest.onsuccess = () => {
              completedOperations++;
              if (completedOperations === pendingOperations && !hasError) {
                // Removed success log to reduce console output
              }
            };
            
            addRequest.onerror = () => {
              if (!hasError) {
                hasError = true;
                console.error(`❌ Failed to add schedule for ${date}:`, addRequest.error);
                reject(new Error(`Failed to add schedule for ${date}: ${addRequest.error}`));
              }
            };
          }
        });
        
        // If no data to save, resolve immediately
        if (pendingOperations === 0) {
          console.log('✅ No schedule data to save');
        }
      };

      clearRequest.onerror = () => {
        console.error('❌ Failed to clear schedule:', clearRequest.error);
        reject(new Error(`Failed to clear schedule: ${clearRequest.error}`));
      };
    });
  }

  async getSpecialDates(): Promise<Record<string, boolean>> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['specialDates'], 'readonly');
      const store = transaction.objectStore('specialDates');
      const request = store.getAll();

      request.onsuccess = () => {
        const result: Record<string, boolean> = {};
        request.result.forEach((item: { date: string; isSpecial: boolean }) => {
          result[item.date] = item.isSpecial;
        });
        resolve(result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get special dates'));
      };
    });
  }

  async setSpecialDates(specialDates: Record<string, boolean>): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['specialDates'], 'readwrite');
      const store = transaction.objectStore('specialDates');

      // Add transaction error handling
      transaction.onerror = () => {
        console.error('❌ Special dates transaction error:', transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };

      // Clear existing data
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        // Add new data
        let pendingOperations = 0;
        let completedOperations = 0;
        let hasError = false;
        
        Object.entries(specialDates).forEach(([date, isSpecial]) => {
          if (isSpecial) {
            pendingOperations++;
            const addRequest = store.add({ date, isSpecial });
            
            addRequest.onsuccess = () => {
              completedOperations++;
              if (completedOperations === pendingOperations && !hasError) {
                // Removed success log to reduce console output
              }
            };
            
            addRequest.onerror = () => {
              if (!hasError) {
                hasError = true;
                console.error(`❌ Failed to add special date for ${date}:`, addRequest.error);
                reject(new Error(`Failed to add special date for ${date}: ${addRequest.error}`));
              }
            };
          }
        });

        // If no data to save, resolve immediately
        if (pendingOperations === 0) {
          // No special dates to save
        }
      };

      clearRequest.onerror = () => {
        console.error('❌ Failed to clear special dates:', clearRequest.error);
        reject(new Error(`Failed to clear special dates: ${clearRequest.error}`));
      };
    });
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result ? request.result.value : null;
        
        // Special handling for workSettings to ensure shift combinations are present
        if (key === 'workSettings' && result && typeof result === 'object') {
          // FORCE UPDATE: Always use latest default shift combinations
          if (!result.shiftCombinations || result.shiftCombinations.length === 0 || true) {
            const fixedResult = {
              ...result,
              shiftCombinations: DEFAULT_SHIFT_COMBINATIONS
            };
            
            // Save the fixed version back to the database
            this.setSetting(key, fixedResult).catch(err => 
              console.error('Failed to save fixed settings:', err)
            );
            
            resolve(fixedResult);
            return;
          }
        }
        
        resolve(result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get setting: ${key}`));
      };
    });
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      // Add transaction error handling
      transaction.onerror = () => {
        console.error(`❌ Settings transaction error for "${key}":`, transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      const request = store.put({ key, value });

      request.onsuccess = () => {
        // Removed success log to reduce console output
      };

      request.onerror = () => {
        console.error(`❌ Failed to set setting "${key}":`, request.error);
        reject(new Error(`Failed to set setting: ${key} - ${request.error}`));
      };
    });
  }

  async getMetadata<T>(key: string): Promise<T | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result ? request.result.value : null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get metadata: ${key}`));
      };
    });
  }

  async setMetadata<T>(key: string, value: T): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');
      
      // Add transaction error handling
      transaction.onerror = () => {
        console.error(`❌ Metadata transaction error for "${key}":`, transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      const request = store.put({ key, value });

      request.onsuccess = () => {
        // Removed success log to reduce console output
      };

      request.onerror = () => {
        console.error(`❌ Failed to set metadata "${key}":`, request.error);
        reject(new Error(`Failed to set metadata: ${key} - ${request.error}`));
      };
    });
  }

  async exportAllData(): Promise<any> {
    const createExportFilename = (): string => {
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      
      return `Roster_${day}-${month}-${year}.json`;
    };

    try {
      const [schedule, specialDates, settings, scheduleTitle, dateNotes] = await Promise.all([
        this.getSchedule(),
        this.getSpecialDates(),
        this.getSetting('workSettings'),
        this.getMetadata('scheduleTitle'),
        this.getDateNotes().catch(() => ({}))
      ]);
      
      const finalSettings = settings || {
        basicSalary: 35000,
        hourlyRate: 173.08,
        shiftCombinations: DEFAULT_SHIFT_COMBINATIONS
      };

      if (finalSettings && (!finalSettings.shiftCombinations || finalSettings.shiftCombinations.length === 0)) {
        finalSettings.shiftCombinations = DEFAULT_SHIFT_COMBINATIONS;
      }

      return {
        schedule,
        specialDates,
        settings: finalSettings,
        scheduleTitle: scheduleTitle || 'Work Schedule',
        dateNotes,
        exportDate: new Date().toISOString(),
        version: '3.0',
        filename: createExportFilename().replace('Roster_', 'ANWH_')
      };
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  async importAllData(data: any): Promise<void> {
    console.log('🔄 Importing data to IndexedDB:', {
      hasSchedule: !!data.schedule,
      hasSpecialDates: !!data.specialDates,
      hasSettings: !!data.settings,
      hasTitle: !!data.scheduleTitle,
      version: data.version
    });

    const promises: Promise<void>[] = [];

    if (data.schedule) {
      console.log('📅 Importing schedule with', Object.keys(data.schedule).length, 'entries');
      promises.push(this.setSchedule(data.schedule));
    }

    if (data.specialDates) {
      console.log('⭐ Importing special dates with', Object.keys(data.specialDates).length, 'entries');
      promises.push(this.setSpecialDates(data.specialDates));
    }

    if (data.settings) {
      // Ensure imported settings have shift combinations
      const settingsToImport = { ...data.settings };
      if (!settingsToImport.shiftCombinations || settingsToImport.shiftCombinations.length === 0) {
        console.log('🔧 Adding missing shift combinations to imported settings');
        settingsToImport.shiftCombinations = DEFAULT_SHIFT_COMBINATIONS;
      }
      
      console.log('⚙️ Importing settings:', {
        basicSalary: settingsToImport.basicSalary,
        hourlyRate: settingsToImport.hourlyRate,
        shiftCombinations: settingsToImport.shiftCombinations?.length || 0
      });
      promises.push(this.setSetting('workSettings', settingsToImport));
    }

    if (data.scheduleTitle) {
      console.log('📝 Importing schedule title:', data.scheduleTitle);
      promises.push(this.setMetadata('scheduleTitle', data.scheduleTitle));
    }

    if (data.dateNotes) {
      console.log('📝 Importing date notes with', Object.keys(data.dateNotes).length, 'entries');
      promises.push(this.setDateNotes(data.dateNotes));
    }

    await Promise.all(promises);
    console.log('✅ All data imported successfully to IndexedDB');
  }

  async getStorageInfo(): Promise<{ used: number; available: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        console.log('📊 Storage estimate:', estimate);
        return {
          used: estimate.usage || 0,
          available: estimate.quota || 0
        };
      } catch (error) {
        console.warn('Storage estimate not available:', error);
      }
    }

    // Fallback estimates - iPhone Safari often can't provide exact quota
    console.log('📊 Using fallback storage estimate for iPhone Safari');
    return {
      used: 0,
      available: 50 * 1024 * 1024 // 50MB fallback (actual is much more)
    };
  }

  async getMonthlySalary(year: number, month: number): Promise<number> {
    try {
      const db = await this.ensureDB();
      
      // Check if object store exists
      if (!db.objectStoreNames.contains('monthlySalaries')) {
        return 0;
      }
      
      const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['monthlySalaries'], 'readonly');
        const store = transaction.objectStore('monthlySalaries');
        const request = store.get(monthKey);

        request.onsuccess = () => {
          const result = request.result ? request.result.salary : 0;
          resolve(result);
        };

        request.onerror = () => {
          reject(new Error(`Failed to get monthly salary for ${monthKey}`));
        };
      });
    } catch (error) {
      return 0; // Return 0 as fallback
    }
  }

  async setMonthlySalary(year: number, month: number, salary: number): Promise<void> {
    const db = await this.ensureDB();
    const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;
    console.log(`💾 Saving monthly salary for ${monthKey}:`, salary);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['monthlySalaries'], 'readwrite');
      const store = transaction.objectStore('monthlySalaries');

      transaction.onerror = () => {
        console.error(`❌ Monthly salary transaction error for "${monthKey}":`, transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };

      transaction.oncomplete = () => {
        console.log(`✅ Monthly salary for "${monthKey}" saved successfully`);
        resolve();
      };

      const request = store.put({ monthKey, salary });

      request.onsuccess = () => {
        console.log(`✅ Monthly salary for "${monthKey}" put operation completed`);
      };

      request.onerror = () => {
        console.error(`❌ Failed to set monthly salary for "${monthKey}":`, request.error);
        reject(new Error(`Failed to set monthly salary: ${monthKey} - ${request.error}`));
      };
    });
  }

  async getAllMonthlySalaries(): Promise<Record<string, number>> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['monthlySalaries'], 'readonly');
      const store = transaction.objectStore('monthlySalaries');
      const request = store.getAll();

      request.onsuccess = () => {
        const result: Record<string, number> = {};
        request.result.forEach((item: { monthKey: string; salary: number }) => {
          result[item.monthKey] = item.salary;
        });
        resolve(result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get all monthly salaries'));
      };
    });
  }

  async getDateNotes(): Promise<Record<string, string>> {
    try {
      const db = await this.ensureDB();
      
      // Check if object store exists
      if (!db.objectStoreNames.contains('dateNotes')) {
        return {};
      }
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['dateNotes'], 'readonly');
        const store = transaction.objectStore('dateNotes');
        const request = store.getAll();

        request.onsuccess = () => {
          const result: Record<string, string> = {};
          request.result.forEach((item: { date: string; note: string }) => {
            result[item.date] = item.note;
          });
          resolve(result);
        };

        request.onerror = () => {
          reject(new Error('Failed to get date notes'));
        };
      });
    } catch (error) {
      return {}; // Return empty object as fallback
    }
  }

  async setDateNotes(dateNotes: Record<string, string>): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['dateNotes'], 'readwrite');
      const store = transaction.objectStore('dateNotes');

      transaction.onerror = () => {
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };

      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        let pendingOperations = 0;
        let completedOperations = 0;
        let hasError = false;
        
        Object.entries(dateNotes).forEach(([date, note]) => {
          if (note && note.trim() !== '') {
            pendingOperations++;
            const putRequest = store.put({ date, note });
            
            putRequest.onsuccess = () => {
              completedOperations++;
              if (completedOperations === pendingOperations && !hasError) {
                resolve();
              }
            };
            
            putRequest.onerror = () => {
              if (!hasError) {
                hasError = true;
                reject(new Error(`Failed to save note for ${date}: ${putRequest.error}`));
              }
            };
          } else {
            const deleteRequest = store.delete(date);
            deleteRequest.onsuccess = () => {
              // Empty note deleted
            };
            deleteRequest.onerror = () => {
              console.warn(`⚠️ Failed to delete empty note for ${date}:`, deleteRequest.error);
            };
          }
        });
        
        if (pendingOperations === 0) {
          resolve();
        }
      };

      clearRequest.onerror = () => {
        reject(new Error(`Failed to clear dateNotes: ${clearRequest.error}`));
      };
    });
  }

  // User Session Management Functions
  async saveUserSession(session: { 
    userId: string; 
    idNumber: string; 
    surname?: string; 
    name?: string; 
    isAdmin: boolean 
  }): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSessions'], 'readwrite');
      const store = transaction.objectStore('userSessions');
      
      transaction.onerror = () => {
        console.error('❌ User session transaction error:', transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      const request = store.put(session);
      
      request.onsuccess = () => {
        // Removed success log to reduce console output
      };
      
      request.onerror = () => {
        console.error('❌ Failed to save user session:', request.error);
        reject(new Error(`Failed to save user session: ${request.error}`));
      };
    });
  }

  async getUserSession(): Promise<{ 
    userId: string; 
    idNumber: string; 
    surname?: string; 
    name?: string; 
    isAdmin: boolean 
  } | null> {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve, reject) => {
        let transaction: IDBTransaction;
        try {
          transaction = db.transaction(['userSessions'], 'readonly');
        } catch (error: any) {
          // If transaction fails due to closing, reinitialize and retry once
          if (error?.message?.includes('closing') || error?.name === 'InvalidStateError') {
            console.warn('⚠️ Transaction failed, reinitializing DB...');
            this.db = null;
            this.ensureDB().then(newDb => {
              transaction = newDb.transaction(['userSessions'], 'readonly');
              const store = transaction.objectStore('userSessions');
              const request = store.getAll();
              request.onsuccess = () => {
                const sessions = request.result as Array<any>;
                const actualSessions = sessions.filter(s => s.userId !== '_lastUsedIdNumber');
                resolve(actualSessions.length > 0 ? actualSessions[0] : null);
              };
              request.onerror = () => resolve(null);
            }).catch(() => resolve(null));
            return;
          }
          reject(error);
          return;
        }
        
        const store = transaction.objectStore('userSessions');
        const request = store.getAll();
        
        request.onsuccess = () => {
          // Return the first (and should be only) session
          const sessions = request.result as Array<{
            userId: string;
            idNumber: string;
            surname?: string;
            name?: string;
            isAdmin: boolean;
          }>;
          
          // Filter out the special _lastUsedIdNumber entry (it's metadata, not a real session)
          const actualSessions = sessions.filter(s => s.userId !== '_lastUsedIdNumber');
          const session = actualSessions.length > 0 ? actualSessions[0] : null;
          resolve(session);
        };
        
        request.onerror = () => {
          console.error('Failed to get user session:', request.error);
          resolve(null); // Return null on error instead of rejecting
        };
      });
    } catch (error) {
      console.error('getUserSession error:', error);
      return null;
    }
  }

  async removeUserSession(): Promise<void> {
    const db = await this.ensureDB();
    console.log('🗑️ Removing user session from IndexedDB');
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSessions'], 'readwrite');
      const store = transaction.objectStore('userSessions');
      
      transaction.onerror = () => {
        console.error('❌ Remove user session transaction error:', transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        console.log('✅ User session removed successfully (kept lastUsedIdNumber)');
        resolve();
      };
      
      // Get all sessions to find and preserve lastUsedIdNumber
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const sessions = getAllRequest.result || [];
        
        // Find and preserve _lastUsedIdNumber
        const lastUsedIdEntry = sessions.find(s => s.userId === '_lastUsedIdNumber');
        
        // Clear the store
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
          // Restore _lastUsedIdNumber if it existed
          if (lastUsedIdEntry) {
            store.put(lastUsedIdEntry);
            console.log('✅ Preserved lastUsedIdNumber:', lastUsedIdEntry.idNumber);
          }
        };
        
        clearRequest.onerror = () => {
          console.error('❌ Failed to clear store:', clearRequest.error);
          reject(new Error(`Failed to clear store: ${clearRequest.error}`));
        };
      };
      
      getAllRequest.onerror = () => {
        console.error('❌ Failed to get sessions:', getAllRequest.error);
        reject(new Error(`Failed to get sessions: ${getAllRequest.error}`));
      };
    });
  }

  /**
   * Check if a user is already logged in on another device
   * Session expires after 7 days (only as emergency fallback if logout fails)
   */
  async checkActiveSession(userId: string): Promise<boolean> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSessions'], 'readonly');
      const store = transaction.objectStore('userSessions');
      const request = store.get(userId);
      
      request.onsuccess = () => {
        const existingSession = request.result;
        
        if (existingSession) {
          // Check if session is still valid (within 7 days as emergency fallback)
          const loginTime = existingSession.loginTime ? new Date(existingSession.loginTime) : new Date();
          const now = new Date();
          const daysSinceLogin = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceLogin < 7) {
            console.log('⚠️ Active session found for user:', userId);
            resolve(true);
          } else {
            // Session expired (emergency fallback only), clean it up
            console.log('🕒 Session expired (>7 days) for user:', userId);
            resolve(false);
          }
        } else {
          resolve(false);
        }
      };
      
      request.onerror = () => {
        reject(new Error('Failed to check active session'));
      };
    });
  }

  /**
   * Force logout a user session by userId
   */
  async clearUserSessionByUserId(userId: string): Promise<void> {
    const db = await this.ensureDB();
    console.log('🗑️ Clearing user session for userId:', userId);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSessions'], 'readwrite');
      const store = transaction.objectStore('userSessions');
      const request = store.delete(userId);
      
      transaction.oncomplete = () => {
        console.log('✅ User session cleared successfully for userId:', userId);
        resolve();
      };
      
      transaction.onerror = () => {
        console.error('❌ Failed to clear user session:', transaction.error);
        reject(new Error(`Failed to clear user session: ${transaction.error}`));
      };
      
      request.onerror = () => {
        console.error('❌ Delete request error:', request.error);
      };
    });
  }

  async saveLastUsedIdNumber(idNumber: string): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSessions'], 'readwrite');
      const store = transaction.objectStore('userSessions');
      
      transaction.onerror = () => {
        console.error('❌ Save ID number transaction error:', transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      // Store as metadata in userSessions store with special key
      const request = store.put({ 
        userId: '_lastUsedIdNumber', 
        idNumber,
        isAdmin: false 
      });
      
      request.onsuccess = () => {
        // Removed success log to reduce console output
      };
      
      request.onerror = () => {
        console.error('❌ Failed to save ID number:', request.error);
        reject(new Error(`Failed to save ID number: ${request.error}`));
      };
    });
  }

  async getLastUsedIdNumber(): Promise<string | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSessions'], 'readonly');
      const store = transaction.objectStore('userSessions');
      const request = store.get('_lastUsedIdNumber');
      
      request.onsuccess = () => {
        const result = request.result?.idNumber || null;
        resolve(result);
      };
      
      request.onerror = () => {
        console.error('❌ Failed to get last used ID number:', request.error);
        reject(new Error(`Failed to get last used ID number: ${request.error}`));
      };
    });
  }
}

export const workScheduleDB = new WorkScheduleDB();

// Convenience export functions for user session management
export const saveUserSession = async (session: { 
  userId: string; 
  idNumber: string; 
  surname?: string; 
  name?: string; 
  isAdmin: boolean 
}) => {
  await workScheduleDB.saveUserSession(session);
};

export const getUserSession = async () => {
  return await workScheduleDB.getUserSession();
};

export const removeUserSession = async () => {
  await workScheduleDB.removeUserSession();
};

export const saveLastUsedIdNumber = async (idNumber: string) => {
  await workScheduleDB.saveLastUsedIdNumber(idNumber);
};

export const getLastUsedIdNumber = async () => {
  return await workScheduleDB.getLastUsedIdNumber();
};

export const checkActiveSession = async (userId: string) => {
  return await workScheduleDB.checkActiveSession(userId);
};

export const clearUserSessionByUserId = async (userId: string) => {
  return await workScheduleDB.clearUserSessionByUserId(userId);
};