-- Fix the search_path for the function I just created
DROP FUNCTION IF EXISTS update_markdown_updated_at() CASCADE;

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