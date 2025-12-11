-- Create waitlist_leads table for lead capture
CREATE TABLE public.waitlist_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  selected_plan TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.waitlist_leads ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public form)
CREATE POLICY "Anyone can insert waitlist leads"
ON public.waitlist_leads
FOR INSERT
WITH CHECK (true);

-- Only ADMIN+ can view leads
CREATE POLICY "ADMIN and above can view waitlist leads"
ON public.waitlist_leads
FOR SELECT
USING (get_user_role_level(auth.uid()) >= 4);