-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM for roles (RBAC)
CREATE TYPE public.app_role AS ENUM ('SUPERADMIN', 'ADMIN', 'FINANCEIRO', 'FISCAL', 'VIEWER');

-- Create ENUM for person types
CREATE TYPE public.person_type AS ENUM ('PF', 'PJ');

-- Create ENUM for transaction types
CREATE TYPE public.transaction_type AS ENUM ('RECEIVABLE', 'PAYABLE');

-- Create profiles table (with phone number for WhatsApp integration)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone_number TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_type person_type NOT NULL,
  cpf TEXT,
  cnpj TEXT,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_pf_check CHECK (
    (person_type = 'PF' AND cpf IS NOT NULL AND first_name IS NOT NULL AND last_name IS NOT NULL) OR
    (person_type = 'PJ' AND cnpj IS NOT NULL AND company_name IS NOT NULL)
  )
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default categories
INSERT INTO public.categories (name, description) VALUES
  ('Serviços', 'Prestação de serviços'),
  ('Produtos', 'Venda de produtos'),
  ('Consultoria', 'Serviços de consultoria'),
  ('Fornecedores', 'Pagamentos a fornecedores'),
  ('Salários', 'Folha de pagamento'),
  ('Impostos', 'Pagamentos de impostos'),
  ('Outros', 'Outras transações');

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type transaction_type NOT NULL,
  gross_amount DECIMAL(15,2) NOT NULL CHECK (gross_amount > 0),
  discount_amount DECIMAL(15,2) DEFAULT 0 CHECK (discount_amount >= 0 AND discount_amount <= gross_amount),
  net_amount DECIMAL(15,2) NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id),
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.customers(id),
  description TEXT,
  is_recurring BOOLEAN DEFAULT false,
  installment INTEGER DEFAULT 1,
  total_installments INTEGER DEFAULT 1,
  due_date DATE NOT NULL,
  payment_date DATE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transaction_customer_or_supplier CHECK (
    (customer_id IS NOT NULL AND supplier_id IS NULL) OR
    (customer_id IS NULL AND supplier_id IS NOT NULL)
  ),
  CONSTRAINT transaction_recurring_check CHECK (
    (is_recurring = false) OR 
    (is_recurring = true AND installment IS NOT NULL AND total_installments IS NOT NULL)
  )
);

-- Create transaction_taxes table
CREATE TABLE public.transaction_taxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tax_name TEXT NOT NULL,
  tax_amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  user_role app_role NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone_number)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.raw_user_meta_data->>'phone_number'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Security definer function to get user role level
CREATE OR REPLACE FUNCTION public.get_user_role_level(_user_id UUID)
RETURNS INTEGER AS $$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'SUPERADMIN') THEN 5
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'ADMIN') THEN 4
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'FINANCEIRO') THEN 3
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'FISCAL') THEN 2
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'VIEWER') THEN 1
    ELSE 0
  END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "SUPERADMIN can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'SUPERADMIN'));

CREATE POLICY "ADMIN can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for customers
CREATE POLICY "All authenticated users can view customers" ON public.customers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "FINANCEIRO and above can create customers" ON public.customers
  FOR INSERT WITH CHECK (public.get_user_role_level(auth.uid()) >= 3);

CREATE POLICY "FINANCEIRO and above can update customers" ON public.customers
  FOR UPDATE USING (public.get_user_role_level(auth.uid()) >= 3);

-- RLS Policies for categories
CREATE POLICY "All authenticated users can view categories" ON public.categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for transactions
CREATE POLICY "All authenticated users can view transactions" ON public.transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "FINANCEIRO and above can create transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    public.get_user_role_level(auth.uid()) >= 3 AND
    auth.uid() = created_by
  );

CREATE POLICY "FINANCEIRO and above can update transactions" ON public.transactions
  FOR UPDATE USING (public.get_user_role_level(auth.uid()) >= 3);

-- RLS Policies for transaction_taxes
CREATE POLICY "All authenticated users can view transaction taxes" ON public.transaction_taxes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can create transaction taxes" ON public.transaction_taxes
  FOR INSERT WITH CHECK (true);

-- RLS Policies for audit_logs
CREATE POLICY "ADMIN and above can view all audit logs" ON public.audit_logs
  FOR SELECT USING (public.get_user_role_level(auth.uid()) >= 4);

CREATE POLICY "System can create audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);