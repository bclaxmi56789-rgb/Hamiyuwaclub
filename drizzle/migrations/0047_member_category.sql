-- Migration 0047: Add category column to club_members, members, bod_members
ALTER TABLE IF EXISTS public.club_members ADD COLUMN IF NOT EXISTS category text DEFAULT 'main';
ALTER TABLE IF EXISTS public.members ADD COLUMN IF NOT EXISTS category text DEFAULT 'main';
ALTER TABLE IF EXISTS public.bod_members ADD COLUMN IF NOT EXISTS category text DEFAULT 'main';
