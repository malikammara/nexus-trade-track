/*
  # Agent Evaluation System

  1. New Tables
    - `agent_evaluations` - Store weekly evaluation scores
      - `id` (uuid, primary key)
      - `agent_id` (uuid, foreign key to agents)
      - `week_start_date` (date) - Start of the evaluation week
      - `compliance_score` (integer, 1-5)
      - `tone_clarity_score` (integer, 1-5)
      - `relevance_score` (integer, 1-5)
      - `client_satisfaction_score` (integer, 1-5)
      - `portfolio_revenue_score` (integer, 1-5)
      - `total_score` (integer, computed, max 25)
      - `compliance_remarks` (text, optional)
      - `tone_remarks` (text, optional)
      - `relevance_remarks` (text, optional)
      - `satisfaction_remarks` (text, optional)
      - `portfolio_remarks` (text, optional)
      - `overall_remarks` (text, optional)
      - `evaluated_by` (text) - Manager email
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Functions
    - `add_agent_evaluation` - Add new evaluation
    - `update_agent_evaluation` - Update existing evaluation
    - `get_agent_evaluations` - Get evaluations for agent(s)
    - `get_evaluation_alerts` - Get performance alerts based on scores

  3. Views
    - `agent_evaluation_summary` - Agent evaluations with performance levels
    - `evaluation_alerts` - Current alerts for agents

  4. Security
    - Enable RLS on `agent_evaluations` table
    - Agents can read their own evaluations
    - Managers can manage all evaluations
*/

-- Create agent_evaluations table
CREATE TABLE IF NOT EXISTS agent_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  compliance_score integer NOT NULL CHECK (compliance_score >= 1 AND compliance_score <= 5),
  tone_clarity_score integer NOT NULL CHECK (tone_clarity_score >= 1 AND tone_clarity_score <= 5),
  relevance_score integer NOT NULL CHECK (relevance_score >= 1 AND relevance_score <= 5),
  client_satisfaction_score integer NOT NULL CHECK (client_satisfaction_score >= 1 AND client_satisfaction_score <= 5),
  portfolio_revenue_score integer NOT NULL CHECK (portfolio_revenue_score >= 1 AND portfolio_revenue_score <= 5),
  total_score integer GENERATED ALWAYS AS (
    compliance_score + tone_clarity_score + relevance_score + client_satisfaction_score + portfolio_revenue_score
  ) STORED,
  compliance_remarks text,
  tone_remarks text,
  relevance_remarks text,
  satisfaction_remarks text,
  portfolio_remarks text,
  overall_remarks text,
  evaluated_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, week_start_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_evaluations_agent_id ON agent_evaluations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_evaluations_week ON agent_evaluations(week_start_date);
CREATE INDEX IF NOT EXISTS idx_agent_evaluations_score ON agent_evaluations(total_score);

-- Enable RLS
ALTER TABLE agent_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Agents can read their own evaluations
CREATE POLICY "Agents can read own evaluations"
  ON agent_evaluations FOR SELECT TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Managers can read all evaluations
CREATE POLICY "Managers can read all evaluations"
  ON agent_evaluations FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' = 'syedyousufhussainzaidi@gmail.com');

-- Managers can manage all evaluations
CREATE POLICY "Managers can manage evaluations"
  ON agent_evaluations FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'syedyousufhussainzaidi@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'syedyousufhussainzaidi@gmail.com');

-- Create updated_at trigger
CREATE TRIGGER update_agent_evaluations_updated_at
  BEFORE UPDATE ON agent_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to add agent evaluation
CREATE OR REPLACE FUNCTION add_agent_evaluation(
  p_agent_id uuid,
  p_week_start_date date,
  p_compliance_score integer,
  p_tone_clarity_score integer,
  p_relevance_score integer,
  p_client_satisfaction_score integer,
  p_portfolio_revenue_score integer,
  p_compliance_remarks text DEFAULT NULL,
  p_tone_remarks text DEFAULT NULL,
  p_relevance_remarks text DEFAULT NULL,
  p_satisfaction_remarks text DEFAULT NULL,
  p_portfolio_remarks text DEFAULT NULL,
  p_overall_remarks text DEFAULT NULL
)
RETURNS agent_evaluations
LANGUAGE plpgsql
AS $$
DECLARE
  new_evaluation agent_evaluations%ROWTYPE;
  manager_email text;
