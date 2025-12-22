-- ============================================
-- FASE 1: SEGURANÇA CRÍTICA - KingYouBe
-- ============================================

-- 1.1 Criar tabela de referência para secrets do Vault
CREATE TABLE IF NOT EXISTS public.secret_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    secret_type TEXT NOT NULL,
    vault_secret_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(entity_type, entity_id, secret_type)
);

-- RLS para secret_references (apenas SUPERADMIN)
ALTER TABLE public.secret_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only SUPERADMIN can view secret references"
ON public.secret_references FOR SELECT
USING (get_user_role_level(auth.uid()) >= 5);

CREATE POLICY "Only SUPERADMIN can manage secret references"
ON public.secret_references FOR ALL
USING (get_user_role_level(auth.uid()) >= 5);

-- 1.2 Função segura para armazenar secrets no Vault
CREATE OR REPLACE FUNCTION public.store_secret(
    p_entity_type TEXT,
    p_entity_id UUID,
    p_secret_type TEXT,
    p_secret_value TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vault_id UUID;
    v_existing_vault_id UUID;
BEGIN
    -- Verificar se já existe uma referência
    SELECT vault_secret_id INTO v_existing_vault_id
    FROM public.secret_references
    WHERE entity_type = p_entity_type
      AND entity_id = p_entity_id
      AND secret_type = p_secret_type;
    
    -- Se existir, deletar o secret antigo do vault
    IF v_existing_vault_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = v_existing_vault_id;
    END IF;
    
    -- Inserir novo secret no vault
    INSERT INTO vault.secrets (secret, name, description)
    VALUES (
        p_secret_value,
        p_entity_type || '_' || p_secret_type || '_' || p_entity_id,
        'Auto-stored secret for ' || p_entity_type
    )
    RETURNING id INTO v_vault_id;
    
    -- Registrar/atualizar referência
    INSERT INTO public.secret_references (entity_type, entity_id, secret_type, vault_secret_id)
    VALUES (p_entity_type, p_entity_id, p_secret_type, v_vault_id)
    ON CONFLICT (entity_type, entity_id, secret_type) 
    DO UPDATE SET 
        vault_secret_id = v_vault_id,
        updated_at = now();
    
    RETURN v_vault_id;
END;
$$;

-- 1.3 Função segura para recuperar secrets do Vault
CREATE OR REPLACE FUNCTION public.get_secret(
    p_entity_type TEXT,
    p_entity_id UUID,
    p_secret_type TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_secret TEXT;
BEGIN
    SELECT vs.decrypted_secret INTO v_secret
    FROM public.secret_references sr
    JOIN vault.decrypted_secrets vs ON vs.id = sr.vault_secret_id
    WHERE sr.entity_type = p_entity_type
      AND sr.entity_id = p_entity_id
      AND sr.secret_type = p_secret_type;
    
    RETURN v_secret;
END;
$$;

-- 1.4 Função para deletar secrets do Vault
CREATE OR REPLACE FUNCTION public.delete_secret(
    p_entity_type TEXT,
    p_entity_id UUID,
    p_secret_type TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vault_id UUID;
BEGIN
    SELECT vault_secret_id INTO v_vault_id
    FROM public.secret_references
    WHERE entity_type = p_entity_type
      AND entity_id = p_entity_id
      AND secret_type = p_secret_type;
    
    IF v_vault_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Deletar do vault
    DELETE FROM vault.secrets WHERE id = v_vault_id;
    
    -- Deletar referência
    DELETE FROM public.secret_references
    WHERE entity_type = p_entity_type
      AND entity_id = p_entity_id
      AND secret_type = p_secret_type;
    
    RETURN TRUE;
END;
$$;

-- ============================================
-- 2. TENANT ISOLATION PARA contract_clauses
-- ============================================

-- 2.1 Adicionar company_id
ALTER TABLE public.contract_clauses
ADD COLUMN IF NOT EXISTS company_id UUID;

-- 2.2 Migrar dados existentes baseado no contract
UPDATE public.contract_clauses cc
SET company_id = c.company_id
FROM public.contracts c
WHERE cc.contract_id = c.id
AND cc.company_id IS NULL;

-- 2.3 Adicionar FK constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_contract_clauses_company'
    ) THEN
        ALTER TABLE public.contract_clauses
        ADD CONSTRAINT fk_contract_clauses_company
        FOREIGN KEY (company_id) REFERENCES public.company_settings(id);
    END IF;
END $$;

-- 2.4 Dropar policies antigas inseguras
DROP POLICY IF EXISTS "All authenticated users can view contract clauses" ON public.contract_clauses;
DROP POLICY IF EXISTS "System can manage contract clauses" ON public.contract_clauses;
DROP POLICY IF EXISTS "Authenticated users can manage contract clauses" ON public.contract_clauses;

-- 2.5 Criar novas RLS policies org-scoped
CREATE POLICY "Users can view org contract clauses"
ON public.contract_clauses FOR SELECT
USING (
    company_id = ANY(get_user_organization_ids(auth.uid()))
    OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "FINANCEIRO can insert org contract clauses"
ON public.contract_clauses FOR INSERT
WITH CHECK (
    (get_user_role_level(auth.uid()) >= 3 
     AND company_id = ANY(get_user_organization_ids(auth.uid())))
    OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "FINANCEIRO can update org contract clauses"
ON public.contract_clauses FOR UPDATE
USING (
    (get_user_role_level(auth.uid()) >= 3 
     AND company_id = ANY(get_user_organization_ids(auth.uid())))
    OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "FINANCEIRO can delete org contract clauses"
ON public.contract_clauses FOR DELETE
USING (
    (get_user_role_level(auth.uid()) >= 3 
     AND company_id = ANY(get_user_organization_ids(auth.uid())))
    OR get_user_role_level(auth.uid()) >= 5
);

-- 2.6 Trigger para auto-popular company_id de contract_clauses
CREATE OR REPLACE FUNCTION public.set_contract_clause_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.company_id IS NULL THEN
        SELECT company_id INTO NEW.company_id
        FROM public.contracts
        WHERE id = NEW.contract_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_contract_clause_company_id ON public.contract_clauses;
CREATE TRIGGER trg_set_contract_clause_company_id
BEFORE INSERT ON public.contract_clauses
FOR EACH ROW
EXECUTE FUNCTION public.set_contract_clause_company_id();

-- ============================================
-- 3. TENANT-AWARENESS PARA categories
-- ============================================

-- 3.1 Adicionar company_id nullable (NULL = categoria global)
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS company_id UUID;

-- 3.2 Adicionar FK constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_categories_company'
    ) THEN
        ALTER TABLE public.categories
        ADD CONSTRAINT fk_categories_company
        FOREIGN KEY (company_id) REFERENCES public.company_settings(id);
    END IF;
END $$;

-- 3.3 Dropar policies antigas
DROP POLICY IF EXISTS "All authenticated users can view categories" ON public.categories;

-- 3.4 Novas policies - usuarios podem ver globais + suas org
CREATE POLICY "Users can view global and org categories"
ON public.categories FOR SELECT
USING (
    company_id IS NULL
    OR company_id = ANY(get_user_organization_ids(auth.uid()))
    OR get_user_role_level(auth.uid()) >= 5
);

-- 3.5 Permitir criar categorias personalizadas por org
CREATE POLICY "FINANCEIRO can create org categories"
ON public.categories FOR INSERT
WITH CHECK (
    (get_user_role_level(auth.uid()) >= 3 
     AND (company_id IS NULL OR company_id = ANY(get_user_organization_ids(auth.uid()))))
    OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "FINANCEIRO can update org categories"
ON public.categories FOR UPDATE
USING (
    (get_user_role_level(auth.uid()) >= 3 
     AND company_id = ANY(get_user_organization_ids(auth.uid())))
    OR get_user_role_level(auth.uid()) >= 5
);

CREATE POLICY "FINANCEIRO can delete org categories"
ON public.categories FOR DELETE
USING (
    (get_user_role_level(auth.uid()) >= 3 
     AND company_id IS NOT NULL
     AND company_id = ANY(get_user_organization_ids(auth.uid())))
    OR get_user_role_level(auth.uid()) >= 5
);

-- ============================================
-- 4. ÍNDICE PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_secret_references_lookup 
ON public.secret_references(entity_type, entity_id, secret_type);

CREATE INDEX IF NOT EXISTS idx_contract_clauses_company_id 
ON public.contract_clauses(company_id);

CREATE INDEX IF NOT EXISTS idx_categories_company_id 
ON public.categories(company_id);