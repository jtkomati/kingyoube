-- Atualizar política para permitir que usuários vejam suas próprias notas fiscais
DROP POLICY IF EXISTS "Users can view their company incoming invoices" ON incoming_invoices;

CREATE POLICY "Users can view their incoming invoices"
ON incoming_invoices FOR SELECT
USING (
  auth.uid() = created_by OR 
  (company_id IS NOT NULL AND company_id = get_user_company_id(auth.uid())) OR 
  get_user_role_level(auth.uid()) >= 4
);