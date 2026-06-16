import React, { useState, useEffect, useRef } from 'react';
import { X, Check, ChevronRight } from 'lucide-react';

interface FilterBuilderProps {
  searchTerm: string;
  onApply: (filter: string) => void;
  onClose: () => void;
}

interface SuggestionStep {
  title: string;
  options: Array<{
    label: string;
    value: string;
    description?: string;
  }>;
}

const FilterBuilder: React.FC<FilterBuilderProps> = ({ searchTerm, onApply, onClose }) => {
  const [currentFilter, setCurrentFilter] = useState(searchTerm);
  const [suggestions, setSuggestions] = useState<SuggestionStep | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Parse current filter state and generate suggestions
  useEffect(() => {
    const parsed = parseFilterState(currentFilter);
    setSuggestions(getNextSuggestions(parsed));
  }, [currentFilter]);

  const parseFilterState = (filter: string) => {
    // Parse: 150FTUO+2.5
    const match = filter.match(/^(\d{2,3})(FT|H1|H2|2H|ALL)?(DC|UO|BTTS|GM|CS|WM|OE|FTTS|LTTS|AH|HTFT|HSH)?([+-])?(\d+\.\d+)?$/);
    
    if (!match) {
      // Try to parse partial
      const oddsMatch = filter.match(/^(\d{2,3})/);
      const periodMatch = filter.match(/\d{2,3}(FT|H1|H2|2H|ALL)/);
      const marketMatch = filter.match(/(DC|UO|BTTS|GM|CS|WM|OE|FTTS|LTTS|AH|HTFT|HSH)/);
      const lineMatch = filter.match(/([+-]?\d+\.\d+)$/);
      
      return {
        odds: oddsMatch ? oddsMatch[1] : null,
        period: periodMatch ? periodMatch[1] : null,
        market: marketMatch ? marketMatch[1] : null,
        line: lineMatch ? lineMatch[1] : null,
        isComplete: false
      };
    }
    
    return {
      odds: match[1],
      period: match[2] || null,
      market: match[3] || null,
      option: match[4] || null,
      line: match[5] || null,
      isComplete: true
    };
  };

  const getNextSuggestions = (parsed: any): SuggestionStep | null => {
    // Step 1: No odds yet
    if (!parsed.odds) {
      return {
        title: 'Enter odds first (e.g., 150 for 1.50)',
        options: []
      };
    }

    // Step 2: Has odds, needs period
    if (!parsed.period) {
      return {
        title: 'Select Period',
        options: [
          { label: 'ALL', value: 'ALL', description: 'FT + H1 + H2' },
          { label: 'FT', value: 'FT', description: 'Full Time' },
          { label: 'H1', value: 'H1', description: '1st Half' },
          { label: 'H2', value: 'H2', description: '2nd Half' }
        ]
      };
    }

    // Step 3: Has period, needs market
    if (!parsed.market) {
      return {
        title: 'Select Market Type',
        options: [
          { label: 'ALL', value: '', description: 'All markets (default)' },
          { label: 'UO', value: 'UO', description: 'Over/Under' },
          { label: 'BTTS', value: 'BTTS', description: 'Both Teams To Score' },
          { label: 'DC', value: 'DC', description: 'Double Chance' },
          { label: 'CS', value: 'CS', description: 'Correct Score' },
          { label: 'WM', value: 'WM', description: 'Winning Margin' },
          { label: 'OE', value: 'OE', description: 'Odd/Even' },
          { label: 'FTTS', value: 'FTTS', description: 'First Team To Score' },
          { label: 'LTTS', value: 'LTTS', description: 'Last Team To Score' },
          { label: 'AH', value: 'AH', description: 'Asian Handicap' },
          { label: 'HTFT', value: 'HTFT', description: 'Half Time/Full Time' },
          { label: 'HSH', value: 'HSH', description: 'Highest Scoring Half' },
          { label: 'GM', value: 'GM', description: 'Goal Market' }
        ]
      };
    }

    // Step 4: UO market needs line
    if (parsed.market === 'UO' && !parsed.line) {
      return {
        title: 'Select Line',
        options: [
          { label: '0.5', value: '0.5' },
          { label: '1.5', value: '1.5' },
          { label: '2.5', value: '2.5' },
          { label: '3.5', value: '3.5' },
          { label: '4.5', value: '4.5' },
          { label: '5.5', value: '5.5' }
        ]
      };
    }

    // Step 5: UO market with line needs option (+/-)
    if (parsed.market === 'UO' && parsed.line && !parsed.option) {
      return {
        title: 'Select Option',
        options: [
          { label: '+', value: '+', description: 'Over' },
          { label: '-', value: '-', description: 'Under' },
          { label: '(both)', value: '', description: 'Over or Under' }
        ]
      };
    }

    // Step 4b: BTTS market needs Y/N
    if (parsed.market === 'BTTS' && !parsed.option) {
      return {
        title: 'Select Option',
        options: [
          { label: 'Y', value: 'Y', description: 'Yes' },
          { label: 'N', value: 'N', description: 'No' },
          { label: '(both)', value: '', description: 'Yes or No' }
        ]
      };
    }

    // Complete
    return null;
  };

  const handleOptionClick = (value: string) => {
    let newFilter = currentFilter;
    const parsed = parseFilterState(currentFilter);

    if (!parsed.period) {
      newFilter = parsed.odds + value;
    } else if (!parsed.market) {
      newFilter = parsed.odds + parsed.period + value;
    } else if (parsed.market === 'UO' && !parsed.line) {
      newFilter = parsed.odds + parsed.period + parsed.market + '+' + value;
    } else if (parsed.market === 'UO' && parsed.line && !parsed.option) {
      // Replace the + with selected option
      const base = parsed.odds + parsed.period + parsed.market;
      newFilter = value === '' ? base + parsed.line : base + value + parsed.line;
    } else if (parsed.market === 'BTTS' && !parsed.option) {
      const base = parsed.odds + parsed.period + parsed.market;
      newFilter = value === '' ? base : base + value;
    }

    setCurrentFilter(newFilter);
  };

  const isValid = (filter: string) => {
    // Valid: 150FT, 150FTUO+2.5, 150H1BTTSY, etc.
    return /^(\d{2,3})(FT|H1|H2|2H|ALL)?(DC|UO|BTTS|GM|CS|WM|OE|FTTS|LTTS|AH|HTFT|HSH)?([+-YN])?(\d+\.\d+)?$/.test(filter);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        ref={popupRef}
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">Filter Builder</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Filter Preview */}
        <div className="p-4 bg-blue-50 border-b">
          <div className="text-sm text-gray-600 mb-1">Current Filter:</div>
          <div className="text-2xl font-mono font-bold text-blue-900">
            {currentFilter || '...'}
          </div>
        </div>

        {/* Suggestions */}
        <div className="p-4 overflow-y-auto max-h-96">
          {suggestions && suggestions.options.length > 0 ? (
            <>
              <div className="text-sm font-semibold text-gray-700 mb-2">{suggestions.title}</div>
              <div className="space-y-1">
                {suggestions.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleOptionClick(option.value)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-blue-50 transition-colors border border-gray-200 hover:border-blue-300"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">{option.label}</span>
                      {option.description && (
                        <span className="text-sm text-gray-500">{option.description}</span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-green-600">
              <Check className="w-12 h-12 mx-auto mb-2" />
              <div className="font-semibold">Filter Complete!</div>
            </div>
          )}
        </div>

        {/* Footer with Validate Button */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={() => onApply(currentFilter)}
            disabled={!isValid(currentFilter)}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              isValid(currentFilter)
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isValid(currentFilter) ? '✓ Apply Filter' : 'Incomplete Filter'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBuilder;
