import React, { useState, useCallback, useEffect } from 'react';
import { Trash2, History, X } from 'lucide-react';
import { SavedBooking, getAllBookingsFromDB, deleteBookingFromDB, clearAllBookingsFromDB } from '../utils/bookingStorage';
import { createPortal } from 'react-dom';

// Helper function to format currency
const formatCurrency = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '0';
  if (Number.isInteger(numAmount)) {
    return numAmount.toString();
  }
  return numAmount.toFixed(2);
};

interface BookingHistoryProps {
  showHistory: boolean;
  onClose: () => void;
  onBookingsCountChange: (count: number) => void;
}

const BookingHistory: React.FC<BookingHistoryProps> = ({ showHistory, onClose, onBookingsCountChange }) => {
  const [savedBookings, setSavedBookings] = useState<SavedBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<SavedBooking | null>(null);

  // Load bookings when modal opens
  useEffect(() => {
    if (showHistory) {
      const loadBookings = async () => {
        try {
          const bookings = await getAllBookingsFromDB();
          setSavedBookings(bookings);
          onBookingsCountChange(bookings.length);
        } catch (error) {
          console.error('Failed to load bookings:', error);
        }
      };
      loadBookings();
    }
  }, [showHistory, onBookingsCountChange]);

  // Format timestamp to readable date/time
  const formatBookingDateTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = days[date.getDay()];
    const dateNum = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day} ${dateNum}-${month}-${year} @ ${hours}:${minutes}`;
  };

  // Delete a specific booking
  const deleteBooking = useCallback(async (bookingId: string) => {
    try {
      await deleteBookingFromDB(bookingId);
      const updatedBookings = savedBookings.filter(b => b.id !== bookingId);
      setSavedBookings(updatedBookings);
      onBookingsCountChange(updatedBookings.length);
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(null);
      }
    } catch (error) {
      console.error('Failed to delete booking:', error);
    }
  }, [savedBookings, selectedBooking, onBookingsCountChange]);

  // Clear all bookings
  const clearAllBookings = useCallback(async () => {
    try {
      await clearAllBookingsFromDB();
      setSavedBookings([]);
      setSelectedBooking(null);
      onBookingsCountChange(0);
    } catch (error) {
      console.error('Failed to clear bookings:', error);
    }
  }, [onBookingsCountChange]);

  if (!showHistory) return null;

  return (
    <>
      {/* Booking History Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full max-w-lg max-h-[80vh] rounded-t-lg sm:rounded-lg overflow-hidden flex flex-col">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-800">Saved Bookings</h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Bookings List */}
          <div className="flex-1 overflow-y-auto p-4">
            {savedBookings.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No saved bookings yet</p>
                <p className="text-sm text-gray-400 mt-2">Place a bet to save bookings</p>
              </div>
            ) : (
              <div className="space-y-4">
                {savedBookings.map((booking) => (
                  <div key={booking.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Booking Header - Clickable */}
                    <div 
                      className="bg-gray-50 px-4 py-2 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <div className="text-sm text-gray-600">{booking.formattedDateTime}</div>
                    </div>
                    
                    {/* Booking Details */}
                    <div className="p-4">
                      <div 
                        className="cursor-pointer"
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-lg font-bold text-gray-800">
                            Booking Ref# {booking.bookingRef}
                          </div>
                          <div className="text-sm text-gray-600 font-medium">
                            {booking.selections.length} {booking.selections.length === 1 ? 'Match' : 'Matches'}
                          </div>
                        </div>
                        
                        {booking.apiSource && (
                          <div className="text-xs text-gray-500 mb-3 text-center bg-gray-50 p-1 rounded">
                            {booking.apiSource}
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteBooking(booking.id)}
                          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Clear All Button */}
          {savedBookings.length > 0 && (
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <button
                onClick={clearAllBookings}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Clear All Bookings
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Full Booking Details Modal - Rendered at document body to avoid z-index issues */}
      {selectedBooking && createPortal(
        <>
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-end sm:items-center justify-center"
          onClick={() => {
            console.log('Backdrop clicked, closing modal');
            setSelectedBooking(null);
          }}
          style={{ pointerEvents: 'auto' }}
        >
          <div 
            className="bg-white w-full max-w-md max-h-[90vh] rounded-t-lg sm:rounded-lg overflow-hidden flex flex-col"
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{ pointerEvents: 'auto' }}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">Saved Booking</h3>
                <button
                  onClick={() => {
                    console.log('X button clicked, closing modal');
                    setSelectedBooking(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Booking Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Matches */}
              <div className="mb-4 border-2 border-green-500 rounded-lg overflow-hidden bg-white">
                <div className="max-h-60 overflow-y-auto">
                  {selectedBooking.selections.map((selection, index) => (
                    <div key={index} className="p-3 border-b border-gray-200 bg-yellow-50 last:border-b-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-800">
                            {(() => {
                              let selectionName = '';
                              if (selection.selectionName) {
                                selectionName = selection.selectionName;
                              } else if (selection) {
                                if (selection.priceType === 'home') selectionName = selection.homeTeam;
                                else if (selection.priceType === 'draw') selectionName = 'Draw';
                                else if (selection.priceType === 'away') selectionName = selection.awayTeam;
                                else selectionName = selection.priceType;
                              }
                              const odds = typeof selection?.odds === 'string' ? selection.odds : selection?.odds?.toFixed(2);
                              return `${selectionName} @ ${odds}`;
                            })()}
                          </div>
                          <div className="text-xs text-gray-600 font-medium mt-1">
                            {selection?.homeTeam} v {selection?.awayTeam}
                          </div>
                          {(selection?.competitionName || selection?.league) && (
                            <div className="text-xs text-gray-500 font-medium mt-1">
                              ⚽ {selection.competitionName || selection.league}
                            </div>
                          )}
                          {selection?.matchDate && (
                            <div className="text-xs text-gray-500 font-medium">
                              {(() => {
                                try {
                                  const date = new Date(selection.matchDate);
                                  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                  const day = days[date.getDay()];
                                  const dateNum = date.getDate();
                                  const month = months[date.getMonth()];
                                  const year = date.getFullYear();
                                  return `${day} ${dateNum} ${month} ${year}`;
                                } catch {
                                  return selection.matchDate;
                                }
                              })()}
                            </div>
                          )}
                          {selection?.kickoff && (
                            <div className="text-xs text-gray-500 mt-1">
                              {selection.kickoff} {selection.marketDisplayName || '1 X 2'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Booking Reference Section */}
                <div className="bg-white">
                  {selectedBooking.apiSource && (
                    <div className="p-2 bg-blue-50 text-center border-b border-blue-200">
                      <div className="text-xl font-bold text-blue-700">
                        {selectedBooking.apiSource}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-green-500 text-white text-center">
                    <div className="text-xl font-bold">
                      Booking Ref# {selectedBooking.bookingRef}
                    </div>
                  </div>

                  <div className="p-3 bg-yellow-400 text-center border-t border-yellow-500">
                    <div className="flex items-center justify-center gap-2 text-xl font-bold text-gray-800">
                      <span>📱</span>
                      <span>SMS BET{selectedBooking.bookingRef}</span>
                    </div>
                  </div>

                  <div className="flex border-t border-gray-200">
                    <div className="flex-1 p-3 text-center border-r border-gray-200">
                      <div className="text-xs text-gray-600">Win</div>
                      <div className="text-lg font-bold text-gray-800">
                        {formatCurrency(selectedBooking.potentialWin)}
                      </div>
                    </div>
                    <div className="flex-1 p-3 text-center bg-gray-50">
                      <div className="text-xs text-gray-600">Stake</div>
                      <div className="text-lg font-bold text-gray-800">{selectedBooking.stake}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payout Breakdown */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Stake:</span>
                    <span className="font-medium">Rs {Math.round(selectedBooking.stake)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Tax:</span>
                    <span className="font-medium">-Rs {(selectedBooking.stake * 0.15).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-blue-200 pt-1 font-bold text-xl mt-2">
                    <span className="text-gray-700">Net Payout:</span>
                    <span className="text-green-600">Rs {formatCurrency(selectedBooking.potentialWin)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Delete Button */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <button
                onClick={() => {
                  deleteBooking(selectedBooking.id);
                  setSelectedBooking(null);
                }}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                Delete Booking
              </button>
            </div>
          </div>
        </div>
        </>
      , document.body)}
    </>
  );
};

export default BookingHistory;
