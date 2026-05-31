-- Migration: Add attendees, buyer_phone, quantity columns to transactions table
-- Run this in Supabase SQL editor before deploying the backend changes

-- Add attendees column (JSONB array of { name, email, phone })
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb;

-- Add buyer_phone column
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS buyer_phone TEXT;

-- Add quantity column (number of tickets in this row)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- ticket_type_id already added in previous migration, but ensure it exists
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS ticket_type_id TEXT;

COMMENT ON COLUMN transactions.attendees IS 'Array of attendee objects { name, email, phone }';
COMMENT ON COLUMN transactions.buyer_phone IS 'Phone number of the primary buyer';
COMMENT ON COLUMN transactions.quantity IS 'Number of tickets purchased for this ticket type';
COMMENT ON COLUMN transactions.ticket_type_id IS 'ID of the ticket type purchased (from cartItems)';
