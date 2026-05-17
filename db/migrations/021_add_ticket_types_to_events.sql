-- Add ticket_types JSONB column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_types JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN events.ticket_types IS 'Array of ticket types with structure: [{"name": "VIP", "price": 5000}, {"name": "Regular", "price": 2000}]';
