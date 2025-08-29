/*
  # New deposit flow and monthly client status system

  1. Database Changes
    - Add monthly reset function for new client status
    - Update transaction handling to use margin_in for new deposits
    - Create cash flow tracking separate from equity calculations

  2. New Functions
    - `reset_new_client_status_monthly` - Reset new client flags monthly
    - `update_add_daily_transaction` - Enhanced transaction handling
    - `get_cash_flow_metrics` - Separate cash flow from equity tracking

  3. Views
    - `enhanced_client_summary` - Client view with proper cash flow separation
    - `cash_flow_dashboard_stats` - Dashboard with cash flow vs equity distinction

  4. Scheduled Tasks
    - Monthly reset of new client status (first day of each month)
*/

-- Function to reset new client status monthly (should be called on 1st of each month)
CREATE OR REPLACE FUNCTION reset_new_client_status_monthly()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Reset all clients to not be new clients at the start of each month
  UPDATE clients 
  SET is_new_client = false, updated_at = now()
  WHERE is_new_client = true;
  
  -- Log the reset action
  RAISE NOTICE 'Reset new client status for % clients', (SELECT COUNT(*) FROM clients WHERE is_new_client = true);
END;
$$;

-- Enhanced transaction function that properly handles margin_in for new deposits
CREATE OR REPLACE FUNCTION add_daily_transaction_enhanced(
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
  client_record clients%ROWTYPE;
  result json;
BEGIN
  -- Get current client data
  SELECT * INTO client_record FROM clients WHERE id = p_client_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;
  
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
    -- For new clients, add to margin_in (new deposits)
    -- For existing clients, add to overall_margin (additional margin)
    IF client_record.is_new_client THEN
      UPDATE clients 
      SET margin_in = margin_in + p_amount,
          overall_margin = overall_margin + p_amount,
          updated_at = now()
      WHERE id = p_client_id
      RETURNING * INTO updated_client;
    ELSE
      UPDATE clients 
      SET overall_margin = overall_margin + p_amount,
          updated_at = now()
      WHERE id = p_client_id
      RETURNING * INTO updated_client;
    END IF;
    
  ELSIF p_transaction_type = 'withdrawal' THEN
    -- Withdrawals reduce overall_margin but are tracked separately for cash flow
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

-- Function to get cash flow metrics (separate from equity)
CREATE OR REPLACE FUNCTION get_cash_flow_metrics()
RETURNS TABLE (
  total_new_deposits numeric,
  total_margin_additions numeric,
  total_withdrawals numeric,
  net_cash_flow numeric,
  total_commission numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- New deposits from new clients (stored in margin_in)
    COALESCE((
      SELECT SUM(c.margin_in) 
      FROM clients c 
      WHERE c.is_new_client = true
    ), 0) as total_new_deposits,
    
    -- Margin additions from existing clients
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      JOIN clients c ON c.id = dt.client_id
      WHERE dt.transaction_type = 'margin_add' AND c.is_new_client = false
    ), 0) as total_margin_additions,
    
    -- Total withdrawals
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      WHERE dt.transaction_type = 'withdrawal'
    ), 0) as total_withdrawals,
    
    -- Net cash flow
    COALESCE((
      SELECT SUM(c.margin_in) FROM clients c WHERE c.is_new_client = true
    ), 0) + 
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      JOIN clients c ON c.id = dt.client_id
      WHERE dt.transaction_type = 'margin_add' AND c.is_new_client = false
    ), 0) - 
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      WHERE dt.transaction_type = 'withdrawal'
    ), 0) as net_cash_flow,
    
    -- Total commission
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      WHERE dt.transaction_type = 'commission'
    ), 0) as total_commission;
END;
$$;

-- Enhanced client summary view with proper cash flow separation
CREATE OR REPLACE VIEW enhanced_client_summary AS
SELECT 
  c.*,
  a.name as agent_name,
  a.email as agent_email,
  a.commission_rate as agent_commission_rate,
  
  -- Cash flow metrics
  CASE 
    WHEN c.is_new_client THEN c.margin_in
    ELSE 0
  END as new_deposit_amount,
  
  CASE 
    WHEN c.is_new_client THEN 0
    ELSE COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      WHERE dt.client_id = c.id AND dt.transaction_type = 'margin_add'
    ), 0)
  END as additional_margin_amount,
  
  COALESCE((
    SELECT SUM(dt.amount) 
    FROM daily_transactions dt 
    WHERE dt.client_id = c.id AND dt.transaction_type = 'withdrawal'
  ), 0) as total_withdrawals,
  
  -- Base equity for target calculation (current equity - new deposits - margin additions + withdrawals)
  c.overall_margin - 
  CASE WHEN c.is_new_client THEN c.margin_in ELSE 0 END -
  COALESCE((
    SELECT SUM(dt.amount) 
    FROM daily_transactions dt 
    WHERE dt.client_id = c.id AND dt.transaction_type = 'margin_add' AND NOT c.is_new_client
  ), 0) +
  COALESCE((
    SELECT SUM(dt.amount) 
    FROM daily_transactions dt 
    WHERE dt.client_id = c.id AND dt.transaction_type = 'withdrawal'
  ), 0) as base_equity_for_targets

FROM clients c
LEFT JOIN agents a ON a.id = c.agent_id
ORDER BY c.overall_margin DESC;

-- Enhanced dashboard stats with cash flow separation
CREATE OR REPLACE VIEW cash_flow_dashboard_stats AS
SELECT 
  -- Basic client stats
  COUNT(c.id) as total_clients,
  COUNT(CASE WHEN c.is_new_client THEN 1 END) as new_clients_count,
  
  -- Current equity and base equity
  COALESCE(SUM(c.overall_margin), 0) as total_equity,
  COALESCE(SUM(
    c.overall_margin - 
    CASE WHEN c.is_new_client THEN c.margin_in ELSE 0 END -
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      WHERE dt.client_id = c.id AND dt.transaction_type = 'margin_add' AND NOT c.is_new_client
    ), 0) +
    COALESCE((
      SELECT SUM(dt.amount) 
      FROM daily_transactions dt 
      WHERE dt.client_id = c.id AND dt.transaction_type = 'withdrawal'
    ), 0)
  ), 0) as base_equity,
  
  -- Cash flow components
  COALESCE(SUM(CASE WHEN c.is_new_client THEN c.margin_in ELSE 0 END), 0) as total_new_deposits,
  
  COALESCE((
    SELECT SUM(dt.amount) 
    FROM daily_transactions dt 
    JOIN clients cl ON cl.id = dt.client_id
    WHERE dt.transaction_type = 'margin_add' AND cl.is_new_client = false
  ), 0) as total_margin_additions,
  
  COALESCE((
    SELECT SUM(dt.amount) 
    FROM daily_transactions dt 
    WHERE dt.transaction_type = 'withdrawal'
  ), 0) as total_withdrawals,
  
  -- Revenue and NOTs
  COALESCE(SUM(c.monthly_revenue), 0) as total_monthly_revenue,
  COALESCE(SUM(c.nots_generated), 0) as total_nots,
  
  -- Today's activity
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
GRANT EXECUTE ON FUNCTION reset_new_client_status_monthly() TO authenticated;
GRANT EXECUTE ON FUNCTION add_daily_transaction_enhanced(uuid, text, numeric, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cash_flow_metrics() TO authenticated;
GRANT SELECT ON enhanced_client_summary TO authenticated;
GRANT SELECT ON cash_flow_dashboard_stats TO authenticated;