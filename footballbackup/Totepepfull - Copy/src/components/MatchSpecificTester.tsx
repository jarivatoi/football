import React, { useState } from 'react';
import { Target, Play, Database, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { matchSpecificExtractor, MatchOddsData } from '../services/matchSpecificExtractor';

const MatchSpecificTester: React.FC = () => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [results, setResults] = useState<Array<{
    matchId: string;
    competitionId: string;
    status: 'testing' | 'success' | 'error';
    data?: MatchOddsData;
    error?: string;
  }>>([]);

  // Test matches from your Power Query data
  const testMatches = [
    { matchId: '227932', competitionId: '81', description: 'FC Dornbirn v FC Salzburg (Austria Cup)' },
    { matchId: '227369', competitionId: '126', description: 'Everton FC v Mansfield Town (EFL Cup)' },
    { matchId: '227375', competitionId: '163', description: 'RC Celta de Vigo v Real Betis (La Liga)' },
    { matchId: '227365', competitionId: '50', description: 'Qarabag FK v Ferencvarosi Budapest (Champions League)' },
    { matchId: '227499', competitionId: '55', description: 'Riga FC v Sparta Prague (Conference League)' },
    { matchId: '227368', competitionId: '135', description: 'AEK Larnaca v SK Brann (Europa League)' },
    { matchId: '228126', competitionId: '52', description: 'Machida Zelvia v Kashima Antlers (Japan)' },
    { matchId: '227655', competitionId: '38', description: 'FK Kauno Zalgiris v FC Hegelmann Kaunas (Lithuania)' },
    
    // Test the exact match from your Power Query example
    { matchId: '48374', competitionId: '144', description: 'Power Query Example Match' },
  ];

  const testMatchSpecificEndpoints = async () => {
    setIsExtracting(true);
    setResults([]);

    // Initialize results
    const initialResults = testMatches.map(match => ({
      matchId: match.matchId,
      competitionId: match.competitionId,
      status: 'testing' as const,
      description: match.description
    }));
    setResults(initialResults);

    console.log('🎯 Testing match-specific GetMatch endpoints...');
    console.log('📋 Based on Power Query: /webapi/GetMatch?sportId=soccer&competitionId=X&matchId=Y&periodCode=all');

    for (const match of testMatches) {
      try {
        console.log(`\n🔍 Testing match ${match.matchId} (${match.description})`);
        
        const oddsData = await matchSpecificExtractor.extractMatchOdds(match.matchId, match.competitionId);
        
        setResults(prev => prev.map(r => 
          r.matchId === match.matchId ? {
            ...r,
            status: oddsData ? 'success' : 'error',
            data: oddsData || undefined,
            error: oddsData ? undefined : 'No odds data found'
          } : r
        ));

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error testing match ${match.matchId}:`, error);
        setResults(prev => prev.map(r => 
          r.matchId === match.matchId ? {
            ...r,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          } : r
        ));
      }
    }

    setIsExtracting(false);
    console.log('🎯 Match-specific endpoint testing complete!');
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

  const successfulResults = results.filter(r => r.status === 'success' && r.data);
  const oddsResults = results.filter(r => r.data && (r.data.bttsYes || r.data.over25));

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Target className="w-6 h-6 text-green-600" />
        <h2 className="text-xl font-bold text-gray-800">Match-Specific Odds Extractor</h2>
      </div>

      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-800 mb-2">🎯 Power Query Discovery:</h3>
          <p className="text-green-700 text-sm mb-2">
            Found the real endpoint: <code>/webapi/GetMatch?sportId=soccer&competitionId=X&matchId=Y&periodCode=all</code>
          </p>
          <p className="text-green-600 text-xs">
            This endpoint returns detailed odds in Name/Value table structure (like Power Query Table.ExpandTableColumn)
          </p>
        </div>

        <p className="text-gray-600">
          Test individual match endpoints to extract BTTS and Over/Under odds using the Power Query approach.
        </p>

        <button
          onClick={testMatchSpecificEndpoints}
          disabled={isExtracting}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            isExtracting
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 transform hover:scale-105 active:scale-95'
          }`}
        >
          {isExtracting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Testing Matches...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Test Match-Specific Endpoints
            </>
          )}
        </button>

        {results.length > 0 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{testMatches.length}</div>
                <div className="text-sm text-blue-700">Matches Tested</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{successfulResults.length}</div>
                <div className="text-sm text-green-700">Successful</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{oddsResults.length}</div>
                <div className="text-sm text-yellow-700">With BTTS/O/U Odds</div>
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
                      <div className="font-medium text-gray-800">
                        Match {result.matchId} (Competition {result.competitionId})
                      </div>
                      <div className="text-sm text-gray-600">
                        {testMatches.find(m => m.matchId === result.matchId)?.description}
                      </div>
                      
                      {result.status === 'success' && result.data && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {result.data.bttsYes !== undefined && (
                            <div className="bg-green-100 text-green-800 px-2 py-1 rounded">
                              BTTS Yes: {typeof result.data.bttsYes === 'string' ? result.data.bttsYes : result.data.bttsYes.toFixed(2)}
                            </div>
                          )}
                          {result.data.bttsNo !== undefined && (
                            <div className="bg-green-100 text-green-800 px-2 py-1 rounded">
                              BTTS No: {typeof result.data.bttsNo === 'string' ? result.data.bttsNo : result.data.bttsNo.toFixed(2)}
                            </div>
                          )}
                          {result.data.over25 !== undefined && (
                            <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Over 2.5: {typeof result.data.over25 === 'string' ? result.data.over25 : result.data.over25.toFixed(2)}
                            </div>
                          )}
                          {result.data.under25 !== undefined && (
                            <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Under 2.5: {typeof result.data.under25 === 'string' ? result.data.under25 : result.data.under25.toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {result.error && (
                        <div className="mt-1 text-sm text-red-600">
                          {result.error}
                        </div>
                      )}
                      
                      {result.status === 'success' && result.data && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-green-600 hover:text-green-800">
                            <Eye className="w-3 h-3 inline mr-1" />
                            View All Odds Data
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

            {/* Success Summary */}
            {oddsResults.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">
                  🎉 SUCCESS! Found Real BTTS/Over-Under Odds:
                </h3>
                <ul className="space-y-1">
                  {oddsResults.map((result, index) => (
                    <li key={index} className="text-sm text-green-700">
                      <strong>Match {result.matchId}:</strong>
                      {result.data?.bttsYes !== undefined && ` BTTS Yes: ${typeof result.data.bttsYes === 'string' ? result.data.bttsYes : result.data.bttsYes.toFixed(2)}`}
                      {result.data?.bttsNo !== undefined && ` BTTS No: ${typeof result.data.bttsNo === 'string' ? result.data.bttsNo : result.data.bttsNo.toFixed(2)}`}
                      {result.data?.over25 !== undefined && ` Over 2.5: ${typeof result.data.over25 === 'string' ? result.data.over25 : result.data.over25.toFixed(2)}`}
                      {result.data?.under25 !== undefined && ` Under 2.5: ${typeof result.data.under25 === 'string' ? result.data.under25 : result.data.under25.toFixed(2)}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Market Analysis Summary */}
            {results.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">
                  📊 Market Analysis Summary:
                </h3>
                <div className="text-sm text-yellow-700 space-y-1">
                  <p><strong>Key Finding:</strong> Main API only returns 1X2 markets (CP code)</p>
                  <p><strong>Solution:</strong> Making individual API calls for each match to get detailed markets</p>
                  <p><strong>Expected Markets:</strong> BTTS (Both Teams To Score) and Over/Under markets</p>
                  <p><strong>Market Counts:</strong> {results.map(r => `Match ${r.matchId}: ${r.data?.additionalOdds ? Object.keys(r.data.additionalOdds).length : 0} markets`).join(', ')}</p>
                  <p><strong>Next Steps:</strong> Need to find endpoint parameters that return all market types</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Tests the Power Query GetMatch endpoint for individual matches</p>
          <p>• Analyzes market structure and identifies missing BTTS/Over-Under markets</p>
          <p>• Includes 1.5-second delay between requests for rate limiting</p>
          <p>• Shows market count discrepancies to identify missing data</p>
        </div>
      </div>
    </div>
  );
};

export default MatchSpecificTester;