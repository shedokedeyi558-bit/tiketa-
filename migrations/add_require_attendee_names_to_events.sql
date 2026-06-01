-- Migration: Add require_attendee_names column to events table
-- Run this in Supabase SQL editor

ALTER TABLE events
ADD COLUMN IF NOT EXISTS require_attendee_names BOOLEAN DEFAULT false;

COMMENT ON COLUMN events.require_attendee_names IS 'When true, checkout shows per-attendee name fields';
