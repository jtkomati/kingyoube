-- Fix Storage Bucket Tenant Isolation
-- This migration updates RLS policies to enforce company_id isolation

-- =====================================================
-- DROP existing policies that lack tenant isolation
-- =====================================================

-- invoices-xml bucket
DROP POLICY IF EXISTS "FISCAL and above can view invoice XML" ON storage.objects;
DROP POLICY IF EXISTS "FISCAL and above can upload invoice XML" ON storage.objects;
DROP POLICY IF EXISTS "FISCAL and above can update invoice XML" ON storage.objects;
DROP POLICY IF EXISTS "FISCAL and above can delete invoice XML" ON storage.objects;

-- invoices-pdf bucket
DROP POLICY IF EXISTS "FISCAL and above can view invoice PDF" ON storage.objects;
DROP POLICY IF EXISTS "FISCAL and above can upload invoice PDF" ON storage.objects;
DROP POLICY IF EXISTS "FISCAL and above can update invoice PDF" ON storage.objects;
DROP POLICY IF EXISTS "FISCAL and above can delete invoice PDF" ON storage.objects;

-- contracts bucket
DROP POLICY IF EXISTS "FINANCEIRO can view contracts" ON storage.objects;
DROP POLICY IF EXISTS "FINANCEIRO can upload contracts" ON storage.objects;
DROP POLICY IF EXISTS "FINANCEIRO can update contracts" ON storage.objects;
DROP POLICY IF EXISTS "FINANCEIRO can delete contracts" ON storage.objects;

-- bank-certificates bucket
DROP POLICY IF EXISTS "ADMIN can view bank certificates" ON storage.objects;
DROP POLICY IF EXISTS "ADMIN can upload bank certificates" ON storage.objects;
DROP POLICY IF EXISTS "ADMIN can update bank certificates" ON storage.objects;
DROP POLICY IF EXISTS "ADMIN can delete bank certificates" ON storage.objects;

-- =====================================================
-- CREATE new policies with tenant isolation
-- Files must be stored as: {bucket}/{company_id}/{filename}
-- =====================================================

-- invoices-xml bucket - SELECT
CREATE POLICY "Users can view company invoice XML"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices-xml'
  AND get_user_role_level(auth.uid()) >= 2
  AND (
    (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
    OR get_user_role_level(auth.uid()) >= 5
  )
);

-- invoices-xml bucket - INSERT
CREATE POLICY "Users can upload company invoice XML"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices-xml'
  AND get_user_role_level(auth.uid()) >= 2
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- invoices-xml bucket - UPDATE
CREATE POLICY "Users can update company invoice XML"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'invoices-xml'
  AND get_user_role_level(auth.uid()) >= 2
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- invoices-xml bucket - DELETE
CREATE POLICY "Users can delete company invoice XML"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoices-xml'
  AND get_user_role_level(auth.uid()) >= 3
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- invoices-pdf bucket - SELECT
CREATE POLICY "Users can view company invoice PDF"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices-pdf'
  AND get_user_role_level(auth.uid()) >= 2
  AND (
    (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
    OR get_user_role_level(auth.uid()) >= 5
  )
);

-- invoices-pdf bucket - INSERT
CREATE POLICY "Users can upload company invoice PDF"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices-pdf'
  AND get_user_role_level(auth.uid()) >= 2
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- invoices-pdf bucket - UPDATE
CREATE POLICY "Users can update company invoice PDF"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'invoices-pdf'
  AND get_user_role_level(auth.uid()) >= 2
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- invoices-pdf bucket - DELETE
CREATE POLICY "Users can delete company invoice PDF"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoices-pdf'
  AND get_user_role_level(auth.uid()) >= 3
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- contracts bucket - SELECT
CREATE POLICY "Users can view company contracts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts'
  AND get_user_role_level(auth.uid()) >= 3
  AND (
    (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
    OR get_user_role_level(auth.uid()) >= 5
  )
);

-- contracts bucket - INSERT
CREATE POLICY "Users can upload company contracts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contracts'
  AND get_user_role_level(auth.uid()) >= 3
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- contracts bucket - UPDATE
CREATE POLICY "Users can update company contracts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'contracts'
  AND get_user_role_level(auth.uid()) >= 3
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- contracts bucket - DELETE
CREATE POLICY "Users can delete company contracts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contracts'
  AND get_user_role_level(auth.uid()) >= 4
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- bank-certificates bucket - SELECT
CREATE POLICY "Users can view company bank certificates"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'bank-certificates'
  AND get_user_role_level(auth.uid()) >= 4
  AND (
    (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
    OR get_user_role_level(auth.uid()) >= 5
  )
);

-- bank-certificates bucket - INSERT
CREATE POLICY "Users can upload company bank certificates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bank-certificates'
  AND get_user_role_level(auth.uid()) >= 4
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- bank-certificates bucket - UPDATE
CREATE POLICY "Users can update company bank certificates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'bank-certificates'
  AND get_user_role_level(auth.uid()) >= 4
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);

-- bank-certificates bucket - DELETE
CREATE POLICY "Users can delete company bank certificates"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'bank-certificates'
  AND get_user_role_level(auth.uid()) >= 4
  AND (storage.foldername(name))[1] = get_user_company_id(auth.uid())::text
);