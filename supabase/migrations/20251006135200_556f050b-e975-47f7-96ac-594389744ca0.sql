-- Add markdown_notes table for collaborative markdown sharing
CREATE TABLE IF NOT EXISTS public.markdown_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  content TEXT,
  title TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.markdown_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read markdown notes in a room
CREATE POLICY "Allow all operations on markdown_notes"
ON public.markdown_notes
FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_markdown_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_markdown_notes_updated_at
BEFORE UPDATE ON public.markdown_notes
FOR EACH ROW
EXECUTE FUNCTION update_markdown_updated_at();

-- Add room_password column for private key rooms
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS room_password TEXT;

-- Enable realtime for markdown_notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.markdown_notes;