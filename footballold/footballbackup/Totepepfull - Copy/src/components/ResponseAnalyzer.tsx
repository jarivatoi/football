import React, { useState } from 'react';
import { Search, Eye, Database, AlertTriangle } from 'lucide-react';

interface ResponseComparison {
  endpoint: string;
  response: any;
  matchDataLength: number;
  competitionDataLength: number;
  uniqueFields: string[];
  hasExtendedData: boolean;
}

const ResponseAnalyzer: React.FC = () => {
  const [comparisons, setComparisons] = useState<ResponseComparison[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const keyEndpoints = [
    // Base endpoint
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    
    // Different periodCode values
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=FT`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=odds`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=markets`,
    
    // Different category values
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=odds&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=markets&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=betting&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=full&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    
    // Different inclusive values
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=0&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=2&matchid=0&periodCode=all`,
    
    // Competition-specific
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=81&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=126&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=50&pageNo=200&inclusive=1&matchid=0&periodCode=all`,
    
    // Match-specific
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=227932&periodCode=all`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=227369&periodCode=all`,
    
    // Additional parameters
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all&detailed=1`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all&withOdds=1`,
    `/api/webapi/GetSport?sportId=soccer&date=${selectedDate}&category=&competitionId=0&pageNo=200&inclusive=1&matchid=0&periodCode=all&fullOdds=1`,
  ];

  const analyzeResponses = async () => {
    setIsAnalyzing(true);
    setComparisons([]);

    const results: ResponseComparison[] = [];

    for (const endpoint of keyEndpoints) {
      try {
        console.log(`🔍 Analyzing: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          const analysis: ResponseComparison = {
            endpoint,
            response: data,
            matchDataLength: data.matchData ? data.matchData.length : 0,
            competitionDataLength: data.competitionData ? data.competitionData.length : 0,
            uniqueFields: Object.keys(data),
            hasExtendedData: checkForExtendedData(data)
          };
          
          results.push(analysis);
          console.log(`✅ Analyzed: ${endpoint.split('?')[1]} - MatchData: ${analysis.matchDataLength} chars`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error analyzing ${endpoint}:`, error);
      }
    }

    setComparisons(results);
    setIsAnalyzing(false);
    
    // Log detailed comparison
    logDetailedComparison(results);
  };

  const checkForExtendedData = (data: any): boolean => {
    // Check for signs of extended odds data
    const dataStr = JSON.stringify(data).toLowerCase();
    
    // Look for BTTS/Over-Under indicators
    const indicators = ['btts', 'both', 'total', 'over', 'under', 'goal', 'score'];
    const hasIndicators = indicators.some(indicator => dataStr.includes(indicator));
    
    // Check for additional fields beyond basic structure
    const hasExtraFields = Object.keys(data).length > 10;
    
    // Check for longer matchData (might contain more odds)
    const hasLongMatchData = data.matchData && data.matchData.length > 5000;
    
    return hasIndicators || hasExtraFields || hasLongMatchData;
  };

  const logDetailedComparison = (results: ResponseComparison[]) => {
    console.log('\n🔍 DETAILED RESPONSE COMPARISON:');
    console.log('=====================================');
    
    // Group by response characteristics
    const byMatchDataLength = results.reduce((acc, result) => {
      const length = result.matchDataLength;
      if (!acc[length]) acc[length] = [];
      acc[length].push(result);
      return acc;
    }, {} as Record<number, ResponseComparison[]>);
    
    console.log('\n📊 Grouped by matchData length:');
    Object.entries(byMatchDataLength).forEach(([length, endpoints]) => {
      console.log(`\n📏 Length ${length} chars (${endpoints.length} endpoints):`);
      endpoints.forEach(endpoint => {
        const params = endpoint.endpoint.split('?')[1];
        console.log(`   • ${params}`);
      });
    });
    
    // Find unique responses
    const uniqueResponses = new Map<string, ResponseComparison>();
    results.forEach(result => {
      const key = `${result.matchDataLength}-${result.competitionDataLength}-${result.uniqueFields.length}`;
      if (!uniqueResponses.has(key)) {
        uniqueResponses.set(key, result);
      }
    });
    
    console.log(`\n🎯 Found ${uniqueResponses.size} unique response patterns:`);
    Array.from(uniqueResponses.values()).forEach((result, index) => {
      console.log(`\n📋 Pattern ${index + 1}:`);
      console.log(`   MatchData: ${result.matchDataLength} chars`);
      console.log(`   CompetitionData: ${result.competitionDataLength} chars`);
      console.log(`   Fields: ${result.uniqueFields.join(', ')}`);
      console.log(`   Example: ${result.endpoint.split('?')[1]}`);
      
      // Show sample of response data
      if (result.response.matchData) {
        const sampleMatch = result.response.matchData.split('|')[0];
        const fieldCount = sampleMatch ? sampleMatch.split(';').length : 0;
        console.log(`   Sample match fields: ${fieldCount}`);
        console.log(`   Sample: ${sampleMatch?.substring(0, 100)}...`);
      }
    });
  };

  const findBestEndpoint = (): ResponseComparison | null => {
    if (comparisons.length === 0) return null;
    
    // Find endpoint with most data
    return comparisons.reduce((best, current) => {
      const currentScore = current.matchDataLength + current.competitionDataLength + (current.hasExtendedData ? 1000 : 0);
      const bestScore = best.matchDataLength + best.competitionDataLength + (best.hasExtendedData ? 1000 : 0);
      
      return currentScore > bestScore ? current : best;
    });
  };

  const bestEndpoint = findBestEndpoint();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Database className="w-6 h-6 text-purple-600" />
        <h2 className="text-xl font-bold text-gray-800">Response Data Analyzer</h2>
      </div>

      <div className="space-y-4">
        <p className="text-gray-600">
          Compare API responses to find endpoints with extended odds data (BTTS, Over/Under).
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
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={analyzeResponses}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              isAnalyzing
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700 transform hover:scale-105 active:scale-95'
            }`}
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Analyze Responses
              </>
            )}
          </button>
        </div>

        {comparisons.length > 0 && (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{keyEndpoints.length}</div>
                <div className="text-sm text-purple-700">Endpoints Tested</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{comparisons.length}</div>
                <div className="text-sm text-green-700">Successful</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {new Set(comparisons.map(c => `${c.matchDataLength}-${c.competitionDataLength}`)).size}
                </div>
                <div className="text-sm text-blue-700">Unique Patterns</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {comparisons.filter(c => c.hasExtendedData).length}
                </div>
                <div className="text-sm text-yellow-700">With Extended Data</div>
              </div>
            </div>

            {/* Best Endpoint */}
            {bestEndpoint && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Best Endpoint Found:
                </h3>
                <div className="font-mono text-sm text-green-700 bg-white p-2 rounded border">
                  {bestEndpoint.endpoint}
                </div>
                <div className="mt-2 text-sm text-green-600">
                  MatchData: {bestEndpoint.matchDataLength} chars • 
                  CompetitionData: {bestEndpoint.competitionDataLength} chars • 
                  Fields: {bestEndpoint.uniqueFields.length}
                </div>
              </div>
            )}

            {/* Detailed Comparison Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Parameters</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">MatchData Size</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">CompetitionData Size</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Total Fields</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Extended</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {comparisons.map((comparison, index) => {
                    const params = comparison.endpoint.split('?')[1];
                    const isLargest = comparison.matchDataLength === Math.max(...comparisons.map(c => c.matchDataLength));
                    
                    return (
                      <tr key={index} className={isLargest ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-2 font-mono text-xs">
                          {params.length > 60 ? `${params.substring(0, 60)}...` : params}
                        </td>
                        <td className={`px-3 py-2 text-center font-medium ${isLargest ? 'text-yellow-800' : 'text-gray-700'}`}>
                          {comparison.matchDataLength.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">
                          {comparison.competitionDataLength.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">
                          {comparison.uniqueFields.length}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {comparison.hasExtendedData ? (
                            <span className="text-green-600 font-medium">✓</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => {
                              console.log(`\n🔍 DETAILED RESPONSE for: ${params}`);
                              console.log('📄 Full Response:', JSON.stringify(comparison.response, null, 2));
                              console.log('📊 Response Analysis:');
                              console.log(`   • MatchData length: ${comparison.matchDataLength}`);
                              console.log(`   • CompetitionData length: ${comparison.competitionDataLength}`);
                              console.log(`   • All fields: ${comparison.uniqueFields.join(', ')}`);
                              
                              if (comparison.response.matchData) {
                                const matches = comparison.response.matchData.split('|');
                                console.log(`   • Total matches: ${matches.length}`);
                                console.log(`   • First match: ${matches[0]}`);
                                console.log(`   • First match fields: ${matches[0]?.split(';').length}`);
                                
                                // Show field breakdown of first match
                                if (matches[0]) {
                                  const fields = matches[0].split(';');
                                  console.log('   • Field breakdown:');
                                  fields.forEach((field, i) => {
                                    console.log(`     ${i}: "${field}"`);
                                  });
                                }
                              }
                            }}
                            className="text-purple-600 hover:text-purple-800 text-xs"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Key Insights */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">🔍 Analysis Insights:</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>MatchData Sizes:</strong> {Array.from(new Set(comparisons.map(c => c.matchDataLength))).sort((a, b) => b - a).join(', ')} characters</p>
                <p>• <strong>Different Patterns:</strong> {new Set(comparisons.map(c => `${c.matchDataLength}-${c.competitionDataLength}`)).size} unique response patterns</p>
                <p>• <strong>Empty Responses:</strong> {comparisons.filter(c => c.matchDataLength === 0).length} endpoints return no match data</p>
                <p>• <strong>Largest Response:</strong> {Math.max(...comparisons.map(c => c.matchDataLength)).toLocaleString()} characters</p>
              </div>
            </div>

            {/* Response Pattern Analysis */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">📊 Response Patterns:</h3>
              <div className="space-y-2">
                {Array.from(new Set(comparisons.map(c => `${c.matchDataLength}-${c.competitionDataLength}`))).map(pattern => {
                  const [matchLen, compLen] = pattern.split('-').map(Number);
                  const endpointsWithPattern = comparisons.filter(c => 
                    c.matchDataLength === matchLen && c.competitionDataLength === compLen
                  );
                  
                  return (
                    <div key={pattern} className="bg-white p-3 rounded border">
                      <div className="font-medium text-gray-800">
                        Pattern: {matchLen.toLocaleString()} match chars, {compLen.toLocaleString()} competition chars
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {endpointsWithPattern.length} endpoint(s): {endpointsWithPattern.map(e => {
                          const params = e.endpoint.split('?')[1];
                          const keyParams = params.split('&').filter(p => 
                            p.includes('periodCode=') || p.includes('category=') || p.includes('inclusive=') || p.includes('competitionId=')
                          ).join('&');
                          return keyParams || 'default';
                        }).join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Compares {keyEndpoints.length} different parameter combinations</p>
          <p>• Analyzes response size and structure differences</p>
          <p>• Identifies patterns that might contain extended odds</p>
          <p>• Click the eye icon to see detailed response data in console</p>
        </div>
      </div>
    </div>
  );
};

export default ResponseAnalyzer;