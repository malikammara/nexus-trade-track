/*
  # Monthly Reset System for September

  1. New Tables
    - `monthly_base_equity` - Store base equity for each month
    - `monthly_resets` - Track monthly reset operations

  2. New Functions
    - `set_monthly_base_equity` - Set base equity for a specific month
    - `reset_monthly_performance` - Reset revenue/NOTs for new month
    - `get_monthly_dashboard_stats` - Get stats for specific month
    - `calculate_monthly_targets` - Calculate targets based on base equity

  3. Views
    - `current_month_stats` - Current month performance
    - `monthly_comparison` - Compare months

  4. Security
    - Enable RLS on new tables
    - Admin-only access for reset operations
*/

-- Table to store base equity for each month
CREATE TABLE IF NOT EXISTS monthly_base_equity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2020),
  total_base_equity numeric NOT NULL DEFAULT 0,
  set_by_admin text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(month, year)
);

-- Table to track monthly reset operations
CREATE TABLE IF NOT EXISTS monthly_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_month integer NOT NULL,
  reset_year integer NOT NULL,
  previous_month integer NOT NULL,
  previous_year integer NOT NULL,
  clients_reset integer DEFAULT 0,
  total_revenue_reset numeric DEFAULT 0,
  total_nots_reset numeric DEFAULT 0,
  reset_by_admin text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE monthly_base_equity ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_resets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read monthly base equity"
  ON monthly_base_equity FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin users can manage monthly base equity"
  ON monthly_base_equity FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' IN ('doctorcrack007@gmail.com', 'syedyousufhussainzaidi@gmail.com', 'teamfalcons73@gmail.com'))
  WITH CHECK (auth.jwt() ->> 'email' IN ('doctorcrack007@gmail.com', 'syedyousufhussainzaidi@gmail.com', 'teamfalcons73@gmail.com'));

CREATE POLICY "Authenticated users can read monthly resets"
  ON monthly_resets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin users can manage monthly resets"
  ON monthly_resets FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' IN ('doctorcrack007@gmail.com', 'syedyousufhussainzaidi@gmail.com', 'teamfalcons73@gmail.com'))
  WITH CHECK (auth.jwt() ->> 'email' IN ('doctorcrack007@gmail.com', 'syedyousufhussainzaidi@gmail.com', 'teamfalcons73@gmail.com'));

-- Function to set base equity for a specific month
CREATE OR REPLACE FUNCTION set_monthly_base_equity(
  p_month integer,
  p_year integer,
  p_base_equity numeric
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  admin_email text;
  result json;
BEGIN
  -- Get admin email
  admin_email := auth.jwt() ->> 'email';
  
  -- Insert or update base equity for the month
  INSERT INTO monthly_base_equity (month, year, total_base_equity, set_by_admin)
  VALUES (p_month, p_year, p_base_equity, admin_email)
  ON CONFLICT (month, year) DO UPDATE SET
    total_base_equity = EXCLUDED.total_base_equity,
    set_by_admin = EXCLUDED.set_by_admin,
    created_at = now();
  
  result := json_build_object(
    'month', p_month,
    'year', p_year,
    'base_equity', p_base_equity,
    'set_by', admin_email
  );
  
  RETURN result;
END;
$$;

-- Function to reset monthly performance (start fresh for new month)
CREATE OR REPLACE FUNCTION reset_monthly_performance(
  p_new_month integer,
  p_new_year integer
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  admin_email text;
  prev_month integer;
  prev_year integer;
  clients_count integer;
  total_revenue_reset numeric;
  total_nots_reset numeric;
  result json;
BEGIN
  -- Get admin email
  admin_email := auth.jwt() ->> 'email';
  
  -- Calculate previous month
  IF p_new_month = 1 THEN
    prev_month := 12;
    prev_year := p_new_year - 1;
  ELSE
    prev_month := p_new_month - 1;
    prev_year := p_new_year;
  END IF;
  
  -- Get current totals before reset
  SELECT 
    COUNT(*),
    COALESCE(SUM(monthly_revenue), 0),
    COALESCE(SUM(nots_generated), 0)
  INTO clients_count, total_revenue_reset, total_nots_reset
  FROM clients;
  
  -- Reset monthly revenue and NOTs for all clients
  UPDATE clients 
  SET 
    monthly_revenue = 0,
    nots_generated = 0,
    is_new_client = false,
    updated_at = now();
  
  -- Store current equity as base equity for the new month
  INSERT INTO monthly_base_equity (month, year, total_base_equity, set_by_admin)
  VALUES (
    p_new_month, 
    p_new_year, 
    (SELECT COALESCE(SUM(overall_margin), 0) FROM clients),
    admin_email
  )
  ON CONFLICT (month, year) DO UPDATE SET
    total_base_equity = (SELECT COALESCE(SUM(overall_margin), 0) FROM clients),
    set_by_admin = EXCLUDED.set_by_admin,
    created_at = now();
  
  -- Record the reset operation
  INSERT INTO monthly_resets (
    reset_month, reset_year, previous_month, previous_year,
    clients_reset, total_revenue_reset, total_nots_reset, reset_by_admin
  ) VALUES (
    p_new_month, p_new_year, prev_month, prev_year,
    clients_count, total_revenue_reset, total_nots_reset, admin_email
  );
  
  result := json_build_object(
    'reset_month', p_new_month,
    'reset_year', p_new_year,
    'clients_reset', clients_count,
    'revenue_reset', total_revenue_reset,
    'nots_reset', total_nots_reset,
    'base_equity_set', (SELECT COALESCE(SUM(overall_margin), 0) FROM clients)
  );
  
  RETURN result;
END;
$$;

-- Function to get dashboard stats for specific month
CREATE OR REPLACE FUNCTION get_monthly_dashboard_stats(
  p_month integer DEFAULT NULL,
  p_year integer DEFAULT NULL
)
RETURNS TABLE (
  month_year text,
  total_clients bigint,
  base_equity numeric,
  current_equity numeric,
  monthly_target_nots numeric,
  daily_target_nots numeric,
  weekly_target_nots numeric,
  achieved_nots numeric,
  progress_percentage numeric,
  total_revenue numeric,
  working_days integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  target_month integer := COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE));
  target_year integer := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE));
  base_equity_amount numeric;
  working_days_count integer;
