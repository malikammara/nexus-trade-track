/*
  # Create dashboard views and functions

  1. Views
    - `dashboard_stats` - Aggregated statistics for dashboard
    - `client_performance_summary` - Client performance with calculated metrics

  2. Functions
    - `get_monthly_team_stats` - Get team statistics for a specific month/year
    - `calculate_client_nots` - Calculate NOTs based on commission threshold
*/

-- Create view for dashboard statistics
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT 
  COUNT(c.id) as total_clients,
  COALESCE(SUM(c.margin_in), 0) as total_margin_in,
  COALESCE(SUM(c.overall_margin), 0) as total_overall_margin,
  COALESCE(SUM(c.monthly_revenue), 0) as total_monthly_revenue,
  COALESCE(SUM(c.nots_generated), 0) as total_nots,
  (SELECT nots_target_per_client FROM team_settings LIMIT 1) * COUNT(c.id) as target_nots,
  CASE 
    WHEN COUNT(c.id) > 0 THEN 
      (COALESCE(SUM(c.nots_generated), 0)::float / 
       ((SELECT nots_target_per_client FROM team_settings LIMIT 1) * COUNT(c.id))::float) * 100
    ELSE 0 
  END as progress_percentage
FROM clients c;

-- Create view for client performance summary
CREATE OR REPLACE VIEW client_performance_summary AS
SELECT 
  c.*,
  CASE 
    WHEN ts.commission_threshold_pkr > 0 THEN 
      FLOOR(c.margin_in / ts.commission_threshold_pkr)
    ELSE c.nots_generated 
  END as calculated_nots,
  CASE 
    WHEN ts.nots_target_per_client > 0 THEN 
      (c.nots_generated::float / ts.nots_target_per_client::float) * 100
    ELSE 0 
  END as target_progress_percentage
FROM clients c
CROSS JOIN team_settings ts
ORDER BY c.nots_generated DESC, c.margin_in DESC;

-- Function to get monthly team statistics
CREATE OR REPLACE FUNCTION get_monthly_team_stats(target_month integer, target_year integer)
RETURNS TABLE (
  total_clients bigint,
  total_margin_in numeric,
  total_overall_margin numeric,
  total_revenue numeric,
  total_nots bigint,
  target_nots integer,
  progress_percentage numeric
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT mp.client_id) as total_clients,
    COALESCE(SUM(mp.margin_in), 0) as total_margin_in,
    COALESCE(SUM(mp.overall_margin), 0) as total_overall_margin,
    COALESCE(SUM(mp.revenue_generated), 0) as total_revenue,
    COALESCE(SUM(mp.nots_achieved), 0) as total_nots,
    (SELECT ts.nots_target_per_client FROM team_settings ts LIMIT 1) * COUNT(DISTINCT mp.client_id)::integer as target_nots,
    CASE 
      WHEN COUNT(DISTINCT mp.client_id) > 0 THEN 
        (COALESCE(SUM(mp.nots_achieved), 0)::numeric / 
         ((SELECT ts.nots_target_per_client FROM team_settings ts LIMIT 1) * COUNT(DISTINCT mp.client_id))::numeric) * 100
      ELSE 0 
    END as progress_percentage
  FROM monthly_performance mp
  WHERE mp.month = target_month AND mp.year = target_year;
END;
$$;

-- Function to calculate NOTs based on commission
CREATE OR REPLACE FUNCTION calculate_client_nots(client_margin numeric)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  threshold numeric;
BEGIN
  SELECT commission_threshold_pkr INTO threshold FROM team_settings LIMIT 1;
  
  IF threshold IS NULL OR threshold <= 0 THEN
    RETURN 0;
  END IF;
  
  RETURN FLOOR(client_margin / threshold)::integer;
END;
$$;

-- Grant permissions for views and functions
GRANT SELECT ON dashboard_stats TO authenticated;
GRANT SELECT ON client_performance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_team_stats(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_client_nots(numeric) TO authenticated;