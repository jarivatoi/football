import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, CheckCircle, Lock } from 'lucide-react';

interface ShiftMarkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMarker: (marker: 'EARLY' | 'LATE' | 'FIRST' | 'SECOND' | 'AM' | 'FULL' | null, authCode: string) => Promise<void>;
  currentMarker?: 'EARLY' | 'LATE' | 'FIRST' | 'SECOND' | 'AM' | 'FULL' | undefined;
}

export const ShiftMarkerModal: React.FC<ShiftMarkerModalProps> = ({
  isOpen,
  onClose,
  onSelectMarker,
  currentMarker
}) => {
  const [selectedMarker, setSelectedMarker] = useState<'EARLY' | 'LATE' | 'FIRST' | 'SECOND' | 'AM' | 'FULL' | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isClearAction, setIsClearAction] = useState(false);

  const markers: Array<'EARLY' | 'LATE' | 'FIRST' | 'SECOND' | 'AM' | 'FULL'> = ['EARLY', 'LATE', 'FIRST', 'SECOND', 'AM', 'FULL'];

  const handleMarkerSelect = (marker: 'EARLY' | 'LATE' | 'FIRST' | 'SECOND' | 'AM' | 'FULL' | null) => {
    setSelectedMarker(marker);
    setIsClearAction(marker === null);
    setIsConfirming(true);
  };

  const handleConfirm = () => {
    if (selectedMarker === null || selectedMarker !== null) {
      // Show passcode input for both setting and clearing
      setShowPasscode(true);
    }
  };

  const handleSubmitPasscode = async () => {
    if (!passcode) return;
    
    setIsLoading(true);
    setPasscodeError('');
    
    try {
      await onSelectMarker(selectedMarker, passcode);
      setSelectedMarker(null);
      setIsConfirming(false);
      setShowPasscode(false);
      setPasscode('');
      onClose();
    } catch (error) {
      console.error('Error setting marker:', error);
      setPasscodeError('Invalid passcode or failed to set marker');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (showPasscode) {
      setShowPasscode(false);
      setPasscode('');
      setPasscodeError('');
    } else if (isConfirming) {
      setSelectedMarker(null);
      setIsConfirming(false);
      setIsClearAction(false);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center">
            {showPasscode ? (
              <>
                <Lock className="w-6 h-6 mr-2" />
                Enter Passcode
              </>
            ) : (
              <>
                <Clock className="w-6 h-6 mr-2" />
                Select Shift Marker
              </>
            )}
          </h2>
          <button
            onClick={handleCancel}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!showPasscode ? (
            !isConfirming ? (
              <>
                <p className="text-gray-700 mb-4 text-center">
                  Select a marker to indicate your shift type:
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {markers.map((marker) => {
                    const isActive = currentMarker === marker;
                    return (
                      <button
                        key={marker}
                        onClick={() => handleMarkerSelect(marker)}
                        className={`py-4 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md ${
                          isActive
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-2 border-green-700 text-white'
                            : 'bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-2 border-blue-200 hover:border-blue-400 text-blue-800'
                        }`}
                      >
                        {marker.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                {/* Clear Marker Button - Last position, only show if there's an active marker */}
                {currentMarker && (
                  <button
                    onClick={() => handleMarkerSelect(null)}
                    className="w-full mt-4 py-4 px-6 bg-gradient-to-br from-red-50 to-orange-50 hover:from-red-100 hover:to-orange-100 
                             border-2 border-red-200 hover:border-red-400 rounded-xl font-semibold text-red-800 
                             transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md"
                  >
                    🗑️ Clear Marker
                  </button>
                )}
              </>
            ) : (
              // Confirmation Screen
              <div className="text-center">
                <div className="mb-6">
                  {isClearAction ? (
                    <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  ) : (
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  )}
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {isClearAction ? 'Confirm Clear' : 'Confirm Marker'}
                  </h3>
                  <p className="text-gray-600">
                    {isClearAction ? (
                      'You are about to remove the shift marker'
                    ) : (
                      'You are about to set your shift marker'
                    )}
                  </p>
                  {!isClearAction && selectedMarker && (
                    <div className="mt-4 py-3 px-6 bg-blue-50 border-2 border-blue-200 rounded-lg inline-block">
                      <span className="text-2xl font-bold text-blue-800">{selectedMarker.toUpperCase()}</span>
                    </div>
                  )}
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold 
                             rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 
                             hover:from-blue-700 hover:to-indigo-700 text-white font-semibold 
                             rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Continue'
                    )}
                  </button>
                </div>
              </div>
            )
          ) : (
            // Passcode Screen
            <div className="text-center">
              <div className="mb-6">
                {isClearAction ? (
                  <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ) : (
                  <Lock className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Authentication Required
                </h3>
                <p className="text-gray-600 mb-4">
                  {isClearAction ? (
                    <>Enter your passcode to <strong className="text-red-600">remove</strong> the shift marker</>
                  ) : (
                    <>Enter your passcode to set marker as <strong className="text-blue-600">{selectedMarker?.toUpperCase()}</strong></>

                  )}
                </p>
                
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmitPasscode()}
                  placeholder="Enter your passcode"
                  className="w-full px-4 py-3 border-2 border-gray-300 focus:border-blue-500 rounded-lg text-center text-lg font-semibold tracking-wider mb-4"
                  autoFocus
                  inputMode="numeric"
                  maxLength={4}
                />
                
                {passcodeError && (
                  <p className="text-red-600 text-sm font-medium mb-4">
                    {passcodeError}
                  </p>
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold 
                           rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitPasscode}
                  disabled={isLoading || !passcode}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 
                           hover:from-blue-700 hover:to-indigo-700 text-white font-semibold 
                           rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
