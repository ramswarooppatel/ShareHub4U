-- Create room_presence table for server-assisted nearby discovery
CREATE TABLE IF NOT EXISTS public.room_presence (
  room_code text NOT NULL,
  public_ip text NOT NULL,
  display_name text,
  meta jsonb DEFAULT '{}'::jsonb,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_code, public_ip)
);

-- Index on last_seen for fast cleanup/queries
CREATE INDEX IF NOT EXISTS idx_room_presence_last_seen ON public.room_presence (last_seen);
