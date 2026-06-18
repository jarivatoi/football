import React, { useState } from 'react';
import { Ticket, Send, Search, AlertCircle, CheckCircle, Eye, Code } from 'lucide-react';

interface BetEndpointResult {
  endpoint: string;
  method: string;
  status: 'testing' | 'success' | 'error' | 'auth-required';
  response?: any;
  error?: string;
  requiresAuth?: boolean;
  ticketFound?: boolean;
  ticketNumber?: string;
}

const BetPlacementAnalyzer: React.FC = () => {
  const [results, setResults] = useState<BetEndpointResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [testBetData, setTestBetData] = useState({
    matchId: '227369',
    competitionId: '126',
    marketBookNo: '76713',
    selectionId: '23989994', // Draw selection from Everton vs Mansfield
    odds: '4.55',
    stake: '50'
  });

  // Potential Totelepep betting endpoints based on common patterns
  const potentialBetEndpoints = [
    // Main bet placement endpoints
    { endpoint: '/api/webapi/PlaceBet', method: 'POST' },
    { endpoint: '/api/webapi/SubmitBet', method: 'POST' },
    { endpoint: '/api/webapi/CreateBet', method: 'POST' },
    { endpoint: '/api/webapi/AddBet', method: 'POST' },
    { endpoint: '/api/webapi/ProcessBet', method: 'POST' },
    
    // Betting slip endpoints
    { endpoint: '/api/webapi/AddToSlip', method: 'POST' },
    { endpoint: '/api/webapi/UpdateSlip', method: 'POST' },
    { endpoint: '/api/webapi/SubmitSlip', method: 'POST' },
    { endpoint: '/api/webapi/PlaceSlip', method: 'POST' },
    
    // Ticket endpoints
    { endpoint: '/api/webapi/CreateTicket', method: 'POST' },
    { endpoint: '/api/webapi/GenerateTicket', method: 'POST' },
    { endpoint: '/api/webapi/GetTicket', method: 'GET' },
    { endpoint: '/api/webapi/TicketStatus', method: 'GET' },
    
    // User/Account endpoints (might handle betting)
    { endpoint: '/api/webapi/UserBet', method: 'POST' },
    { endpoint: '/api/webapi/AccountBet', method: 'POST' },
    { endpoint: '/api/webapi/MemberBet', method: 'POST' },
    
    // Alternative naming patterns
    { endpoint: '/api/bet/place', method: 'POST' },
    { endpoint: '/api/betting/submit', method: 'POST' },
    { endpoint: '/api/slip/add', method: 'POST' },
    { endpoint: '/api/ticket/create', method: 'POST' },
    
    // Mobile/App endpoints
    { endpoint: '/api/mobile/PlaceBet', method: 'POST' },
    { endpoint: '/api/app/SubmitBet', method: 'POST' },
    
    // JSON endpoints
    { endpoint: '/api/json/PlaceBet', method: 'POST' },
    { endpoint: '/api/json/CreateTicket', method: 'POST' },
  ];

  const testBetEndpoint = async (endpointInfo: { endpoint: string; method: string }): Promise<BetEndpointResult> => {
    const { endpoint, method } = endpointInfo;
    console.log(`🎯 Testing bet endpoint: ${method} ${endpoint}`);
    
    try {
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US,en;q=0.5',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      };

      // Add body for POST requests
      if (method === 'POST') {
        requestOptions.body = JSON.stringify({
          // Totelepep-specific parameters (based on your match data)
          matchId: testBetData.matchId,
          competitionId: testBetData.competitionId,
          marketBookNo: testBetData.marketBookNo,
          selectionId: testBetData.selectionId,
          odds: testBetData.odds,
          stake: testBetData.stake,
          
          // Alternative parameter names that might be required
          match_id: testBetData.matchId,
          competition_id: testBetData.competitionId,
          market_book_no: testBetData.marketBookNo,
          selection_id: testBetData.selectionId,
          amount: testBetData.stake,
          betAmount: testBetData.stake,
          stakeAmount: testBetData.stake,
          
          // Totelepep-specific parameters that might be missing
          betType: 'single',
          betTypeId: 1,
          currency: 'MUR',
          source: 'web',
          platform: 'desktop',
          
          // Additional parameters that might be required
          userId: 0, // For guest/pre-bet
          sessionId: '',
          deviceId: '',
          clientId: '',
          
          // Multi-bet parameters (even for single bets)
          multiEnabled: 0,
          multiStake: testBetData.stake,
          
          // Potential required fields based on response structure
          rebateAmount: 0,
          bonusAmount: 0,
          taxAmount: 0
        });
      }

      const response = await fetch(endpoint, requestOptions);
      
      console.log(`📡 ${method} ${endpoint} - Status: ${response.status}`);

      if (response.status === 401 || response.status === 403) {
        return {
          endpoint,
          method,
          status: 'auth-required',
          requiresAuth: true,
          error: 'Authentication required'
        };
      }

      if (!response.ok) {
        return {
          endpoint,
          method,
          status: 'error',
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      console.log(`✅ Success for ${method} ${endpoint}:`, data);

      // Analyze response for ticket information
      const analysis = analyzeBetResponse(data);
      
      return {
        endpoint,
        method,
        status: 'success',
        response: data,
        ticketFound: analysis.ticketFound,
        ticketNumber: analysis.ticketNumber
      };

    } catch (error) {
      console.error(`❌ Error for ${method} ${endpoint}:`, error);
      return {
        endpoint,
        method,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const analyzeBetResponse = (data: any): { ticketFound: boolean; ticketNumber?: string } => {
    console.log('📄 Full bet response:', JSON.stringify(data, null, 2));
    
    // Handle Totelepep-specific response format
    if (data.errorMessage) {
      console.log(`⚠️ Totelepep Error: ${data.errorMessage}`);
      
      // Check if we got a partial response with some data
      if (data.ticketNo && data.ticketNo !== "") {
        console.log(`🎫 Ticket found despite error: ${data.ticketNo}`);
        return { ticketFound: true, ticketNumber: data.ticketNo };
      }
      
      // Log all response fields for analysis
      console.log('📊 Response analysis:');
      console.log(`   multiErrorCode: ${data.multiErrorCode}`);
      console.log(`   multiEnabled: ${data.multiEnabled}`);
      console.log(`   betList length: ${data.betList?.length || 0}`);
      console.log(`   balanceAmount: ${data.balanceAmount}`);
      
      return { ticketFound: false };
    }
    
    // Success case - look for ticket number
    if (data.ticketNo && data.ticketNo !== "") {
      console.log(`✅ Ticket number found: ${data.ticketNo}`);
      return { ticketFound: true, ticketNumber: data.ticketNo };
    }
    
    return { ticketFound: false };
  };

  const analyzeBetEndpoints = async () => {
    setIsAnalyzing(true);
    setResults([]);

    console.log('🎯 Starting Totelepep bet placement endpoint analysis...');
    console.log('📋 Test bet data:', testBetData);

    // Initialize results
    const initialResults = potentialBetEndpoints.map(({ endpoint, method }) => ({
      endpoint,
      method,
      status: 'testing' as const
    }));
    setResults(initialResults);

    // Test each endpoint
    for (let i = 0; i < potentialBetEndpoints.length; i++) {
      const endpointInfo = potentialBetEndpoints[i];
      
      try {
        const result = await testBetEndpoint(endpointInfo);
        
        setResults(prev => prev.map(r => 
          r.endpoint === endpointInfo.endpoint && r.method === endpointInfo.method ? {
            ...result,
            // Add Totelepep-specific error analysis
            totelepepError: result.response?.errorMessage,
            hasPartialData: !!(result.response?.multiEnabled !== undefined)
          } : r
        ));
        
        // Add delay between requests
        if (i < potentialBetEndpoints.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
      } catch (error) {
        setResults(prev => prev.map(r => 
          r.endpoint === endpointInfo.endpoint && r.method === endpointInfo.method ? {
            ...r,
            status: 'error',
            error: 'Request failed'
          } : r
        ));
      }
    }

    setIsAnalyzing(false);
    console.log('🎯 Bet endpoint analysis complete!');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'testing':
        return <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'auth-required':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
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
      case 'auth-required':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const authRequiredResults = results.filter(r => r.status === 'auth-required');
  const successResults = results.filter(r => r.status === 'success');
  const ticketResults = results.filter(r => r.ticketFound);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Ticket className="w-6 h-6 text-green-600" />
        <h2 className="text-xl font-bold text-gray-800">Totelepep Bet Placement & Ticket Analysis</h2>
      </div>

      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-800 mb-2">🎯 Objective:</h3>
          <p className="text-green-700 text-sm">
            Discover Totelepep's pre-bet endpoints to get real booking numbers (no authentication required).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Match ID:
            </label>
            <input
              type="text"
              value={testBetData.matchId}
              onChange={(e) => setTestBetData(prev => ({ ...prev, matchId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              placeholder="227369"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Competition ID:
            </label>
            <input
              type="text"
              value={testBetData.competitionId}
              onChange={(e) => setTestBetData(prev => ({ ...prev, competitionId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              placeholder="126"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Market BookNo:
            </label>
            <input
              type="text"
              value={testBetData.marketBookNo}
              onChange={(e) => setTestBetData(prev => ({ ...prev, marketBookNo: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              placeholder="76713"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selection ID:
            </label>
            <input
              type="text"
              value={testBetData.selectionId}
              onChange={(e) => setTestBetData(prev => ({ ...prev, selectionId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              placeholder="23989994"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Odds:
            </label>
            <input
              type="text"
              value={testBetData.odds}
              onChange={(e) => setTestBetData(prev => ({ ...prev, odds: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              placeholder="4.55"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stake (MUR):
            </label>
            <input
              type="text"
              value={testBetData.stake}
              onChange={(e) => setTestBetData(prev => ({ ...prev, stake: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              placeholder="50"
            />
          </div>
        </div>

        <button
          onClick={analyzeBetEndpoints}
          disabled={isAnalyzing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            isAnalyzing
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 transform hover:scale-105 active:scale-95'
          }`}
        >
          {isAnalyzing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Analyzing Bet Endpoints...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Discover Bet Placement Endpoints
            </>
          )}
        </button>

        {results.length > 0 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{potentialBetEndpoints.length}</div>
                <div className="text-sm text-blue-700">Endpoints Tested</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{authRequiredResults.length}</div>
                <div className="text-sm text-yellow-700">Auth Required</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{successResults.length}</div>
                <div className="text-sm text-green-700">Successful</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{ticketResults.length}</div>
                <div className="text-sm text-purple-700">Tickets Found</div>
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
                      <div className="font-mono text-sm text-gray-800">
                        <span className="font-bold">{result.method}</span> {result.endpoint}
                      </div>
                      
                      {result.ticketFound && result.ticketNumber && (
                        <div className="mt-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          🎫 Ticket: {result.ticketNumber}
                        </div>
                      )}
                      
                      {result.requiresAuth && (
                        <div className="mt-1 text-sm text-yellow-600">
                          🔐 Requires authentication - this is likely the real bet endpoint!
                        </div>
                      )}
                      
                      {result.error && (
                        <div className="mt-1 text-sm text-red-600">
                          {result.error}
                        </div>
                      )}
                      
                      {result.totelepepError && (
                        <div className="mt-2 bg-yellow-100 text-yellow-800 px-3 py-2 rounded text-sm">
                          <strong>Totelepep Error:</strong> {result.totelepepError}
                          {result.hasPartialData && (
                            <div className="mt-1 text-xs">
                              ✅ Got Totelepep response format - endpoint is correct!
                            </div>
                          )}
                        </div>
                      )}
                      
                      {result.status === 'success' && result.response && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-green-600 hover:text-green-800">
                            <Eye className="w-3 h-3 inline mr-1" />
                            View Response Data
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto max-h-40">
                            {JSON.stringify(result.response, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Authentication Required Summary */}
            {authRequiredResults.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">
                  🔐 Authentication Required Endpoints (Likely Real Bet APIs):
                </h3>
                <ul className="space-y-1">
                  {authRequiredResults.map((result, index) => (
                    <li key={index} className="text-sm text-yellow-700">
                      <strong>{result.method} {result.endpoint}</strong>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-yellow-600 mt-2">
                  These endpoints require user authentication, indicating they're likely the real betting APIs.
                </p>
              </div>
            )}

            {/* Ticket Found Summary */}
            {ticketResults.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">
                  🎫 Ticket Numbers Found:
                </h3>
                <ul className="space-y-1">
                  {ticketResults.map((result, index) => (
                    <li key={index} className="text-sm text-green-700">
                      <strong>{result.method} {result.endpoint}:</strong> {result.ticketNumber}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Implementation Guide */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">📋 Next Steps for Real Bet Placement:</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>1. Authentication:</strong> You'll need to implement Totelepep login to access bet placement APIs</p>
            <p><strong>2. Session Management:</strong> Maintain user session cookies/tokens for authenticated requests</p>
            <p><strong>3. Bet Validation:</strong> Validate selections and stakes before submission</p>
            <p><strong>4. Error Handling:</strong> Handle insufficient funds, invalid selections, etc.</p>
            <p><strong>5. Ticket Retrieval:</strong> Parse response to extract real ticket numbers</p>
          </div>
        </div>

        {/* Browser Network Tab Instructions */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="font-semibold text-purple-800 mb-2">🔍 Manual Discovery Method:</h3>
          <div className="text-sm text-purple-700 space-y-2">
            <p><strong>1.</strong> Open Totelepep website in browser</p>
            <p><strong>2.</strong> Open Developer Tools (F12) → Network tab</p>
            <p><strong>3.</strong> Add selections to betting slip (no login required)</p>
            <p><strong>4.</strong> Click "Place Bet" or "Generate Booking" button</p>
            <p><strong>5.</strong> Look for POST requests in Network tab during booking generation</p>
            <p><strong>6.</strong> Copy the exact endpoint URL and parameters</p>
            <p><strong>7.</strong> Look for booking number in the response JSON</p>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Tests {potentialBetEndpoints.length} potential bet placement endpoints</p>
          <p>• Uses realistic bet data from extracted match information</p>
          <p>• Analyzes responses for ticket numbers and betting confirmation</p>
          <p>• Identifies authentication requirements for real bet placement</p>
        </div>
      </div>
    </div>
  );
};

export default BetPlacementAnalyzer;