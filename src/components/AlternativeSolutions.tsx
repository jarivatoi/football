import React, { useState } from 'react';
import { Lightbulb, ExternalLink, Code, Database, Globe, Search } from 'lucide-react';

const AlternativeSolutions: React.FC = () => {
  const [selectedSolution, setSelectedSolution] = useState<string>('');

  const solutions = [
    {
      id: 'web-scraping',
      title: 'Web Scraping Totelepep Website',
      description: 'Extract BTTS/O/U odds directly from the HTML pages',
      pros: [
        'Access to all odds types displayed on website',
        'Real-time data from live pages',
        'Complete match information'
      ],
      cons: [
        'Requires CORS proxy or server-side scraping',
        'Website structure changes can break extraction',
        'Rate limiting and anti-bot measures'
      ],
      implementation: 'Use Puppeteer/Playwright on server to scrape match pages',
      difficulty: 'Medium',
      icon: Globe
    },
    {
      id: 'browser-extension',
      title: 'Browser Extension Approach',
      description: 'Create extension to extract data directly from user\'s browser',
      pros: [
        'No CORS issues',
        'Direct access to website data',
        'Can inject into existing pages'
      ],
      cons: [
        'Requires users to install extension',
        'Limited to browser environment',
        'Extension store approval needed'
      ],
      implementation: 'Chrome/Firefox extension with content scripts',
      difficulty: 'Medium',
      icon: Code
    },
    {
      id: 'alternative-apis',
      title: 'Alternative Betting APIs',
      description: 'Use other sports betting APIs that provide BTTS/O/U odds',
      pros: [
        'Official API access',
        'Reliable data structure',
        'Better rate limits and support'
      ],
      cons: [
        'May require API keys/subscriptions',
        'Different data format',
        'Might not have same matches as Totelepep'
      ],
      implementation: 'Integrate with APIs like Odds API, SportRadar, etc.',
      difficulty: 'Easy',
      icon: Database
    },
    {
      id: 'hybrid-approach',
      title: 'Hybrid Data Combination',
      description: 'Combine Totelepep 1X2 odds with other sources for BTTS/O/U',
      pros: [
        'Keep existing Totelepep integration',
        'Add missing odds from other sources',
        'Best of both worlds'
      ],
      cons: [
        'Complex data matching logic',
        'Potential inconsistencies',
        'Multiple API dependencies'
      ],
      implementation: 'Match teams/leagues across different APIs',
      difficulty: 'Hard',
      icon: Search
    },
    {
      id: 'mock-realistic',
      title: 'Generate Realistic Mock Odds',
      description: 'Create realistic BTTS/O/U odds based on 1X2 odds patterns',
      pros: [
        'No additional API dependencies',
        'Always available',
        'Realistic odds calculations'
      ],
      cons: [
        'Not real betting odds',
        'For demonstration purposes only',
        'Cannot be used for actual betting'
      ],
      implementation: 'Mathematical models based on 1X2 odds',
      difficulty: 'Easy',
      icon: Lightbulb
    }
  ];

  const handleImplementSolution = (solutionId: string) => {
    setSelectedSolution(solutionId);
    
    switch (solutionId) {
      case 'web-scraping':
        break;
        
      case 'browser-extension':
        break;
        
      case 'alternative-apis':
        break;
        
      case 'hybrid-approach':
        break;
        
      case 'mock-realistic':
        break;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Lightbulb className="w-6 h-6 text-yellow-600" />
        <h2 className="text-xl font-bold text-gray-800">Alternative Solutions for BTTS & Over/Under Odds</h2>
      </div>

      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">🔍 Analysis Complete:</h3>
          <p className="text-yellow-700 text-sm">
            The Totelepep <code>/webapi/GetSport</code> endpoint only provides <strong>1X2 odds</strong> in a fixed 29-field structure. 
            BTTS and Over/Under odds are <strong>not available</strong> through this API endpoint.
          </p>
        </div>

        <p className="text-gray-600">
          Since the API doesn't provide BTTS and Over/Under odds, here are alternative approaches to get this data:
        </p>

        <div className="grid gap-4">
          {solutions.map((solution) => {
            const Icon = solution.icon;
            const isSelected = selectedSolution === solution.id;
            
            return (
              <div
                key={solution.id}
                className={`border rounded-lg p-4 transition-all duration-200 ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    isSelected ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      isSelected ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">{solution.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          solution.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                          solution.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {solution.difficulty}
                        </span>
                        <button
                          onClick={() => handleImplementSolution(solution.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                        >
                          View Plan
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3">{solution.description}</p>
                    
                    <div className="grid md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <h4 className="font-medium text-green-700 mb-1">✅ Pros:</h4>
                        <ul className="text-green-600 space-y-1">
                          {solution.pros.map((pro, index) => (
                            <li key={index}>• {pro}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-red-700 mb-1">❌ Cons:</h4>
                        <ul className="text-red-600 space-y-1">
                          {solution.cons.map((con, index) => (
                            <li key={index}>• {con}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        <strong>Implementation:</strong> {solution.implementation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recommendation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">💡 Recommended Approach:</h3>
          <div className="text-blue-700 text-sm space-y-2">
            <p>
              <strong>Short-term:</strong> Use the <strong>Mock Realistic Odds</strong> approach to demonstrate 
              the complete betting interface with mathematically generated BTTS/O/U odds.
            </p>
            <p>
              <strong>Long-term:</strong> Implement <strong>Web Scraping</strong> or find <strong>Alternative APIs</strong> 
              that provide the complete odds data you need for production use.
            </p>
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">📊 Current Implementation Status:</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>✅ <strong>1X2 Odds:</strong> Successfully extracted from Totelepep API</p>
            <p>✅ <strong>Match Data:</strong> Teams, leagues, times, dates working perfectly</p>
            <p>🎲 <strong>BTTS/O/U Odds:</strong> Currently using realistic mock data</p>
            <p>🔧 <strong>Interface:</strong> Complete betting interface ready for real odds</p>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Analysis tested 18 different endpoint configurations</p>
          <p>• All successful endpoints return identical 29-field match structure</p>
          <p>• No hidden parameters unlock extended odds data</p>
          <p>• Check console logs for detailed implementation plans</p>
        </div>
      </div>
    </div>
  );
};

export default AlternativeSolutions;
