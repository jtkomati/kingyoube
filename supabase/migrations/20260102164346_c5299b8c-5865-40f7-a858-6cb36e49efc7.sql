-- Create storage bucket for digital certificates (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-certificates', 'digital-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for digital certificates bucket
CREATE POLICY "Users can upload certificates for their organizations"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'digital-certificates' 
  AND (get_user_role_level(auth.uid()) >= 4)
);

CREATE POLICY "Users can view certificates from their organizations"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'digital-certificates'
  AND (get_user_role_level(auth.uid()) >= 3)
);

CREATE POLICY "ADMIN can update certificates"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'digital-certificates'
  AND (get_user_role_level(auth.uid()) >= 4)
);

CREATE POLICY "ADMIN can delete certificates"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'digital-certificates'
  AND (get_user_role_level(auth.uid()) >= 4)
);