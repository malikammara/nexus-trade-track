/*
  # Daily transactions and enhanced tracking

  1. New Tables
    - `daily_transactions` - Track daily margin additions/withdrawals
    - `daily_nots_tracking` - Track daily NOTs achievement

  2. Enhanced Functions
    - `add_daily_transaction` - Add margin/withdrawal with NOTs calculation
    - `get_working_days_in_month` - Calculate working days excluding weekends
    - `calculate_equity_based_target` - Calculate 18% equity target
    - `get_retention_metrics` - Calculate retention and trade rates

  3. Views
    - `client_summary_with_metrics` - Enhanced client view with all metrics
*/

-- Daily transactions table for tracking margin additions/withdrawals
CREATE TABLE IF NOT EXISTS daily_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  transaction_date date DEFAULT CURRENT_DATE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('margin_add', 'withdrawal', 'commission')),
  amount numeric NOT NULL,
  description text,
  nots_generated numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Daily NOTs tracking table
CREATE TABLE IF NOT EXISTS daily_nots_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_date date DEFAULT CURRENT_DATE,
  total_nots_achieved numeric DEFAULT 0,
  total_commission_pkr numeric DEFAULT 0,
  target_nots_daily numeric DEFAULT 0,
  working_day boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tracking_date)
);

-- Client activity tracking
CREATE TABLE IF NOT EXISTS client_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  activity_date date DEFAULT CURRENT_DATE,
  trades_count integer DEFAULT 0,
  commission_generated numeric DEFAULT 0,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, activity_date)
);

-- Enable RLS on new tables
ALTER TABLE daily_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_nots_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_transactions
CREATE POLICY "Authenticated users can read daily transactions"
  ON daily_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin users can manage daily transactions"
  ON daily_transactions FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- RLS Policies for daily_nots_tracking
CREATE POLICY "Authenticated users can read daily nots tracking"
  ON daily_nots_tracking FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin users can manage daily nots tracking"
  ON daily_nots_tracking FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- RLS Policies for client_activity
CREATE POLICY "Authenticated users can read client activity"
  ON client_activity FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin users can manage client activity"
  ON client_activity FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- Function to calculate working days in a month (excluding weekends)
