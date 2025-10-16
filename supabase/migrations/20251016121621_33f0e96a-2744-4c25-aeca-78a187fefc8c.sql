-- Create pro_codes table for unlimited room access
CREATE TABLE IF NOT EXISTS public.pro_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  credits integer NOT NULL DEFAULT 10,
  max_rooms integer NOT NULL DEFAULT 5,
  rooms_created integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.pro_codes ENABLE ROW LEVEL SECURITY;

-- Allow all operations (can be restricted later)
CREATE POLICY "Allow all operations on pro_codes"
ON public.pro_codes
FOR ALL
USING (true)
WITH CHECK (true);

-- Add device_id to room_participants for device tracking
ALTER TABLE public.room_participants
ADD COLUMN IF NOT EXISTS device_id text;

-- Add device_id to join_requests for tracking
ALTER TABLE public.join_requests
ADD COLUMN IF NOT EXISTS device_id text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_room_participants_device_id ON public.room_participants(device_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_device_id ON public.join_requests(device_id);

-- Enable realtime for join_requests table
ALTER TABLE public.join_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;