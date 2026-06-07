-- Migration: Add bank detail columns to profiles table for withdrawal auto-fill
-- Run this in Supabase SQL editor

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name           TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_name        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_code           TEXT;

COMMENT ON COLUMN profiles.bank_name           IS 'Organizer saved bank name for auto-fill on next withdrawal';
COMMENT ON COLUMN profiles.bank_account_number IS 'Organizer saved bank account number for auto-fill';
COMMENT ON COLUMN profiles.account_name        IS 'Organizer saved account name for auto-fill';
COMMENT ON COLUMN profiles.bank_code           IS 'Squadco bank code (e.g. 000013) for auto-fill';
