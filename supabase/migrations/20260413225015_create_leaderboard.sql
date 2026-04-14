/*
  # Create leaderboard table

  1. New Tables
    - `leaderboard`
      - `id` (uuid, primary key) - unique identifier for each entry
      - `player_name` (text) - display name of the player
      - `score` (bigint) - final score achieved
      - `survival_seconds` (integer) - how long the player survived
      - `max_combo` (integer) - highest combo achieved in the session
      - `perfect_count` (integer) - number of perfect deflects
      - `good_count` (integer) - number of good deflects
      - `scrape_count` (integer) - number of scrape deflects
      - `miss_count` (integer) - number of missed threats
      - `created_at` (timestamptz) - when the score was submitted

  2. Security
    - Enable RLS on `leaderboard` table
    - Add policy for anyone to read leaderboard entries (public game, no auth required)
    - Add policy for anyone to insert their own scores (public game)

  3. Indexes
    - Index on `score` for fast leaderboard sorting

  4. Notes
    - This is a public arcade game with no authentication
    - RLS allows public read and insert only, no update or delete
*/

CREATE TABLE IF NOT EXISTS leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL DEFAULT '',
  score bigint NOT NULL DEFAULT 0,
  survival_seconds integer NOT NULL DEFAULT 0,
  max_combo integer NOT NULL DEFAULT 0,
  perfect_count integer NOT NULL DEFAULT 0,
  good_count integer NOT NULL DEFAULT 0,
  scrape_count integer NOT NULL DEFAULT 0,
  miss_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view leaderboard"
  ON leaderboard
  FOR SELECT
  TO anon
  USING (score > 0);

CREATE POLICY "Anyone can submit scores"
  ON leaderboard
  FOR INSERT
  TO anon
  WITH CHECK (
    char_length(player_name) > 0
    AND char_length(player_name) <= 20
    AND score >= 0
  );

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard (score DESC);
