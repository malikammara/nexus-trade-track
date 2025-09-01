/*
  # Add monthly filtering functions for CS Falcons

  1. New Functions
    - `get_cash_flow_metrics_for_month` - Get cash flow metrics for specific month/year
    - `get_monthly_dashboard_stats_enhanced` - Enhanced monthly stats with base equity
    - `get_transactions_for_month` - Get transactions filtered by month/year

  2. Enhanced Views
    - Monthly filtering support for all analytics

  3. Security
    - All functions accessible to authenticated users
*/

-- Function to get cash flow metrics for a specific month
CREATE OR REPLACE FUNCTION get_cash_flow_metrics_for_month(
  target_month integer,
  target_year integer
)
RETURNS TABLE (
  total_new_deposits numeric,
  total_margin_additions numeric,
  total_withdrawals numeric,
  net_cash_flow numeric,
  total_commission numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_date date;
  end_date date;
BEGIN
  -- Calculate date range for the month
  start_date := make_date(target_year, target_month, 1);
  end_date := (start_date + interval '1 month - 1 day')::date;
  
  RETURN QUERY
  SELECT 
    -- New deposits from new clients (stored in margin_in)
    COALESCE((
      SELECT SUM(c.margin_in) 
      FROM clients c 
      WHERE c.is_new_client = true
        AND c.created_at::date BETWEEN start_date AND end_date
    ), 0) as total_new_deposits,
    
    -- Margin additions from existing clients (from transactions)
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      JOIN clients c ON c.id = dt.client_id
      WHERE dt.transaction_type = 'margin_add' 
        AND dt.transaction_date BETWEEN start_date AND end_date
        AND c.is_new_client = false
    ), 0) as total_margin_additions,
    
    -- Total withdrawals for the month
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      WHERE dt.transaction_type = 'withdrawal'
        AND dt.transaction_date BETWEEN start_date AND end_date
    ), 0) as total_withdrawals,
    
    -- Net cash flow for the month
    COALESCE((
      SELECT SUM(c.margin_in) 
      FROM clients c 
      WHERE c.is_new_client = true
        AND c.created_at::date BETWEEN start_date AND end_date
    ), 0) + 
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      JOIN clients c ON c.id = dt.client_id
      WHERE dt.transaction_type = 'margin_add' 
        AND dt.transaction_date BETWEEN start_date AND end_date
        AND c.is_new_client = false
    ), 0) - 
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      WHERE dt.transaction_type = 'withdrawal'
        AND dt.transaction_date BETWEEN start_date AND end_date
    ), 0) as net_cash_flow,
    
    -- Total commission for the month
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      WHERE dt.transaction_type = 'commission'
        AND dt.transaction_date BETWEEN start_date AND end_date
    ), 0) as total_commission;
END;
$$;

-- Enhanced function to get monthly dashboard stats with base equity calculation
CREATE OR REPLACE FUNCTION get_monthly_dashboard_stats_enhanced(
  target_month integer,
  target_year integer
)
RETURNS TABLE (
  total_clients bigint,
  current_equity numeric,
  base_equity numeric,
  total_revenue numeric,
  total_nots numeric,
  monthly_target_nots numeric,
  daily_target_nots numeric,
  weekly_target_nots numeric,
  progress_percentage numeric,
  working_days integer,
  new_deposits numeric,
  margin_additions numeric,
  total_withdrawals numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_date date;
  end_date date;
  working_days_count integer;
  current_equity_amount numeric;
  new_deposits_amount numeric;
  margin_additions_amount numeric;
  withdrawals_amount numeric;
  base_equity_amount numeric;
  monthly_target numeric;
BEGIN
  -- Calculate date range
  start_date := make_date(target_year, target_month, 1);
  end_date := (start_date + interval '1 month - 1 day')::date;
  
  -- Get working days
  working_days_count := get_working_days_in_month(target_year, target_month);
  
  -- Get current total equity
  SELECT COALESCE(SUM(c.overall_margin), 0) INTO current_equity_amount FROM clients;
  
  -- Get cash flow metrics for the month
  SELECT 
    cf.total_new_deposits,
    cf.total_margin_additions,
    cf.total_withdrawals
  INTO new_deposits_amount, margin_additions_amount, withdrawals_amount
  FROM get_cash_flow_metrics_for_month(target_month, target_year) cf;
  
  -- Calculate base equity (current - new deposits - margin additions + withdrawals)
  base_equity_amount := current_equity_amount - new_deposits_amount - margin_additions_amount + withdrawals_amount;
  
  -- Calculate monthly target NOTs based on base equity
  monthly_target := (base_equity_amount * 0.18) / 6000;
  
  RETURN QUERY
  SELECT 
    COUNT(c.id) as total_clients,
    current_equity_amount as current_equity,
    base_equity_amount as base_equity,
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      WHERE dt.transaction_type = 'commission'
        AND dt.transaction_date BETWEEN start_date AND end_date
    ), 0) as total_revenue,
    COALESCE((
      SELECT SUM(dt.nots_generated) 
      FROM daily_transactions dt 
      WHERE dt.transaction_type = 'commission'
        AND dt.transaction_date BETWEEN start_date AND end_date
    ), 0) as total_nots,
    monthly_target as monthly_target_nots,
    CASE 
      WHEN working_days_count > 0 THEN monthly_target / working_days_count
      ELSE 0
    END as daily_target_nots,
    CASE 
      WHEN working_days_count > 0 THEN (monthly_target / working_days_count) * 5
      ELSE 0
    END as weekly_target_nots,
    CASE 
      WHEN monthly_target > 0 THEN 
        (COALESCE((
          SELECT SUM(dt.nots_generated) 
          FROM daily_transactions dt 
          WHERE dt.transaction_type = 'commission'
            AND dt.transaction_date BETWEEN start_date AND end_date
        ), 0) / monthly_target) * 100
      ELSE 0 
    END as progress_percentage,
    working_days_count as working_days,
    new_deposits_amount as new_deposits,
    margin_additions_amount as margin_additions,
    withdrawals_amount as total_withdrawals
  FROM clients c;
END;
$$;

-- Function to get transactions for a specific month
CREATE OR REPLACE FUNCTION get_transactions_for_month(
  target_month integer,
  target_year integer
)
RETURNS TABLE (
  id uuid,
  client_id uuid,
  transaction_date date,
  transaction_type text,
  amount numeric,
  description text,
  nots_generated numeric,
  created_at timestamptz,
  client_name text
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_date date;
  end_date date;
BEGIN
  start_date := make_date(target_year, target_month, 1);
  end_date := (start_date + interval '1 month - 1 day')::date;
  
  RETURN QUERY
  SELECT 
    dt.id,
    dt.client_id,
    dt.transaction_date,
    dt.transaction_type,
    dt.amount,
    dt.description,
    dt.nots_generated,
    dt.created_at,
    c.name as client_name
  FROM daily_transactions dt
  JOIN clients c ON c.id = dt.client_id
  WHERE dt.transaction_date BETWEEN start_date AND end_date
  ORDER BY dt.transaction_date DESC, dt.created_at DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_cash_flow_metrics_for_month(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_dashboard_stats_enhanced(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_transactions_for_month(integer, integer) TO authenticated;