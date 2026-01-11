-- Migration number: 0001 	 2026-01-11T18:59:30.134Z

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  theme TEXT,
  sentiment TEXT,
  urgency TEXT,
  summary TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Seed mock data
INSERT INTO feedback (message) VALUES
  ('The checkout process is way too slow. I waited 30 seconds for the page to load and almost gave up. This is unacceptable for a modern e-commerce site.'),
  ('Love the new dashboard design! It is much cleaner and easier to navigate. The dark mode option is a nice touch.'),
  ('I cannot figure out how to export my data. The help docs mention a button that does not exist. Very frustrating experience.');
