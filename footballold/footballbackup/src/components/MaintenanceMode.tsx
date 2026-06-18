import React, { useState, useEffect } from 'react';

interface MaintenanceModeProps {
  isEnabled: boolean;
  onSecretAccess?: () => void;
}

export const MaintenanceMode: React.FC<MaintenanceModeProps> = ({ isEnabled, onSecretAccess }) => {
  const [bigWheelTaps, setBigWheelTaps] = useState(0);
  const [smallWheelTaps, setSmallWheelTaps] = useState(0);
  const [sequenceStarted, setSequenceStarted] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  
  // Reset sequence after 3 seconds of inactivity
  useEffect(() => {
    let resetTimer: NodeJS.Timeout;
    
    if (sequenceStarted && (bigWheelTaps > 0 || smallWheelTaps > 0)) {
      resetTimer = setTimeout(() => {
        setSequenceStarted(false);
        setBigWheelTaps(0);
        setSmallWheelTaps(0);
        console.log('🔄 Sequence reset due to timeout');
      }, 3000);
    }
    
    return () => {
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [bigWheelTaps, smallWheelTaps, sequenceStarted]);

  // Check for secret sequence: 3 big, 1 small, 3 big
  useEffect(() => {
    // First: 3 taps on big wheel
    if (!sequenceStarted && bigWheelTaps === 3) {
      setSequenceStarted(true);
      return;
    }
    
    // Second: 1 tap on small wheel (after sequence started)
    if (sequenceStarted && bigWheelTaps === 3 && smallWheelTaps === 1) {
      return;
    }
    
    // Third: 3 more taps on big wheel (total 6)
    if (sequenceStarted && bigWheelTaps === 6 && smallWheelTaps === 1) {
      // Show admin auth modal
      setShowAdminModal(true);
      setSequenceStarted(false);
      setBigWheelTaps(0);
      setSmallWheelTaps(0);
      console.log('🔓 Secret sequence completed!');
      return;
    }
  }, [bigWheelTaps, smallWheelTaps, sequenceStarted]);

  const handleBigWheelClick = () => {
    const newCount = bigWheelTaps + 1;
    setBigWheelTaps(newCount);
    console.log(`🔵 Big wheel tap: ${newCount}`);
  };

  const handleSmallWheelClick = () => {
    const newCount = smallWheelTaps + 1;
    setSmallWheelTaps(newCount);
    console.log(`🟢 Small wheel tap: ${newCount}`);
  };

  const handleAuthSubmit = async () => {
    if (authCode === '5274') {
      try {
        console.log('🔑 Attempting to disable maintenance mode...');
        const { supabase } = await import('../lib/supabase');
        
        if (!supabase) {
          throw new Error('Supabase not available');
        }
        
        console.log('💾 Updating Supabase metadata...');
        const { data, error } = await supabase
          .from('metadata')
          .upsert({ key: 'maintenanceMode', value: false }, { onConflict: 'key' });
        
        console.log('📊 Supabase response:', { data, error });
        
        if (error) {
          console.error('❌ Supabase error:', error);
          throw error;
        }
        
        console.log('✅ Maintenance mode disabled in database, forcing reload...');
        // Use location.href for more reliable reload
        window.location.href = window.location.origin + window.location.pathname;
      } catch (error: any) {
        console.error('Failed to disable maintenance:', error);
        setAuthError(error.message || 'Failed to disable maintenance');
      }
    } else {
      setAuthError('Invalid admin code');
    }
  };

  const handleCancelAuth = () => {
    setShowAdminModal(false);
    setAuthCode('');
    setAuthError('');
    setIsButtonEnabled(false);
  };

  console.log('🔧 MaintenanceMode component - isEnabled:', isEnabled);
  
  if (!isEnabled) {
    return null;
  }

  const handleAuthCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value;
    setAuthCode(code);
    setIsButtonEnabled(code === '5274');
    if (authError) setAuthError('');
  };

  if (!isEnabled) return null;

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 select-none touch-none"
      style={{ 
        minHeight: '100vh',
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center select-none touch-none"
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {/* Animated Maintenance Icon */}
        <div className="flex items-center justify-center space-x-3 mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
            <svg 
              className="w-10 h-10 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" 
              />
            </svg>
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-gray-900 mb-4 select-none">
          Under Maintenance
        </h2>
        
        <p className="text-lg text-gray-700 mb-6 select-none">
          We're currently making improvements to serve you better!
        </p>
        
        {/* Animated GIF-style illustration using CSS */}
        <div className="relative w-full h-48 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl mb-6 overflow-hidden select-none touch-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
          {/* Moving gears animation - NOW CLICKABLE */}
          <div className="absolute inset-0 flex items-center justify-center space-x-8">
            {/* Large gear - clickable */}
            <div 
              className="w-24 h-24 border-4 border-gray-400 rounded-full animate-spin cursor-pointer hover:border-blue-600 transition-colors duration-200 select-none touch-none"
              style={{ animationDuration: '3s', userSelect: 'none', WebkitUserSelect: 'none' }}
              onClick={handleBigWheelClick}
            >
              <div className="absolute inset-2 border-2 border-dashed border-gray-500 rounded-full"></div>
            </div>
            {/* Small gear - clickable */}
            <div 
              className="w-16 h-16 border-4 border-gray-400 rounded-full animate-spin cursor-pointer hover:border-blue-600 transition-colors duration-200 select-none touch-none"
              style={{ animationDuration: '2s', animationDirection: 'reverse', userSelect: 'none', WebkitUserSelect: 'none' }}
              onClick={handleSmallWheelClick}
            >
              <div className="absolute inset-2 border-2 border-dashed border-gray-500 rounded-full"></div>
            </div>
          </div>
          
          {/* Progress bar animation */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full"
                style={{
                  width: '100%',
                  animation: 'progress-bar 2s ease-in-out infinite',
                }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="space-y-3 text-base text-gray-600 select-none">
          <p className="font-medium">The app is undergoing maintenance</p>
          <p>and will be available soon.</p>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200 select-none">
          <p className="text-sm text-gray-500 select-none">
            Thank you for your patience!
          </p>
        </div>
        
        {/* Bouncing dots animation */}
        <div className="flex justify-center space-x-2 mt-4 select-none touch-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce select-none" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce select-none" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce select-none" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
      
      {/* Admin Auth Modal */}
      {showAdminModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 100000 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelAuth();
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Admin Access
            </h3>
            
            <p className="text-gray-600 mb-6 text-center">
              Enter admin code to disable maintenance mode
            </p>
            
            <input
              type="password"
              value={authCode}
              onChange={handleAuthCodeChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isButtonEnabled) {
                  handleAuthSubmit();
                }
              }}
              placeholder="Enter admin code"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4 text-center text-lg"
              autoFocus
            />
            
            {authError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                {authError}
              </div>
            )}
            
            <div className="space-y-3">
              <button
                onClick={handleAuthSubmit}
                disabled={!isButtonEnabled}
                className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors duration-200 ${
                  isButtonEnabled
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Disable Maintenance Mode
              </button>
              
              <button
                onClick={handleCancelAuth}
                className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add custom keyframes for progress bar */}
      <style>{`
        @keyframes progress-bar {
          0%, 100% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
};
