CREATE TABLE public.infectious_disease (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  region_code INTEGER NOT NULL,
  region_name TEXT NOT NULL,
  outpatient_patients NUMERIC NOT NULL DEFAULT 0,
  inpatient_patients NUMERIC NOT NULL DEFAULT 0,
  total_patients NUMERIC NOT NULL DEFAULT 0
);

GRANT SELECT ON public.infectious_disease TO anon;
GRANT SELECT ON public.infectious_disease TO authenticated;
GRANT ALL ON public.infectious_disease TO service_role;

ALTER TABLE public.infectious_disease ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read infectious disease data"
  ON public.infectious_disease FOR SELECT
  USING (true);

CREATE INDEX idx_infectious_disease_date ON public.infectious_disease (date);
CREATE INDEX idx_infectious_disease_region_code ON public.infectious_disease (region_code);
CREATE INDEX idx_infectious_disease_region_name ON public.infectious_disease (region_name);
CREATE INDEX idx_infectious_disease_year_month ON public.infectious_disease (year, month);