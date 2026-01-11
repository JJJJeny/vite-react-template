-- Migration number: 0002 	 2026-01-11
-- Add source field for feedback channel tracking

ALTER TABLE feedback ADD COLUMN source TEXT DEFAULT 'email';

-- Update existing seed data with different sources
UPDATE feedback SET source = 'email' WHERE id = 1;
UPDATE feedback SET source = 'twitter' WHERE id = 2;
UPDATE feedback SET source = 'reddit' WHERE id = 3;

-- Add more diverse mock data
INSERT INTO feedback (message, source) VALUES
  ('Your mobile app crashes every time I try to upload a photo. Happening on iOS 18. Please fix ASAP!', 'twitter'),
  ('Just wanted to say the customer support team was amazing. Sarah helped me resolve my issue in minutes!', 'email'),
  ('The pricing page is confusing. I cannot tell the difference between Pro and Enterprise tiers.', 'reddit'),
  ('Integration with Slack stopped working after the last update. Our whole team is affected.', 'email'),
  ('Finally a product that just works! Switched from competitor and never looking back.', 'reddit');
