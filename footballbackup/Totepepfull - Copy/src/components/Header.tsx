import React from 'react';
import { TrendingUp } from 'lucide-react';
import OfflineIndicator from './OfflineIndicator';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
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
          <OfflineIndicator />
        </div>
      </div>
    </header>
  );
};

export default Header;