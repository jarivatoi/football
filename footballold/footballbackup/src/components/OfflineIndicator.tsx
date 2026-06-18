import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
      
      // Hide the message after 5 seconds
      setTimeout(() => {
        setShowOfflineMessage(false);
      }, 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showOfflineMessage) {
    return null;
  }

  return (
    <>
      {/* Status indicator in header */}
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
        isOnline 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            Offline
          </>
        )}
      </div>

      {/* Offline notification */}
      {showOfflineMessage && (
        <div className="fixed top-4 left-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg z-50 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-yellow-600" />
            <div>
              <h3 className="font-medium text-yellow-800">You're offline</h3>
              <p className="text-sm text-yellow-700">
                Showing cached data. Connect to internet for live updates.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OfflineIndicator;