BEGIN
  -- Get manager email
  manager_email := auth.jwt() ->> 'email';
  
  -- Verify manager permissions
  IF manager_email != 'syedyousufhussainzaidi@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: Only managers can add evaluations';
  END IF;
  
  -- Insert evaluation
  INSERT INTO agent_evaluations (
    agent_id, week_start_date, compliance_score, tone_clarity_score,
    relevance_score, client_satisfaction_score, portfolio_revenue_score,
    compliance_remarks, tone_remarks, relevance_remarks,
    satisfaction_remarks, portfolio_remarks, overall_remarks, evaluated_by
  ) VALUES (
    p_agent_id, p_week_start_date, p_compliance_score, p_tone_clarity_score,
    p_relevance_score, p_client_satisfaction_score, p_portfolio_revenue_score,
    p_compliance_remarks, p_tone_remarks, p_relevance_remarks,
    p_satisfaction_remarks, p_portfolio_remarks, p_overall_remarks, manager_email
  )
  RETURNING * INTO new_evaluation;
  
  RETURN new_evaluation;
END;
$$;

-- Function to update agent evaluation
CREATE OR REPLACE FUNCTION update_agent_evaluation(
  p_evaluation_id uuid,
  p_compliance_score integer DEFAULT NULL,
  p_tone_clarity_score integer DEFAULT NULL,
  p_relevance_score integer DEFAULT NULL,
  p_client_satisfaction_score integer DEFAULT NULL,
  p_portfolio_revenue_score integer DEFAULT NULL,
  p_compliance_remarks text DEFAULT NULL,
  p_tone_remarks text DEFAULT NULL,
  p_relevance_remarks text DEFAULT NULL,
  p_satisfaction_remarks text DEFAULT NULL,
  p_portfolio_remarks text DEFAULT NULL,
  p_overall_remarks text DEFAULT NULL
)
RETURNS agent_evaluations
LANGUAGE plpgsql
AS $$
DECLARE
  updated_evaluation agent_evaluations%ROWTYPE;
  manager_email text;
BEGIN
  -- Get manager email
  manager_email := auth.jwt() ->> 'email';
  
  -- Verify manager permissions
  IF manager_email != 'syedyousufhussainzaidi@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: Only managers can update evaluations';
  END IF;
  
  -- Update evaluation
  UPDATE agent_evaluations SET
    compliance_score = COALESCE(p_compliance_score, compliance_score),
    tone_clarity_score = COALESCE(p_tone_clarity_score, tone_clarity_score),
    relevance_score = COALESCE(p_relevance_score, relevance_score),
    client_satisfaction_score = COALESCE(p_client_satisfaction_score, client_satisfaction_score),
    portfolio_revenue_score = COALESCE(p_portfolio_revenue_score, portfolio_revenue_score),
    compliance_remarks = COALESCE(p_compliance_remarks, compliance_remarks),
    tone_remarks = COALESCE(p_tone_remarks, tone_remarks),
    relevance_remarks = COALESCE(p_relevance_remarks, relevance_remarks),
    satisfaction_remarks = COALESCE(p_satisfaction_remarks, satisfaction_remarks),
    portfolio_remarks = COALESCE(p_portfolio_remarks, portfolio_remarks),
    overall_remarks = COALESCE(p_overall_remarks, overall_remarks),
    updated_at = now()
  WHERE id = p_evaluation_id
  RETURNING * INTO updated_evaluation;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evaluation not found';
  END IF;
  
  RETURN updated_evaluation;
END;
$$;

