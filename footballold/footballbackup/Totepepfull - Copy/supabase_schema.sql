-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league TEXT NOT NULL,
  date DATE NOT NULL,
  kickoff TEXT NOT NULL,
  status TEXT CHECK (status IN ('upcoming', 'live', 'finished')) NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  minute INTEGER,
  competition_id TEXT NOT NULL,
  market_book_no TEXT,
  market_code TEXT,
  home_odds NUMERIC,
  draw_odds NUMERIC,
  away_odds NUMERIC,
  over_25_odds NUMERIC,
  under_25_odds NUMERIC,
  btts_yes_odds NUMERIC,
  btts_no_odds NUMERIC,
  market_count INTEGER,
  available_markets TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
CREATE INDEX IF NOT EXISTS idx_matches_competition ON matches(competition_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_updated_at ON matches(updated_at);

-- Enable Row Level Security (RLS)
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access for all users
CREATE POLICY "Allow read access for all users" ON matches
  FOR SELECT USING (true);

-- Create policy to allow insert access for all users
CREATE POLICY "Allow insert access for all users" ON matches
  FOR INSERT WITH CHECK (true);

-- Create policy to allow update access for all users
CREATE POLICY "Allow update access for all users" ON matches
  FOR UPDATE USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON TABLE matches TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE matches TO authenticated;

-- Enable real-time subscriptions
BEGIN;
  -- remove the realtime publication
  DROP PUBLICATION IF EXISTS supabase_realtime;

  -- re-create the publication but don't enable it for any tables
  CREATE PUBLICATION supabase_realtime;
COMMIT;

-- Add the matches table to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE matches;