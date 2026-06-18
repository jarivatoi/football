export interface MatchData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoff: string;
  date?: string;
  status: 'upcoming' | 'live' | 'finished';
  homeOdds: number | string;
  drawOdds: number | string;
  awayOdds: number | string;
  overUnder: {
    over: number | string;
    under: number | string;
    line: number;
  };
  bothTeamsScore: {
    yes: number | string;
    no: number | string;
  };
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  competitionId?: string; // Add competitionId field
  marketCount?: number; // Add market count field
  availableMarkets?: string[]; // Add available markets field
}

export interface PriceButtonProps {
  odds: number | string;
  onClick: () => void;
  type: 'home' | 'draw' | 'away' | 'over' | 'under' | 'yes' | 'no';
  disabled?: boolean;
  selected?: boolean;
}