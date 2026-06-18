import React from 'react';
import { PriceButtonProps } from '../types/MatchData';

const PriceButton: React.FC<PriceButtonProps> = ({ 
  odds, 
  type, 
  onClick, 
  disabled = false,
  selected = false 
}) => {
  const getButtonStyle = () => {
    const baseStyle = "px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 min-w-[60px] text-center relative";
    
    if (selected) {
      return `${baseStyle} bg-green-600 text-white border-2 border-green-700 shadow-lg`;
    }
    
    switch (type) {
      case 'home':
        return `${baseStyle} bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-300`;
      case 'draw':
        return `${baseStyle} bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300`;
      case 'away':
        return `${baseStyle} bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-300`;
      case 'over':
        return `${baseStyle} bg-green-100 text-green-800 hover:bg-green-200 border border-green-300`;
      case 'under':
        return `${baseStyle} bg-red-100 text-red-800 hover:bg-red-200 border border-red-300`;
      case 'yes':
        return `${baseStyle} bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300`;
      case 'no':
        return `${baseStyle} bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-300`;
      default:
        return `${baseStyle} bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300`;
    }
  };

  // Handle N/A values and format odds properly
  const displayOdds = () => {
    // Check if odds is 'N/A' string
    if (typeof odds === 'string' && (odds === 'N/A' || odds === 'N/A')) {
      return 'N/A';
    }
    
    // Convert to number and format
    const numericOdds = typeof odds === 'string' ? parseFloat(odds) : odds;
    
    // Check if it's a valid number
    if (typeof numericOdds === 'number' && !isNaN(numericOdds) && isFinite(numericOdds)) {
      // Format to 2 decimal places
      return numericOdds.toFixed(2);
    }
    
    // Default fallback
    return 'N/A';
  };

  const formattedOdds = displayOdds();
  const isAvailable = formattedOdds !== 'N/A';

  return (
    <button
      onClick={onClick}
      disabled={disabled || !isAvailable}
      className={`${getButtonStyle()} ${disabled || !isAvailable ? 'opacity-50 cursor-not-allowed hover:scale-100' : 'cursor-pointer'} ${selected ? 'ring-2 ring-green-400' : ''}`}
    >
      {formattedOdds}
      {selected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
      )}
    </button>
  );
};

export default PriceButton;