CREATE OR REPLACE FUNCTION get_working_days_in_month(target_year integer, target_month integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  start_date date;
  end_date date;
  current_date date;
  working_days integer := 0;
  day_of_week integer;
BEGIN
  start_date := make_date(target_year, target_month, 1);
  end_date := (start_date + interval '1 month - 1 day')::date;
  
  current_date := start_date;
  
  WHILE current_date <= end_date LOOP
    day_of_week := EXTRACT(DOW FROM current_date);
    -- DOW: 0=Sunday, 6=Saturday, so exclude 0 and 6
    IF day_of_week NOT IN (0, 6) THEN
      working_days := working_days + 1;
    END IF;
    current_date := current_date + 1;
  END LOOP;
  
  RETURN working_days;
END;
$$;

-- Function to calculate equity-based target (18% of total equity)
CREATE OR REPLACE FUNCTION calculate_equity_based_target()
RETURNS TABLE (
  total_equity numeric,
  monthly_target_nots numeric,
  daily_target_nots numeric,
  weekly_target_nots numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_month integer := EXTRACT(MONTH FROM CURRENT_DATE);
  current_year integer := EXTRACT(YEAR FROM CURRENT_DATE);
  working_days_month integer;
  total_client_equity numeric;
BEGIN
  -- Get total equity from all clients
  SELECT COALESCE(SUM(overall_margin), 0) INTO total_client_equity FROM clients;
  
  -- Calculate working days in current month
  working_days_month := get_working_days_in_month(current_year, current_month);
  
  RETURN QUERY
  SELECT 
    total_client_equity as total_equity,
    (total_client_equity * 0.18) as monthly_target_nots,
    CASE 
      WHEN working_days_month > 0 THEN (total_client_equity * 0.18) / working_days_month
      ELSE 0
    END as daily_target_nots,
    CASE 
      WHEN working_days_month > 0 THEN ((total_client_equity * 0.18) / working_days_month) * 5
      ELSE 0
    END as weekly_target_nots;
END;
$$;

-- Function to add daily transaction (margin/withdrawal/commission)
CREATE OR REPLACE FUNCTION add_daily_transaction(
  p_client_id uuid,
  p_transaction_type text,
  p_amount numeric,
  p_description text DEFAULT NULL,
  p_transaction_date date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  nots_earned numeric := 0;
  commission_threshold numeric;
  updated_client clients%ROWTYPE;
  transaction_record daily_transactions%ROWTYPE;
  result json;
BEGIN
  -- Get commission threshold from settings
  SELECT commission_threshold_pkr INTO commission_threshold FROM team_settings LIMIT 1;
  
  -- Calculate NOTs if it's a commission transaction
  IF p_transaction_type = 'commission' THEN
    nots_earned := p_amount / COALESCE(commission_threshold, 6000);
  END IF;
  
  -- Insert transaction record
  INSERT INTO daily_transactions (client_id, transaction_type, amount, description, nots_generated, transaction_date)
  VALUES (p_client_id, p_transaction_type, p_amount, p_description, nots_earned, p_transaction_date)
  RETURNING * INTO transaction_record;
  
  -- Update client based on transaction type
  IF p_transaction_type = 'margin_add' THEN
    UPDATE clients 
    SET overall_margin = overall_margin + p_amount,
        updated_at = now()
    WHERE id = p_client_id
    RETURNING * INTO updated_client;
    
  ELSIF p_transaction_type = 'withdrawal' THEN
    UPDATE clients 
    SET overall_margin = GREATEST(0, overall_margin - p_amount),
        updated_at = now()
    WHERE id = p_client_id
    RETURNING * INTO updated_client;
    
  ELSIF p_transaction_type = 'commission' THEN
    UPDATE clients 
    SET monthly_revenue = monthly_revenue + p_amount,
        nots_generated = nots_generated + nots_earned,
        updated_at = now()
    WHERE id = p_client_id
    RETURNING * INTO updated_client;
  END IF;
  
  -- Update daily NOTs tracking
  INSERT INTO daily_nots_tracking (tracking_date, total_nots_achieved, total_commission_pkr, working_day)
  VALUES (
    p_transaction_date, 
    nots_earned, 
    CASE WHEN p_transaction_type = 'commission' THEN p_amount ELSE 0 END,
    EXTRACT(DOW FROM p_transaction_date) NOT IN (0, 6)
  )
  ON CONFLICT (tracking_date) DO UPDATE SET
    total_nots_achieved = daily_nots_tracking.total_nots_achieved + EXCLUDED.total_nots_achieved,
    total_commission_pkr = daily_nots_tracking.total_commission_pkr + EXCLUDED.total_commission_pkr;
  
  -- Update client activity
  INSERT INTO client_activity (client_id, activity_date, trades_count, commission_generated, is_active)
  VALUES (
    p_client_id, 
    p_transaction_date, 
    CASE WHEN p_transaction_type = 'commission' THEN 1 ELSE 0 END,
    CASE WHEN p_transaction_type = 'commission' THEN p_amount ELSE 0 END,
    true
  )
  ON CONFLICT (client_id, activity_date) DO UPDATE SET
    trades_count = client_activity.trades_count + EXCLUDED.trades_count,
    commission_generated = client_activity.commission_generated + EXCLUDED.commission_generated,
    is_active = true;
  
  -- Build result
  result := json_build_object(
    'transaction', row_to_json(transaction_record),
    'updated_client', row_to_json(updated_client),
    'nots_earned', nots_earned
  );
  
  RETURN result;
END;
$$;

-- Function to get retention and trade rate metrics
CREATE OR REPLACE FUNCTION get_retention_metrics(days_back integer DEFAULT 30)
RETURNS TABLE (
  total_clients bigint,
  active_clients bigint,
  retention_rate numeric,
  avg_trades_per_client numeric,
  total_commission numeric,
  avg_commission_per_client numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_date date := CURRENT_DATE - days_back;
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM clients) as total_clients,
    COUNT(DISTINCT ca.client_id) as active_clients,
    CASE 
      WHEN (SELECT COUNT(*) FROM clients) > 0 THEN 
        (COUNT(DISTINCT ca.client_id)::numeric / (SELECT COUNT(*) FROM clients)::numeric) * 100
      ELSE 0 
    END as retention_rate,
    COALESCE(AVG(ca.trades_count), 0) as avg_trades_per_client,
    COALESCE(SUM(ca.commission_generated), 0) as total_commission,
    CASE 
      WHEN COUNT(DISTINCT ca.client_id) > 0 THEN 
        COALESCE(SUM(ca.commission_generated), 0) / COUNT(DISTINCT ca.client_id)
      ELSE 0 
    END as avg_commission_per_client
  FROM client_activity ca
  WHERE ca.activity_date >= start_date AND ca.is_active = true;
END;
$$;

-- Enhanced dashboard view with all metrics
CREATE OR REPLACE VIEW enhanced_dashboard_stats AS
SELECT 
  -- Basic stats
  COUNT(c.id) as total_clients,
  COALESCE(SUM(c.overall_margin), 0) as total_equity,
  COALESCE(SUM(c.monthly_revenue), 0) as total_monthly_revenue,
  COALESCE(SUM(c.nots_generated), 0) as total_nots,
  
  -- Target calculations (18% of total equity)
  (COALESCE(SUM(c.overall_margin), 0) * 0.18) as monthly_target_nots,
  
  -- Progress percentage
  CASE 
    WHEN (COALESCE(SUM(c.overall_margin), 0) * 0.18) > 0 THEN 
      (COALESCE(SUM(c.nots_generated), 0) / (COALESCE(SUM(c.overall_margin), 0) * 0.18)) * 100
    ELSE 0 
  END as progress_percentage,
  
  -- Daily stats from today
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
GRANT EXECUTE ON FUNCTION get_working_days_in_month(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_equity_based_target() TO authenticated;
GRANT EXECUTE ON FUNCTION add_daily_transaction(uuid, text, numeric, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_retention_metrics(integer) TO authenticated;
GRANT SELECT ON enhanced_dashboard_stats TO authenticated;