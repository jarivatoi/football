import React, { useState } from 'react';
import { Search, Globe, Database, CheckCircle, AlertCircle, Eye } from 'lucide-react';

interface EndpointResult {
  url: string;
  status: 'testing' | 'success' | 'error';
  data?: any;
  error?: string;
  hasOdds?: boolean;
  oddsTypes?: string[];
}

const EndpointDiscovery: React.FC = () => {
  const [results, setResults] = useState<EndpointResult[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const potentialEndpoints = [
    // Main sports API with different parameters
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    
    // Try different periodCode values (might unlock more odds)
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=FT`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=HT`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=1H`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=2H`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=odds`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=markets`,
    
    // Try different pageNo values (might be pagination issue)
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=1&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=500&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=1000&inclusive=1&matchid=0&periodCode=all`,
    
    // Try different inclusive values
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=0&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=2&matchid=0&periodCode=all`,
    
    // Try specific match IDs (from your actual data)
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=227932&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=227369&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=227375&periodCode=all`,
    
    // Try different API paths that might exist
    `/api/webapi/GetMatchData?sportId=soccer&date=${selectedDate}`,
    `/api/webapi/GetFullData?sportId=soccer&date=${selectedDate}`,
    `/api/webapi/GetExtendedData?sportId=soccer&date=${selectedDate}`,
    `/api/webapi/GetCompleteData?sportId=soccer&date=${selectedDate}`,
    `/api/webapi/GetAllOdds?sportId=soccer&date=${selectedDate}`,
    `/api/webapi/GetDetailedOdds?sportId=soccer&date=${selectedDate}`,
    
    // Try different sport IDs
    `/api/webapi/GetSport?sportId=1&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=football&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    
    // Try different category values
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=odds&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=markets&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=betting&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=full&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    
    // Try completely different endpoint names
    `/api/webapi/GetBetting?sportId=soccer&date=${selectedDate}`,
    `/api/webapi/GetOddsData?sportId=soccer&date=${selectedDate}`,
    `/api/webapi/GetMarketData?sportId=soccer&date=${selectedDate}`,
    `/api/webapi/GetPrices?sportId=soccer&date=${selectedDate}`,
    
    // Try with specific competition IDs (from your data: 81, 126, 50, etc.)
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=81&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=126&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=50&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    
    // Try potential mobile/app endpoints
    `/api/mobile/GetSport?sportId=soccer&date=${selectedDate}`,
    `/api/app/GetSport?sportId=soccer&date=${selectedDate}`,
    `/api/json/GetSport?sportId=soccer&date=${selectedDate}`,
    
    // Try with additional parameters that might unlock more data
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all&detailed=1`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all&complete=1`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all&withOdds=1`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all&fullOdds=1`,
  ];

  const testEndpoint = async (url: string): Promise<EndpointResult> => {
    console.log(`🔍 Testing endpoint: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.5',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        return {
          url,
          status: 'error',
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      console.log(`✅ Success for ${url}:`, data);

      // Analyze the response for odds data
      const analysis = analyzeResponseForOdds(data);
      
      return {
        url,
        status: 'success',
        data,
        hasOdds: analysis.hasOdds,
        oddsTypes: analysis.oddsTypes
      };

    } catch (error) {
      console.error(`❌ Error for ${url}:`, error);
      return {
        url,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const analyzeResponseForOdds = (data: any): { hasOdds: boolean; oddsTypes: string[] } => {
    const oddsTypes: string[] = [];
    let hasOdds = false;

    const dataStr = JSON.stringify(data).toLowerCase();
    
    // Check for different odds types
    if (dataStr.includes('btts') || dataStr.includes('both') || dataStr.includes('score')) {
      oddsTypes.push('BTTS');
      hasOdds = true;
    }
    
    if (dataStr.includes('over') || dataStr.includes('under') || dataStr.includes('total')) {
      oddsTypes.push('Over/Under');
      hasOdds = true;
    }
    
    if (dataStr.includes('handicap') || dataStr.includes('asian')) {
      oddsTypes.push('Handicap');
      hasOdds = true;
    }
    
    if (dataStr.includes('corner') || dataStr.includes('card')) {
      oddsTypes.push('Specials');
      hasOdds = true;
    }

    // Check for odds patterns (decimal odds)
    const oddsPattern = /\b[1-9]\.\d{1,2}\b/g;
    const oddsMatches = dataStr.match(oddsPattern);
    if (oddsMatches && oddsMatches.length > 10) { // More than just 1X2
      oddsTypes.push('Multiple Odds');
      hasOdds = true;
    }

    // Check for specific field names
    if (dataStr.includes('homeodds') || dataStr.includes('awayodds')) {
      oddsTypes.push('1X2');
      hasOdds = true;
    }

    return { hasOdds, oddsTypes };
  };

  const discoverEndpoints = async () => {
    setIsDiscovering(true);
    setResults([]);

    // Initialize results with testing status
    const initialResults = potentialEndpoints.map(url => ({
      url,
      status: 'testing' as const
    }));
    setResults(initialResults);

    // Test endpoints with delay to avoid rate limiting
    for (let i = 0; i < potentialEndpoints.length; i++) {
      const url = potentialEndpoints[i];
      
      try {
        const result = await testEndpoint(url);
        
        setResults(prev => prev.map(r => 
          r.url === url ? result : r
        ));
        
        // Add delay between requests
        if (i < potentialEndpoints.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        setResults(prev => prev.map(r => 
          r.url === url ? { ...r, status: 'error', error: 'Request failed' } : r
        ));
      }
    }

    setIsDiscovering(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'testing':
        return <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'testing':
        return 'bg-blue-50 border-blue-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const successfulResults = results.filter(r => r.status === 'success');
  const oddsResults = results.filter(r => r.hasOdds);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Globe className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">Totelepep Endpoint Discovery</h2>
      </div>

      <div className="space-y-4">
        <p className="text-gray-600">
          Discover Totelepep API endpoints that contain BTTS and Over/Under odds data.
        </p>

        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={discoverEndpoints}
            disabled={isDiscovering}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              isDiscovering
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 transform hover:scale-105 active:scale-95'
            }`}
          >
            {isDiscovering ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Discovering...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Discover Endpoints
              </>
            )}
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{potentialEndpoints.length}</div>
                <div className="text-sm text-blue-700">Total Endpoints</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{successfulResults.length}</div>
                <div className="text-sm text-green-700">Successful</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{oddsResults.length}</div>
                <div className="text-sm text-yellow-700">With Odds Data</div>
              </div>
            </div>

            {/* Results */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm text-gray-800 break-all">
                        {result.url}
                      </div>
                      
                      {result.status === 'success' && result.hasOdds && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {result.oddsTypes?.map((type, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {result.error && (
                        <div className="mt-1 text-sm text-red-600">
                          {result.error}
                        </div>
                      )}
                      
                      {result.status === 'success' && result.data && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                            <Eye className="w-3 h-3 inline mr-1" />
                            View Response Data
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto max-h-40">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Best Results Summary */}
            {oddsResults.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">
                  🎯 Endpoints with Odds Data Found:
                </h3>
                <ul className="space-y-1">
                  {oddsResults.map((result, index) => (
                    <li key={index} className="text-sm text-yellow-700">
                      <strong>{result.url}</strong>
                      <span className="ml-2">
                        ({result.oddsTypes?.join(', ')})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Tests {potentialEndpoints.length} potential Totelepep API endpoints</p>
          <p>• Analyzes responses for BTTS, Over/Under, and other odds data</p>
          <p>• Includes 1-second delay between requests to respect rate limits</p>
          <p>• Shows detailed response data for successful endpoints</p>
        </div>
      </div>
    </div>
  );
};

export default EndpointDiscovery;