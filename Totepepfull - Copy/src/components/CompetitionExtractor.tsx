import React, { useState } from 'react';
import { Database, Download, Eye, Copy, Search } from 'lucide-react';

interface Competition {
  id: string;
  name: string;
  matchCount: number;
}

const CompetitionExtractor: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [rawData, setRawData] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const extractAllCompetitions = async () => {
    setIsExtracting(true);
    setCompetitions([]);
    setRawData('');

    try {
      console.log('🔍 Fetching all competitions from Totelepep...');
      
      // Get data for multiple dates to capture all competitions
      const dates = [];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }

      const allCompetitions = new Map<string, Competition>();

      for (const date of dates) {
        console.log(`📅 Fetching competitions for ${date}...`);
        
        const endpoint = `/api/webapi/GetSport?sportId=soccer&date=${date}&category=&competitionId=0&pageNo=500&inclusive=1&matchid=0&periodCode=all`;
        
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          // Extract competitions from competitionData
          if (data.competitionData) {
            console.log(`📊 Raw competitionData for ${date}:`, data.competitionData);
            setRawData(prev => prev + `\n=== ${date} ===\n${data.competitionData}\n`);
            
            const competitions = parseCompetitionData(data.competitionData);
            competitions.forEach(comp => {
              if (!allCompetitions.has(comp.id)) {
                allCompetitions.set(comp.id, comp);
              } else {
                // Update match count
                const existing = allCompetitions.get(comp.id)!;
                existing.matchCount += comp.matchCount;
              }
            });
          }

          // Also extract from matchData to get competition IDs
          if (data.matchData) {
            const matchCompetitions = extractCompetitionsFromMatches(data.matchData);
            matchCompetitions.forEach(comp => {
              if (!allCompetitions.has(comp.id)) {
                allCompetitions.set(comp.id, { ...comp, name: `Competition ${comp.id}` });
              }
            });
          }
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const sortedCompetitions = Array.from(allCompetitions.values())
        .sort((a, b) => parseInt(a.id) - parseInt(b.id));

      setCompetitions(sortedCompetitions);
      console.log(`✅ Extracted ${sortedCompetitions.length} unique competitions`);

    } catch (error) {
      console.error('❌ Error extracting competitions:', error);
    } finally {
      setIsExtracting(false);
    }
  };

  const parseCompetitionData = (competitionData: string): Competition[] => {
    const competitions: Competition[] = [];
    
    try {
      // Split by pipe (|) to get individual competitions
      const competitionEntries = competitionData.split('|').filter(entry => entry.trim());
      
      competitionEntries.forEach((entry, index) => {
        // Split by semicolon (;) to get fields
        const fields = entry.split(';');
        
        console.log(`Competition ${index}: Fields:`, fields);
        
        // Try to identify ID and name fields
        // Usually: ID is first field, name is second or third field
        if (fields.length >= 2) {
          const id = fields[0]?.trim();
          const name = fields[1]?.trim() || fields[2]?.trim() || `Competition ${id}`;
          
          if (id && name && !isNaN(parseInt(id))) {
            competitions.push({
              id,
              name,
              matchCount: 1
            });
          }
        }
      });
      
    } catch (error) {
      console.error('Error parsing competition data:', error);
    }
    
    return competitions;
  };

  const extractCompetitionsFromMatches = (matchData: string): Competition[] => {
    const competitions = new Map<string, number>();
    
    try {
      const matches = matchData.split('|').filter(match => match.trim());
      
      matches.forEach(match => {
        const fields = match.split(';');
        // Competition ID is typically in field 1 (index 1)
        const competitionId = fields[1]?.trim();
        
        if (competitionId && !isNaN(parseInt(competitionId))) {
          competitions.set(competitionId, (competitions.get(competitionId) || 0) + 1);
        }
      });
      
    } catch (error) {
      console.error('Error extracting competitions from matches:', error);
    }
    
    return Array.from(competitions.entries()).map(([id, count]) => ({
      id,
      name: `Competition ${id}`,
      matchCount: count
    }));
  };

  const generateMappingCode = () => {
    const mappingEntries = competitions
      .filter(comp => comp.name !== `Competition ${comp.id}`)
      .map(comp => `  '${comp.id}': '${comp.name}',`)
      .join('\n');

    return `// Competition ID to League Name mapping
const competitionMapping: Record<string, string> = {
${mappingEntries}
};`;
  };

  const copyMappingCode = () => {
    navigator.clipboard.writeText(generateMappingCode());
  };

  const filteredCompetitions = competitions.filter(comp =>
    comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    comp.id.includes(searchTerm)
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Database className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">Competition Names Extractor</h2>
      </div>

      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">🎯 Purpose:</h3>
          <p className="text-blue-700 text-sm">
            Extract all competition names directly from Totelepep's API to create accurate league name mappings.
          </p>
        </div>

        <button
          onClick={extractAllCompetitions}
          disabled={isExtracting}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
            isExtracting
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 transform hover:scale-105 active:scale-95'
          }`}
        >
          {isExtracting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Extracting Competitions...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Extract All Competitions
            </>
          )}
        </button>

        {competitions.length > 0 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">
                ✅ Found {competitions.length} Competitions
              </h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={copyMappingCode}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  <Copy className="w-4 h-4" />
                  Copy Mapping Code
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search competitions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>

            {/* Competition List */}
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">ID</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">League Name</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">Matches</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCompetitions.map((comp) => (
                    <tr key={comp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-gray-800">{comp.id}</td>
                      <td className="px-4 py-2 text-gray-800">{comp.name}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{comp.matchCount}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          comp.name.startsWith('Competition ') 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {comp.name.startsWith('Competition ') ? 'Fallback' : 'API'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Generated Mapping Code */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800">Generated Mapping Code:</h3>
                <button
                  onClick={copyMappingCode}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <pre className="text-xs text-gray-600 overflow-x-auto bg-white p-3 rounded border max-h-40">
                {generateMappingCode()}
              </pre>
            </div>

            {/* Raw Competition Data */}
            {rawData && (
              <details className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-yellow-800 mb-2">
                  <Eye className="w-4 h-4 inline mr-2" />
                  View Raw Competition Data from API
                </summary>
                <pre className="text-xs text-yellow-700 overflow-x-auto bg-white p-3 rounded border max-h-60">
                  {rawData}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Fetches competition data from Totelepep API for next 7 days</p>
          <p>• Parses competitionData field to extract ID → name mappings</p>
          <p>• Generates TypeScript mapping code you can copy and use</p>
          <p>• Shows which names come from API vs fallback mapping</p>
        </div>
      </div>
    </div>
  );
};

export default CompetitionExtractor;