-- Function to get agent evaluations
CREATE OR REPLACE FUNCTION get_agent_evaluations(
  p_agent_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  agent_id uuid,
  agent_name text,
  agent_email text,
  week_start_date date,
  compliance_score integer,
  tone_clarity_score integer,
  relevance_score integer,
  client_satisfaction_score integer,
  portfolio_revenue_score integer,
  total_score integer,
  performance_level text,
  alert_message text,
  compliance_remarks text,
  tone_remarks text,
  relevance_remarks text,
  satisfaction_remarks text,
  portfolio_remarks text,
  overall_remarks text,
  evaluated_by text,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ae.id,
    ae.agent_id,
    a.name as agent_name,
    a.email as agent_email,
    ae.week_start_date,
    ae.compliance_score,
    ae.tone_clarity_score,
    ae.relevance_score,
    ae.client_satisfaction_score,
    ae.portfolio_revenue_score,
    ae.total_score,
    CASE 
      WHEN ae.total_score <= 15 THEN 'Immediate Coaching'
      WHEN ae.total_score BETWEEN 16 AND 19 THEN 'Needs Improvement'
      WHEN ae.total_score BETWEEN 20 AND 23 THEN 'Strong Performance'
      WHEN ae.total_score BETWEEN 24 AND 25 THEN 'Excellent'
      ELSE 'Unknown'
    END as performance_level,
    CASE 
      WHEN ae.total_score <= 15 THEN 'Immediate coaching and retraining required'
      WHEN ae.total_score BETWEEN 16 AND 19 THEN 'Performance needs improvement - additional support recommended'
      WHEN ae.total_score BETWEEN 20 AND 23 THEN 'Strong performance - continue current approach'
      WHEN ae.total_score BETWEEN 24 AND 25 THEN 'Excellent performance - use as training example'
      ELSE 'Score evaluation needed'
    END as alert_message,
    ae.compliance_remarks,
    ae.tone_remarks,
    ae.relevance_remarks,
    ae.satisfaction_remarks,
    ae.portfolio_remarks,
    ae.overall_remarks,
    ae.evaluated_by,
    ae.created_at
  FROM agent_evaluations ae
  JOIN agents a ON a.id = ae.agent_id
  WHERE (p_agent_id IS NULL OR ae.agent_id = p_agent_id)
  ORDER BY ae.week_start_date DESC, ae.created_at DESC
  LIMIT p_limit;
END;
$$;

-- View for agent evaluation summary with performance levels
CREATE OR REPLACE VIEW agent_evaluation_summary AS
SELECT 
  ae.id,
  ae.agent_id,
  a.name as agent_name,
  a.email as agent_email,
  ae.week_start_date,
  ae.total_score,
  CASE 
    WHEN ae.total_score <= 15 THEN 'Immediate Coaching'
    WHEN ae.total_score BETWEEN 16 AND 19 THEN 'Needs Improvement'
    WHEN ae.total_score BETWEEN 20 AND 23 THEN 'Strong Performance'
    WHEN ae.total_score BETWEEN 24 AND 25 THEN 'Excellent'
    ELSE 'Unknown'
  END as performance_level,
  CASE 
    WHEN ae.total_score <= 15 THEN 'critical'
    WHEN ae.total_score BETWEEN 16 AND 19 THEN 'warning'
    WHEN ae.total_score BETWEEN 20 AND 23 THEN 'good'
    WHEN ae.total_score BETWEEN 24 AND 25 THEN 'excellent'
    ELSE 'unknown'
  END as alert_level,
  ae.evaluated_by,
  ae.created_at
FROM agent_evaluations ae
JOIN agents a ON a.id = ae.agent_id
ORDER BY ae.week_start_date DESC, ae.total_score ASC;

-- View for current evaluation alerts
CREATE OR REPLACE VIEW evaluation_alerts AS
SELECT 
  a.id as agent_id,
  a.name as agent_name,
  a.email as agent_email,
  ae.total_score,
  ae.week_start_date,
  CASE 
    WHEN ae.total_score <= 15 THEN 'Immediate coaching and retraining required'
    WHEN ae.total_score BETWEEN 16 AND 19 THEN 'Performance needs improvement - additional support recommended'
    WHEN ae.total_score BETWEEN 20 AND 23 THEN 'Strong performance - continue current approach'
    WHEN ae.total_score BETWEEN 24 AND 25 THEN 'Excellent performance - use as training example'
    ELSE 'No recent evaluation'
  END as alert_message,
  CASE 
    WHEN ae.total_score <= 15 THEN 'critical'
    WHEN ae.total_score BETWEEN 16 AND 19 THEN 'warning'
    WHEN ae.total_score BETWEEN 20 AND 23 THEN 'good'
    WHEN ae.total_score BETWEEN 24 AND 25 THEN 'excellent'
    ELSE 'none'
  END as alert_level
FROM agents a
LEFT JOIN LATERAL (
  SELECT * FROM agent_evaluations 
  WHERE agent_id = a.id 
  ORDER BY week_start_date DESC 
  LIMIT 1
) ae ON true
WHERE a.is_active = true;

-- Grant permissions
GRANT EXECUTE ON FUNCTION add_agent_evaluation(uuid, date, integer, integer, integer, integer, integer, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_agent_evaluation(uuid, integer, integer, integer, integer, integer, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_evaluations(uuid, integer) TO authenticated;
GRANT SELECT ON agent_evaluation_summary TO authenticated;
GRANT SELECT ON evaluation_alerts TO authenticated;