-- Create platform_settings table for storing global platform configuration
CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  platform_name TEXT DEFAULT 'Ticketa',
  support_email TEXT DEFAULT 'support@ticketa.com',
  platform_fee NUMERIC DEFAULT 3,
  minimum_withdrawal NUMERIC DEFAULT 10000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one row exists (id = 1)
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for platform_settings
-- Allow public read access (settings are public)
CREATE POLICY "Public read platform settings" ON platform_settings
  FOR SELECT USING (true);

-- Allow only admins to update settings
CREATE POLICY "Admin update platform settings" ON platform_settings
  FOR UPDATE USING (auth.role() = 'service_role');

-- Enable RLS on platform_settings table
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
