-- Global #1 counts only. No visitor profiles, addresses, or character ages.
CREATE TABLE IF NOT EXISTS open_runs (
  run_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS counted_runs (
  run_id TEXT PRIMARY KEY,
  heroine_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS heroine_wins (
  heroine_id TEXT PRIMARY KEY,
  wins INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_buckets (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
