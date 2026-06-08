import React from 'react';
import { TrendingUp, Ticket } from 'lucide-react';
import OfflineIndicator from './OfflineIndicator';

interface HeaderProps {
  selectionCount: number;
  onSlipClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ selectionCount, onSlipClick }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Totelepep Soccer</h1>
              <p className="text-sm text-gray-600">Global Football Odds & Data</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Slip Counter Button */}
            {selectionCount > 0 && (
              <button
                onClick={onSlipClick}
                className="relative flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-3 py-2 rounded-lg font-semibold transition-colors"
              >
                <Ticket className="w-5 h-5" />
                <span className="text-sm">Slip</span>
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {selectionCount}
                </span>
              </button>
            )}
            <OfflineIndicator />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;