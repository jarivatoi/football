import React from 'react';
import { Calendar } from 'lucide-react';
import { useLongPress } from '../hooks/useLongPress';

interface RosterDateHeaderButtonProps {
  date: string;
  onLongPress: () => void;
  isToday: (dateString: string) => boolean;
  realtimeStatus?: 'connecting' | 'connected' | 'error' | 'disconnected';
  onManualRefresh?: (date?: string) => void;
  isRefreshing?: boolean;
}

export const RosterDateHeaderButton: React.FC<RosterDateHeaderButtonProps> = ({
  date,
  onLongPress,
  isToday,
  realtimeStatus = 'disconnected',
  onManualRefresh,
  isRefreshing = false
}) => {
  const longPressHandlers = useLongPress({
    onLongPress,
    delay: 2500
  });

  // Format date as 27-7-25 (Sunday) Today
  const formatSingleLineDate = (dateString: string) => {
    const date = new Date(dateString);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const monthName = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    const formattedDate = `${dayName} ${day}-${monthName}-${year}`;
    return isToday(dateString) ? `${formattedDate} (Today)` : formattedDate;
  };

  return (
    <div
      {...longPressHandlers}
      style={{
        position: 'sticky',
        top: '0px',
        zIndex: 150,
        padding: window.innerWidth > window.innerHeight ? '8px 12px' : '16px 16px', // Less padding in landscape
        margin: '0',
        border: 'none',
        fontSize: window.innerWidth > window.innerHeight ? '14px' : '18px', // Smaller text in landscape
        fontWeight: 'bold',
        textAlign: 'center',
        color: 'white',
        backgroundColor: isToday(date) ? '#059669' : '#4f46e5',
        background: isToday(date) ? '#059669' : '#4f46e5',
        opacity: 1,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        cursor: 'pointer',
        touchAction: 'manipulation',
        width: '100%',
        // Prevent layout shifts during refresh
        transform: 'translate3d(0,0,0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        // Prevent scrollbars
        overflow: 'hidden',
        // Ensure stable positioning
        contain: 'layout style paint'
      }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        width: '100%',
        position: 'relative',
        // Prevent content shifting
        minHeight: window.innerWidth > window.innerHeight ? '20px' : '24px',
        overflow: 'hidden'
      }}>
        {/* Left side icon */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          flexShrink: 0,
          width: window.innerWidth > window.innerHeight ? '20px' : '24px',
          justifyContent: 'center'
        }}>
          <Calendar style={{ 
            width: window.innerWidth > window.innerHeight ? '16px' : '20px', 
            height: window.innerWidth > window.innerHeight ? '16px' : '20px', 
            color: 'white'
          }} />
        </div>
        <div style={{
          flex: 1,
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: window.innerWidth > window.innerHeight ? '14px' : '16px',
          color: 'white',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          minHeight: window.innerWidth > window.innerHeight ? '20px' : '24px'
        }}>
          <span>{formatSingleLineDate(date)}</span>
          
          {/* Refresh button next to date text */}
          {onManualRefresh && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onManualRefresh(date);
              }}
              disabled={isRefreshing}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '2px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: isRefreshing ? 0.7 : 1,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                flexShrink: 0,
                // Prevent button from causing layout shifts
                width: '32px',
                height: '24px',
                justifyContent: 'center',
                transform: 'translate3d(0,0,0)',
                backfaceVisibility: 'hidden'
              }}
              title={
                realtimeStatus === 'connected' ? 'Manual refresh (Real-time active)' :
                realtimeStatus === 'connecting' ? 'Manual refresh (Connecting...)' :
                realtimeStatus === 'error' ? 'Manual refresh (Real-time failed)' :
                'Manual refresh (Real-time disconnected)'
              }
            >
              {/* Spinner Container */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                position: 'relative'
              }}>
                {/* Refresh icon with rotation animation when loading */}
                <svg 
                  style={{
                    width: '18px',
                    height: '18px',
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                    transform: 'translate3d(0,0,0)',
                    backfaceVisibility: 'hidden'
                  }}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
              </div>
              
              {/* Status Dot Container */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '12px',
                height: '12px',
                position: 'relative'
              }}>
                {/* Real-time status indicator */}
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: realtimeStatus === 'connected' ? '#10b981' : 
                                  realtimeStatus === 'connecting' ? '#f59e0b' :
                                  realtimeStatus === 'error' ? '#ef4444' : '#6b7280',
                  animation: realtimeStatus === 'connecting' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  boxShadow: realtimeStatus === 'connected' ? '0 0 8px rgba(16, 185, 129, 0.8)' : 'none',
                  backfaceVisibility: 'hidden'
                }} />
              </div>
            </button>
          )}
        </div>
        
        {/* Empty space to maintain layout balance */}
        <div style={{ 
          width: window.innerWidth > window.innerHeight ? '20px' : '24px', 
          flexShrink: 0,
          height: window.innerWidth > window.innerHeight ? '20px' : '24px'
        }} />
      </div>
    </div>
  );
};