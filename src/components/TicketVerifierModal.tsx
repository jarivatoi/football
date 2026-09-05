import React, { useState } from 'react';
import { X, Search, Ticket, Loader2 } from 'lucide-react';

interface TicketBet {
  betRef: string;
  betTime: string;
  competitionName: string;
  marketCode: string;
  marketLine: string | null;
  periodCode: string | null;
  optionName: string;
  optionOdd: string;
  legStatus: string | null;
}

interface TicketTransaction {
  bookingDate: string;
  bookingRef: string;
  proxyRef: string | null;
  amount: string;
  status: string;
  betPrice: string | null;
  potentialPayout: string;
  cashBackAmount: string | null;
  errorMessage: string | null;
  irn: string | null;
  qrCode: string | null;
  bets: TicketBet[];
}

interface TicketVerifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiBaseUrl: string;
}

const TicketVerifierModal: React.FC<TicketVerifierModalProps> = ({ isOpen, onClose, apiBaseUrl }) => {
  const [ticketNumber, setTicketNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<TicketTransaction | null>(null);

  if (!isOpen) return null;

  // Supabase Edge Function CORS proxy URL (for production)
  const SUPABASE_PROXY = 'https://zaleugflzamrkrfkrcsa.supabase.co/functions/v1/cors-proxy?url=';

  // Check if running locally (dev server) or in production
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Get target domain from API source base URL
  const getTargetDomain = () => {
    try {
      const url = new URL(apiBaseUrl);
      return url.origin; // e.g., https://www.totelepep.mu
    } catch {
      return 'https://www.totelepep.mu';
    }
  };

  // Determine Vite proxy prefix based on API source domain (for local dev)
  const getProxyPrefix = () => {
    try {
      const url = new URL(apiBaseUrl);
      const domain = url.hostname;
      if (domain.includes('totelepep')) return '/api/tp';
      if (domain.includes('stevenhills')) return '/api/sh';
      if (domain.includes('superscore')) return '/api/sc';
      if (domain.includes('valueplus')) return '/api/vp';
      return '/api'; // fallback to totelepep
    } catch {
      return '/api';
    }
  };

  const handleSubmit = async () => {
    if (!ticketNumber.trim()) {
      setError('Please enter a ticket number');
      return;
    }

    setLoading(true);
    setError(null);
    setTransaction(null);

    try {
      const ticketParam = encodeURIComponent(ticketNumber.trim());
      const domain = getTargetDomain();
      const targetUrl = `${domain}/WebApi/GetTicketStatus`;
      
      let response: Response;
      
      if (isLocalDev) {
        // Local dev: Use Vite proxy
        const proxyPrefix = getProxyPrefix();
        const devProxyUrl = `${proxyPrefix}/WebApi/GetTicketStatus`;
        
        console.log('[TicketVerifier] Using Vite dev proxy:', devProxyUrl);
        response = await fetch(devProxyUrl, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': '*/*',
          },
          body: `TicketNumber=${ticketParam}`
        });
      } else {
        // Production: Use Supabase Edge Function CORS proxy
        const proxyUrl = `${SUPABASE_PROXY}${encodeURIComponent(targetUrl)}`;
        
        console.log('[TicketVerifier] Using Supabase CORS proxy:', proxyUrl);
        response = await fetch(proxyUrl, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': '*/*',
          },
          body: `TicketNumber=${ticketParam}`
        });
      }
      
      console.log('[TicketVerifier] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[TicketVerifier] Success:', data);
        
        if (data.isSuccess && data.transaction) {
          setTransaction(data.transaction);
          return;
        } else if (data.isSuccess === false) {
          setError('Ticket not found or invalid');
          return;
        }
      }
      
      // Server returned error
      const errorText = await response.text().catch(() => '');
      console.log('[TicketVerifier] Error response:', errorText.substring(0, 500));
      throw new Error('Ticket verification failed. The server returned an error. Please try again or check the ticket number.');
    } catch (err) {
      console.error('[TicketVerifier] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTicketNumber('');
    setError(null);
    setTransaction(null);
    onClose();
  };

  const formatBookingDate = (dateStr: string) => {
    if (!dateStr) return '';
    // Format: "2026-09-05-02-04" -> "Sat 05-Sep-2026 02:04"
    const parts = dateStr.split('-');
    if (parts.length >= 5) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // 0-indexed
      const day = parseInt(parts[2]);
      const hour = parts[3];
      const minute = parts[4];
      const date = new Date(year, month, day);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dayOfWeek = days[date.getDay()];
      const monthName = months[date.getMonth()];
      const dayStr = day.toString().padStart(2, '0');
      return `${dayOfWeek} ${dayStr}-${monthName}-${year} ${hour}:${minute}`;
    }
    return dateStr;
  };

  const formatBetTime = (timeStr: string) => {
    if (!timeStr) return '';
    // Format: "2026-09-05-03-00" -> "05 Sep 2026 - 03:00"
    const parts = timeStr.split('-');
    if (parts.length >= 5) {
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = date.getDate().toString().padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year} - ${parts[3]}:${parts[4]}`;
    }
    return timeStr;
  };

  const parseCompetitionName = (name: string) => {
    // Format: " - England - Premier League - Team A v Team B - UND"
    const parts = name.split(' - ').filter(p => p.trim());
    if (parts.length >= 3) {
      const country = parts[0];
      const league = parts[1];
      const match = parts[2];
      return { country, league, match };
    }
    return { country: '', league: '', match: name };
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'WON': return 'bg-green-100 text-green-800 border-green-300';
      case 'LOST': return 'bg-red-100 text-red-800 border-red-300';
      case 'UNDECIDED': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getLegStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'WON': return 'bg-green-100 text-green-700';
      case 'LOST': return 'bg-red-100 text-red-700';
      case 'PENDING': return 'bg-blue-100 text-blue-700';
      case 'CANCELLED': return 'bg-gray-100 text-gray-700';
      case 'VOID': return 'bg-orange-100 text-orange-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Ticket Verifier</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Search Input */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Enter ticket number (e.g., AC3-5943324)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                Submit
              </button>
            </div>
            {error && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Transaction Details */}
          {transaction && (
            <div className="p-4">
              {/* Ticket Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600">Booking Reference</div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(transaction.status)}`}>
                    {transaction.status}
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">{transaction.bookingRef}</div>
                <div className="text-sm text-gray-600">
                  Booked: {formatBookingDate(transaction.bookingDate)}
                </div>
                {transaction.potentialPayout && transaction.potentialPayout !== 'NA' && (
                  <div className="text-sm text-gray-600 mt-1">
                    Potential Payout: <span className="font-semibold text-green-700">{transaction.potentialPayout}</span>
                  </div>
                )}
              </div>

              {/* Bets List */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-gray-700 mb-2">
                  {transaction.bets.length} {transaction.bets.length === 1 ? 'Selection' : 'Selections'}
                </div>
                {transaction.bets.map((bet, index) => {
                  const { country, league, match } = parseCompetitionName(bet.competitionName);
                  const legStatus = bet.legStatus || 'PENDING';
                  const statusColor = getLegStatusColor(legStatus);
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Bet Header */}
                      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                        <div className="text-xs text-gray-500">
                          {formatBetTime(bet.betTime)}
                        </div>
                      </div>
                      
                      {/* Bet Details */}
                      <div className="p-3">
                        <div className="text-xs text-gray-500 mb-1">
                          {country && <span>{country} • </span>}
                          {league && <span>{league}</span>}
                        </div>
                        <div className="text-sm font-semibold text-gray-900 mb-2">
                          {match}
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm text-gray-700">
                            Selection: <span className="font-semibold">{bet.optionName}</span> <span className="font-bold text-blue-600">@{bet.optionOdd}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusColor}`}>
                            {legStatus}
                          </span>
                          <div className="text-xs font-semibold text-blue-600">
                            {bet.marketCode}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketVerifierModal;
