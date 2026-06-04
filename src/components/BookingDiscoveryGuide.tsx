import React, { useState } from 'react';
import { Search, Globe, Code, AlertCircle, CheckCircle, Copy } from 'lucide-react';

const BookingDiscoveryGuide: React.FC = () => {
  const [discoveredEndpoint, setDiscoveredEndpoint] = useState('');
  const [bookingParams, setBookingParams] = useState('');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Search className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">How to Get Real Booking Reference from Totelepep</h2>
      </div>

      <div className="space-y-6">
        {/* Step-by-step guide */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-3">🔍 Step-by-Step Discovery Process:</h3>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <h4 className="font-medium text-blue-800">Open Totelepep Website</h4>
                <p className="text-blue-700 text-sm">Go to www.totelepep.mu in your browser</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <h4 className="font-medium text-blue-800">Open Developer Tools</h4>
                <p className="text-blue-700 text-sm">Press F12 or right-click → Inspect → Network tab</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <h4 className="font-medium text-blue-800">Clear Network Log</h4>
                <p className="text-blue-700 text-sm">Click the clear button (🚫) in Network tab</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
              <div>
                <h4 className="font-medium text-blue-800">Add Selection to Betting Slip</h4>
                <p className="text-blue-700 text-sm">Click on any odds to add to your betting slip</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">5</div>
              <div>
                <h4 className="font-medium text-blue-800">Enter Stake Amount</h4>
                <p className="text-blue-700 text-sm">Enter minimum stake (usually MUR 50)</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">6</div>
              <div>
                <h4 className="font-medium text-green-800">Click "Place Bet" or "Book Bet"</h4>
                <p className="text-green-700 text-sm">This will generate the booking without requiring login</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">7</div>
              <div>
                <h4 className="font-medium text-green-800">Watch Network Tab</h4>
                <p className="text-green-700 text-sm">Look for POST requests that appear when you click the button</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">8</div>
              <div>
                <h4 className="font-medium text-green-800">Examine the Response</h4>
                <p className="text-green-700 text-sm">Click on the POST request and check the Response tab for booking number</p>
              </div>
            </div>
          </div>
        </div>

        {/* What to look for */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-3">👀 What to Look For in Network Tab:</h3>
          
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-medium text-yellow-800">📡 Request Details:</h4>
              <ul className="text-yellow-700 ml-4 space-y-1">
                <li>• <strong>Method:</strong> POST</li>
                <li>• <strong>URL:</strong> Something like /webapi/PlaceBet, /PreBet, /CreateBooking</li>
                <li>• <strong>Status:</strong> 200 (success) or 201 (created)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-yellow-800">📋 Request Payload:</h4>
              <ul className="text-yellow-700 ml-4 space-y-1">
                <li>• Match ID, Selection ID, Odds, Stake</li>
                <li>• Competition ID, Market Book Number</li>
                <li>• User session or temporary ID</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-yellow-800">📄 Response Data:</h4>
              <ul className="text-yellow-700 ml-4 space-y-1">
                <li>• <strong>Booking Number:</strong> "BK123456789" or similar</li>
                <li>• <strong>Reference:</strong> "REF987654321" or similar</li>
                <li>• <strong>Expiry Time:</strong> How long the booking is valid</li>
                <li>• <strong>Potential Payout:</strong> Calculated winnings</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Example response */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-800 mb-3">📋 Expected Response Format:</h3>
          
          <pre className="bg-white p-3 rounded border text-sm overflow-x-auto">
{`{
  "success": true,
  "bookingNumber": "BK123456789",
  "reference": "REF987654321",
  "ticketId": "TKT456789123",
  "stake": 50.00,
  "potentialPayout": 227.50,
  "odds": 4.55,
  "expiresAt": "2025-01-27T19:00:00Z",
  "status": "booked",
  "selections": [
    {
      "matchId": "227369",
      "selection": "Draw",
      "odds": 4.55
    }
  ]
}`}
          </pre>
        </div>

        {/* Input fields for discovered data */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">📝 Record Your Findings:</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discovered Endpoint URL:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={discoveredEndpoint}
                  onChange={(e) => setDiscoveredEndpoint(e.target.value)}
                  placeholder="/api/webapi/PlaceBet or /api/webapi/CreateBooking"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  onClick={() => copyToClipboard(discoveredEndpoint)}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Request Parameters (JSON):
              </label>
              <div className="flex gap-2">
                <textarea
                  value={bookingParams}
                  onChange={(e) => setBookingParams(e.target.value)}
                  placeholder='{"matchId": "227369", "selectionId": "23989994", "odds": "4.55", "stake": "50"}'
                  rows={3}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                />
                <button
                  onClick={() => copyToClipboard(bookingParams)}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Implementation code */}
        {discoveredEndpoint && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-800 mb-3">🔧 Implementation Code:</h3>
            
            <pre className="bg-white p-3 rounded border text-sm overflow-x-auto">
{`// Add this to your ParlayBuilder component
const generateBookingNumber = async () => {
  try {
    const response = await fetch('${discoveredEndpoint}', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(${bookingParams || '{\n        // Your booking parameters here\n      }'})
    });
    
    const data = await response.json();
    
    if (data.success && data.bookingNumber) {
      console.log('Booking Number:', data.bookingNumber);
      alert(\`Booking created: \${data.bookingNumber}\`);
    }
  } catch (error) {
    console.error('Booking failed:', error);
  }
};`}
            </pre>
          </div>
        )}

        {/* Alternative automated discovery */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-3">🤖 Alternative: Use the Bet Placement Analyzer</h3>
          <p className="text-red-700 text-sm mb-3">
            If manual discovery is difficult, you can use our automated analyzer to test potential endpoints.
          </p>
          <p className="text-red-600 text-sm">
            Click "Show Bet Placement Analyzer" in the main app and run the endpoint discovery tool.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BookingDiscoveryGuide;