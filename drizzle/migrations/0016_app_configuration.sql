-- Migration 0016: App Configuration (Entity profile & AI settings with OpenRouter & Gemini)

CREATE TABLE IF NOT EXISTS public.app_configuration (
  id text PRIMARY KEY DEFAULT 'default',
  owner_id uuid NOT NULL,
  entity_name text NOT NULL DEFAULT 'हामी युवा क्लब',
  entity_sub_name text DEFAULT 'HAMI YUWA CLUB',
  tagline text DEFAULT 'फोहोरमैला व्यवस्थापन तथा सामाजिक सेवा',
  address text DEFAULT 'वीरेन्द्रनगर, सुर्खेत, कर्णाली प्रदेश',
  pan_vat text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  logo_url text DEFAULT '',
  ai_provider text DEFAULT 'gemini',
  gemini_api_key text DEFAULT '',
  gemini_model text DEFAULT 'gemini-2.0-flash',
  openrouter_api_key text DEFAULT '',
  openrouter_model text DEFAULT 'google/gemini-2.0-flash-exp:free',
  openai_api_key text DEFAULT '',
  openai_model text DEFAULT 'gpt-4o-mini',
  custom_ai_endpoint text DEFAULT '',
  custom_ai_key text DEFAULT '',
  custom_ai_model text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT app_config_owner_unique UNIQUE (owner_id)
);

ALTER TABLE public.app_configuration ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_configuration' AND policyname = 'app_configuration_select_authenticated') THEN
    CREATE POLICY app_configuration_select_authenticated ON public.app_configuration FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_configuration' AND policyname = 'app_configuration_all_owner') THEN
    CREATE POLICY app_configuration_all_owner ON public.app_configuration FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
