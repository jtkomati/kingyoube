-- Create incoming_invoices table to store incoming invoice data
CREATE TABLE IF NOT EXISTS public.incoming_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- File information
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'xml' or 'pdf'
  
  -- Supplier information
  supplier_cnpj TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  
  -- Invoice details
  invoice_number TEXT,
  invoice_date DATE,
  service_code TEXT,
  
  -- Financial information
  gross_amount NUMERIC NOT NULL,
  
  -- Tax withholdings
  irrf_amount NUMERIC DEFAULT 0,
  pis_amount NUMERIC DEFAULT 0,
  cofins_amount NUMERIC DEFAULT 0,
  csll_amount NUMERIC DEFAULT 0,
  iss_amount NUMERIC DEFAULT 0,
  inss_amount NUMERIC DEFAULT 0,
  
  -- Calculated net amount
  net_amount NUMERIC NOT NULL,
  
  -- OCR/Processing status
  processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
  ocr_data JSONB,
  
  -- CNAB generation
  cnab_generated BOOLEAN DEFAULT false,
  cnab_generated_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.incoming_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All authenticated users can view incoming invoices"
  ON public.incoming_invoices
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "FINANCEIRO and above can create incoming invoices"
  ON public.incoming_invoices
  FOR INSERT
  WITH CHECK (get_user_role_level(auth.uid()) >= 3 AND auth.uid() = created_by);

CREATE POLICY "FINANCEIRO and above can update incoming invoices"
  ON public.incoming_invoices
  FOR UPDATE
  USING (get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "ADMIN and above can delete incoming invoices"
  ON public.incoming_invoices
  FOR DELETE
  USING (get_user_role_level(auth.uid()) >= 4);

-- Create trigger for updated_at
CREATE TRIGGER update_incoming_invoices_updated_at
  BEFORE UPDATE ON public.incoming_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_incoming_invoices_created_by ON public.incoming_invoices(created_by);
CREATE INDEX idx_incoming_invoices_supplier_cnpj ON public.incoming_invoices(supplier_cnpj);
CREATE INDEX idx_incoming_invoices_processing_status ON public.incoming_invoices(processing_status);