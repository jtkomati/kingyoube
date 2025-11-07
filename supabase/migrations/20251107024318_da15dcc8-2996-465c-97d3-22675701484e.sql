-- Adicionar política para usuários verem transações da sua empresa
CREATE POLICY "Users can view company transactions"
ON transactions
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);