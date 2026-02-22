-- ShareHub4U Database Schema
-- This file contains the complete database schema for the ShareHub4U project
-- Generated from Supabase migrations

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  username text UNIQUE CHECK (username IS NULL OR length(TRIM(BOTH FROM username)) > 0),
  passcode text CHECK (passcode IS NULL OR length(TRIM(BOTH FROM passcode)) > 0),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Create rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_code text NOT NULL UNIQUE,
  room_type text NOT NULL DEFAULT 'public'::text CHECK (room_type = ANY (ARRAY['public'::text, 'private'::text, 'locked'::text, 'private_key'::text])),
  host_id uuid,
  allow_anonymous boolean DEFAULT true,
  auto_accept_requests boolean DEFAULT false,
  only_host_can_upload boolean DEFAULT false,
  file_sharing_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  is_permanent boolean DEFAULT false,
  pro_code_used boolean DEFAULT false,
  room_password text,
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.users(id)
);

-- Create room_participants table
CREATE TABLE IF NOT EXISTS public.room_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid,
  user_id uuid,
  anonymous_name text,
  role text NOT NULL DEFAULT 'member'::text CHECK (role = ANY (ARRAY['host'::text, 'member'::text])),
  joined_at timestamp with time zone DEFAULT now(),
  device_id text,
  CONSTRAINT room_participants_pkey PRIMARY KEY (id),
  CONSTRAINT room_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT room_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- Create room_files table
CREATE TABLE IF NOT EXISTS public.room_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  file_url text NOT NULL,
  file_path text NOT NULL,
  uploaded_by uuid,
  is_viewable boolean DEFAULT false,
  uploaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT room_files_pkey PRIMARY KEY (id),
  CONSTRAINT room_files_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT room_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);

-- Create join_requests table
CREATE TABLE IF NOT EXISTS public.join_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid,
  user_id uuid,
  anonymous_name text,
  message text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])),
  responded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  device_id text,
  CONSTRAINT join_requests_pkey PRIMARY KEY (id),
  CONSTRAINT join_requests_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT join_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- Create markdown_notes table
CREATE TABLE IF NOT EXISTS public.markdown_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  content TEXT,
  title TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create pro_codes table
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

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markdown_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies (simplified for open source - adjust as needed)
-- Users policies
CREATE POLICY "Users can read their own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own data" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Rooms policies
CREATE POLICY "Anyone can read public rooms" ON public.rooms FOR SELECT USING (room_type = 'public');
CREATE POLICY "Hosts can manage their rooms" ON public.rooms FOR ALL USING (auth.uid() = host_id);

-- Room participants policies
CREATE POLICY "Room participants can read participants in their rooms" ON public.room_participants FOR SELECT USING (
  room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
);

-- Room files policies
CREATE POLICY "Room participants can read files in their rooms" ON public.room_files FOR SELECT USING (
  room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
);
CREATE POLICY "Room participants can upload files if allowed" ON public.room_files FOR INSERT WITH CHECK (
  room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid()) AND
  (NOT (SELECT only_host_can_upload FROM public.rooms WHERE id = room_id) OR
   (SELECT host_id FROM public.rooms WHERE id = room_id) = auth.uid())
);

-- Join requests policies
CREATE POLICY "Hosts can manage join requests for their rooms" ON public.join_requests FOR ALL USING (
  room_id IN (SELECT id FROM public.rooms WHERE host_id = auth.uid())
);

-- Markdown notes policies
CREATE POLICY "Allow all operations on markdown_notes" ON public.markdown_notes FOR ALL USING (true) WITH CHECK (true);

-- Pro codes policies
CREATE POLICY "Allow all operations on pro_codes" ON public.pro_codes FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_room_participants_device_id ON public.room_participants(device_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_device_id ON public.join_requests(device_id);

-- Triggers
CREATE OR REPLACE FUNCTION update_markdown_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_markdown_notes_updated_at
BEFORE UPDATE ON public.markdown_notes
FOR EACH ROW
EXECUTE FUNCTION update_markdown_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.markdown_notes;
ALTER TABLE public.join_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;

-- Supabase Storage bucket
-- Note: Create a storage bucket named 'room-files' in Supabase dashboard