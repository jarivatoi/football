// IndexedDB utility for user session management

class UserSessionDB {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'TotelepepUserDB';
  private readonly version = 1;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
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
        if (!db.objectStoreNames.contains('userSessions')) {
          db.createObjectStore('userSessions', { keyPath: 'userId' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

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
        const transaction = db.transaction(['userSessions'], 'readonly');
        const store = transaction.objectStore('userSessions');
        const request = store.getAll();
        
        request.onsuccess = () => {
          const sessions = request.result as Array<any>;
          const actualSessions = sessions.filter(s => s.userId !== '_lastUsedIdNumber');
          resolve(actualSessions.length > 0 ? actualSessions[0] : null);
        };
        
        request.onerror = () => {
          console.error('Failed to get user session:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('getUserSession error:', error);
      return null;
    }
  }

  async removeUserSession(): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['userSessions'], 'readwrite');
      const store = transaction.objectStore('userSessions');
      
      transaction.onerror = () => {
        console.error('❌ Remove user session transaction error:', transaction.error);
        reject(new Error(`Transaction failed: ${transaction.error}`));
      };
      
      transaction.oncomplete = () => {
        console.log('✅ User session removed successfully');
        resolve();
      };
      
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const sessions = getAllRequest.result || [];
        const lastUsedIdEntry = sessions.find(s => s.userId === '_lastUsedIdNumber');
        
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
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
      
      const request = store.put({ 
        userId: '_lastUsedIdNumber', 
        idNumber,
        isAdmin: false 
      });
      
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

export const userSessionDB = new UserSessionDB();

export const saveUserSession = async (session: { 
  userId: string; 
  idNumber: string; 
  surname?: string; 
  name?: string; 
  isAdmin: boolean 
}) => {
  await userSessionDB.saveUserSession(session);
};

export const getUserSession = async () => {
  return await userSessionDB.getUserSession();
};

export const removeUserSession = async () => {
  await userSessionDB.removeUserSession();
};

export const saveLastUsedIdNumber = async (idNumber: string) => {
  await userSessionDB.saveLastUsedIdNumber(idNumber);
};

export const getLastUsedIdNumber = async () => {
  return await userSessionDB.getLastUsedIdNumber();
};
