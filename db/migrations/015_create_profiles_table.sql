-- ✅ Create profiles table as the single source of truth for user data
-- This table replaces the users table and stores all user profile information
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'organizer', 'user')),
  full_name VARCHAR(255),
  name VARCHAR(255), -- Alias for full_name for compatibility
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(20),
  bank_account_name VARCHAR(150),
  bank_code VARCHAR(10),
  kyc_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see their own profile
CREATE POLICY "Users see own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- RLS Policy: Service role (backend) can manage all profiles
CREATE POLICY "Service role manages profiles" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policy: Users can update their own profile
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policy: Admins can see all profiles
CREATE POLICY "Admins see all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Migrate data from users table if it exists
INSERT INTO profiles (id, email, role, full_name, bank_name, bank_account_number, bank_account_name, bank_code, kyc_verified, created_at, updated_at)
SELECT id, email, role, full_name, bank_name, bank_account_number, bank_account_name, bank_code, kyc_verified, created_at, updated_at
FROM users
ON CONFLICT (id) DO NOTHING;
