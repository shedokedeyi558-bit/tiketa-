-- Migration: Add ticket_type_id column to transactions table
-- Date: 2026-05-29
-- Purpose: Track which ticket type was purchased in each transaction

-- Add ticket_type_id column to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS ticket_type_id UUID;

-- Add comment to explain the column
COMMENT ON COLUMN transactions.ticket_type_id IS 'References the ticket type that was purchased';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_ticket_type_id 
ON transactions(ticket_type_id);

-- Note: Foreign key constraint is not added because ticket types are stored 
-- as JSONB in the events table, not in a separate ticket_types table
-- If you later create a ticket_types table, add this constraint:
-- ALTER TABLE transactions 
-- ADD CONSTRAINT fk_ticket_type 
-- FOREIGN KEY (ticket_type_id) 
-- REFERENCES ticket_types(id) 
-- ON DELETE SET NULL;
