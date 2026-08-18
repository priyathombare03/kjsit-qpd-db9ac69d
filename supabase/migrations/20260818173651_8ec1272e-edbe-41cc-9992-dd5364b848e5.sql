CREATE TABLE public.papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  sets JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_set_index INTEGER,
  diagrams JSONB NOT NULL DEFAULT '{}'::jsonb,
  dqc_note TEXT,
  dqc_signature TEXT,
  created_by TEXT NOT NULL DEFAULT 'designer@somaiya.edu',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.papers TO anon, authenticated;
GRANT ALL ON public.papers TO service_role;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access to papers" ON public.papers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon, authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access to notifications" ON public.notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_papers_updated_at BEFORE UPDATE ON public.papers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();