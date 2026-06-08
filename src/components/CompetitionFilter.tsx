import React, { useState } from 'react';
import { ChevronDown, Filter } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  competitions?: Competition[];
}

interface Competition {
  id: string;
  name: string;
  matchCount?: number;
}

interface CompetitionFilterProps {
  categories: Category[];
  selectedCategory: string;
  selectedCompetition: string;
  onCategoryChange: (categoryId: string) => void;
  onCompetitionChange: (competitionId: string) => void;
  onFetchCompetitions?: (categoryId: string) => Promise<Competition[]>;
}

const CompetitionFilter: React.FC<CompetitionFilterProps> = ({
  categories,
  selectedCategory,
  selectedCompetition,
  onCategoryChange,
  onCompetitionChange,
  onFetchCompetitions
}) => {
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showCompetitionDropdown, setShowCompetitionDropdown] = useState(false);

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);
  const competitions = selectedCategoryData?.competitions || [];
  const selectedCompetitionData = competitions.find(c => c.id === selectedCompetition);

  return (
    <div className="bg-white shadow-sm border-b border-gray-200 px-3 py-2">
      <div className="flex gap-2 max-w-3xl mx-auto">
        {/* Category Dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">
                {selectedCategoryData ? selectedCategoryData.name : 'Category'}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showCategoryDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  onCategoryChange('');
                  onCompetitionChange('');
                  setShowCategoryDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  !selectedCategory ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                All Categories
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={async () => {
                    onCategoryChange(category.id);
                    onCompetitionChange(''); // Reset competition when category changes
                    
                    // Fetch competitions for this category using the NAME
                    if (onFetchCompetitions) {
                      const competitions = await onFetchCompetitions(category.name);
                      console.log('🏆 Fetched competitions:', competitions);
                    }
                    
                    setShowCategoryDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    selectedCategory === category.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Competition Dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => competitions.length > 0 && setShowCompetitionDropdown(!showCompetitionDropdown)}
            disabled={competitions.length === 0}
            className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg transition-colors text-sm ${
              competitions.length === 0
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-700">
                {selectedCompetitionData ? selectedCompetitionData.name : 'Competition'}
              </span>
              {selectedCompetitionData?.matchCount !== undefined && (
                <span className="text-xs text-gray-500">({selectedCompetitionData.matchCount})</span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showCompetitionDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showCompetitionDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  onCompetitionChange('');
                  setShowCompetitionDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  !selectedCompetition ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                All Competitions
              </button>
              {competitions.map((competition) => (
                <button
                  key={competition.id}
                  onClick={() => {
                    onCompetitionChange(competition.id);
                    setShowCompetitionDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    selectedCompetition === competition.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                  }`}
                >
                  {competition.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompetitionFilter;
