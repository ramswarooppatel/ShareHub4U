-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.join_requests (
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
CREATE TABLE public.markdown_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid,
  content text,
  title text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT markdown_notes_pkey PRIMARY KEY (id),
  CONSTRAINT markdown_notes_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT markdown_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.pro_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  credits integer NOT NULL DEFAULT 10,
  max_rooms integer NOT NULL DEFAULT 5,
  rooms_created integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  created_by uuid,
  CONSTRAINT pro_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.room_files (
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
CREATE TABLE public.room_participants (
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
CREATE TABLE public.rooms (
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
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  username text UNIQUE CHECK (username IS NULL OR length(TRIM(BOTH FROM username)) > 0),
  passcode text CHECK (passcode IS NULL OR length(TRIM(BOTH FROM passcode)) > 0),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

SUPABASE STORAGE IS AT "room-files"