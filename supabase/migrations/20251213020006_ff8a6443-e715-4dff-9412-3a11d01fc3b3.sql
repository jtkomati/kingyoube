-- Add new role values to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'CONTADOR';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'USUARIO';