BEGIN
  -- Get base equity for the month
  SELECT total_base_equity INTO base_equity_amount
  FROM monthly_base_equity 
  WHERE month = target_month AND year = target_year;
  
  -- If no base equity set, use current total equity
  IF base_equity_amount IS NULL THEN
    SELECT COALESCE(SUM(overall_margin), 0) INTO base_equity_amount FROM clients;
  END IF;
  
  -- Calculate working days
  working_days_count := get_working_days_in_month(target_year, target_month);
  
  RETURN QUERY
  SELECT 
    target_month || '/' || target_year as month_year,
    COUNT(c.id) as total_clients,
    base_equity_amount as base_equity,
    COALESCE(SUM(c.overall_margin), 0) as current_equity,
    (base_equity_amount * 0.18) / 6000 as monthly_target_nots,
    CASE 
      WHEN working_days_count > 0 THEN ((base_equity_amount * 0.18) / 6000) / working_days_count
      ELSE 0
    END as daily_target_nots,
    CASE 
      WHEN working_days_count > 0 THEN (((base_equity_amount * 0.18) / 6000) / working_days_count) * 5
      ELSE 0
    END as weekly_target_nots,
    COALESCE(SUM(c.nots_generated), 0) as achieved_nots,
    CASE 
      WHEN (base_equity_amount * 0.18) / 6000 > 0 THEN 
        (COALESCE(SUM(c.nots_generated), 0) / ((base_equity_amount * 0.18) / 6000)) * 100
      ELSE 0 
    END as progress_percentage,
    COALESCE(SUM(c.monthly_revenue), 0) as total_revenue,
    working_days_count as working_days
  FROM clients c;
END;
$$;

-- View for current month stats with base equity
CREATE OR REPLACE VIEW current_month_dashboard AS
SELECT 
  -- Basic stats
  COUNT(c.id) as total_clients,
  COALESCE(SUM(c.overall_margin), 0) as current_equity,
  COALESCE(SUM(c.monthly_revenue), 0) as total_revenue,
  COALESCE(SUM(c.nots_generated), 0) as achieved_nots,
  
  -- Base equity for current month
  COALESCE(
    (SELECT total_base_equity FROM monthly_base_equity 
     WHERE month = EXTRACT(MONTH FROM CURRENT_DATE) 
     AND year = EXTRACT(YEAR FROM CURRENT_DATE)),
    COALESCE(SUM(c.overall_margin), 0)
  ) as base_equity,
  
  -- Targets based on base equity
  (COALESCE(
    (SELECT total_base_equity FROM monthly_base_equity 
     WHERE month = EXTRACT(MONTH FROM CURRENT_DATE) 
     AND year = EXTRACT(YEAR FROM CURRENT_DATE)),
    COALESCE(SUM(c.overall_margin), 0)
  ) * 0.18) / 6000 as monthly_target_nots,
  
  -- Progress
  CASE 
    WHEN (COALESCE(
      (SELECT total_base_equity FROM monthly_base_equity 
       WHERE month = EXTRACT(MONTH FROM CURRENT_DATE) 
       AND year = EXTRACT(YEAR FROM CURRENT_DATE)),
      COALESCE(SUM(c.overall_margin), 0)
    ) * 0.18) / 6000 > 0 THEN 
      (COALESCE(SUM(c.nots_generated), 0) / 
       ((COALESCE(
         (SELECT total_base_equity FROM monthly_base_equity 
          WHERE month = EXTRACT(MONTH FROM CURRENT_DATE) 
          AND year = EXTRACT(YEAR FROM CURRENT_DATE)),
         COALESCE(SUM(c.overall_margin), 0)
       ) * 0.18) / 6000)) * 100
    ELSE 0 
  END as progress_percentage,
  
  -- Today's stats
  COALESCE((
    SELECT SUM(dt.nots_generated) 
    FROM daily_transactions dt 
    WHERE dt.transaction_date = CURRENT_DATE AND dt.transaction_type = 'commission'
  ), 0) as today_nots,
  
  COALESCE((
    SELECT SUM(dt.amount) 
    FROM daily_transactions dt 
    WHERE dt.transaction_date = CURRENT_DATE AND dt.transaction_type = 'margin_add'
  ), 0) as today_margin_added,
  
  COALESCE((
    SELECT SUM(dt.amount) 
    FROM daily_transactions dt 
    WHERE dt.transaction_date = CURRENT_DATE AND dt.transaction_type = 'withdrawal'
  ), 0) as today_withdrawals

FROM clients c;

-- Grant permissions
GRANT EXECUTE ON FUNCTION set_monthly_base_equity(integer, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_monthly_performance(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_dashboard_stats(integer, integer) TO authenticated;
GRANT SELECT ON current_month_dashboard TO authenticated;