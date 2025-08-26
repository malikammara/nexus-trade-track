/*
  # Create agents system

  1. New Tables
    - `agents`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null)
      - `email` (text, unique, not null)
      - `phone` (text, optional)
      - `commission_rate` (numeric, default 0.05) - Agent commission rate (5%)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Table Modifications
    - Add `agent_id` column to `clients` table

  3. Functions
    - `get_agent_performance` - Get agent performance metrics
    - `link_client_to_agent` - Link a client to an agent
    - `unlink_client_from_agent` - Remove client-agent link

  4. Views
    - `agent_performance_summary` - Agent performance with metrics

  5. Security
    - Enable RLS on `agents` table
    - Add policies for authenticated users to read and admin to manage
*/

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  commission_rate numeric DEFAULT 0.05 CHECK (commission_rate >= 0 AND commission_rate <= 1),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add agent_id column to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN agent_id uuid REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_agent_id ON clients(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active);

-- Enable RLS on agents table
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agents
CREATE POLICY "Authenticated users can read agents"
  ON agents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin users can manage agents"
  ON agents FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' IN ('doctorcrack007@gmail.com', 'syedyousufhussainzaidi@gmail.com', 'teamfalcons73@gmail.com'))
  WITH CHECK (auth.jwt() ->> 'email' IN ('doctorcrack007@gmail.com', 'syedyousufhussainzaidi@gmail.com', 'teamfalcons73@gmail.com'));

-- Create updated_at trigger for agents
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get agent performance metrics
CREATE OR REPLACE FUNCTION get_agent_performance(p_agent_id uuid DEFAULT NULL)
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  agent_email text,
  total_clients bigint,
  active_clients bigint,
  total_margin numeric,
  total_revenue numeric,
  total_nots numeric,
  agent_commission numeric,
  avg_margin_per_client numeric,
  avg_revenue_per_client numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as agent_id,
    a.name as agent_name,
    a.email as agent_email,
    COUNT(c.id) as total_clients,
    COUNT(CASE WHEN c.overall_margin > 0 THEN 1 END) as active_clients,
    COALESCE(SUM(c.overall_margin), 0) as total_margin,
    COALESCE(SUM(c.monthly_revenue), 0) as total_revenue,
    COALESCE(SUM(c.nots_generated), 0) as total_nots,
    COALESCE(SUM(c.monthly_revenue), 0) * a.commission_rate as agent_commission,
    CASE 
      WHEN COUNT(c.id) > 0 THEN COALESCE(SUM(c.overall_margin), 0) / COUNT(c.id)
      ELSE 0 
    END as avg_margin_per_client,
    CASE 
      WHEN COUNT(c.id) > 0 THEN COALESCE(SUM(c.monthly_revenue), 0) / COUNT(c.id)
      ELSE 0 
    END as avg_revenue_per_client
  FROM agents a
  LEFT JOIN clients c ON c.agent_id = a.id
  WHERE (p_agent_id IS NULL OR a.id = p_agent_id)
    AND a.is_active = true
  GROUP BY a.id, a.name, a.email, a.commission_rate
  ORDER BY total_revenue DESC;
END;
$$;

-- Function to link client to agent
CREATE OR REPLACE FUNCTION link_client_to_agent(p_client_id uuid, p_agent_id uuid)
RETURNS clients
LANGUAGE plpgsql
AS $$
DECLARE
  updated_client clients%ROWTYPE;
BEGIN
  -- Verify agent exists and is active
  IF NOT EXISTS (SELECT 1 FROM agents WHERE id = p_agent_id AND is_active = true) THEN
    RAISE EXCEPTION 'Agent not found or inactive';
  END IF;

  -- Update client with agent link
  UPDATE clients 
  SET agent_id = p_agent_id, updated_at = now()
  WHERE id = p_client_id
  RETURNING * INTO updated_client;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  RETURN updated_client;
END;
$$;

-- Function to unlink client from agent
CREATE OR REPLACE FUNCTION unlink_client_from_agent(p_client_id uuid)
RETURNS clients
LANGUAGE plpgsql
AS $$
DECLARE
  updated_client clients%ROWTYPE;
BEGIN
  UPDATE clients 
  SET agent_id = NULL, updated_at = now()
  WHERE id = p_client_id
  RETURNING * INTO updated_client;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  RETURN updated_client;
END;
$$;

-- Create view for agent performance summary
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
  a.id,
  a.name,
  a.email,
  a.phone,
  a.commission_rate,
  a.is_active,
  a.created_at,
  a.updated_at,
  COUNT(c.id) as client_count,
  COUNT(CASE WHEN c.overall_margin > 0 THEN 1 END) as active_client_count,
  COALESCE(SUM(c.overall_margin), 0) as total_client_margin,
  COALESCE(SUM(c.monthly_revenue), 0) as total_client_revenue,
  COALESCE(SUM(c.nots_generated), 0) as total_client_nots,
  COALESCE(SUM(c.monthly_revenue), 0) * a.commission_rate as estimated_commission
FROM agents a
LEFT JOIN clients c ON c.agent_id = a.id
GROUP BY a.id, a.name, a.email, a.phone, a.commission_rate, a.is_active, a.created_at, a.updated_at
ORDER BY total_client_revenue DESC;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_agent_performance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION link_client_to_agent(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unlink_client_from_agent(uuid) TO authenticated;
GRANT SELECT ON agent_performance_summary TO authenticated;

-- Insert sample agents for development
INSERT INTO agents (name, email, phone, commission_rate) VALUES
  ('John Smith', 'john.smith@pmex.com', '+92-300-1234567', 0.05),
  ('Sarah Johnson', 'sarah.johnson@pmex.com', '+92-301-2345678', 0.04),
  ('Ahmed Ali', 'ahmed.ali@pmex.com', '+92-302-3456789', 0.06),
  ('Maria Garcia', 'maria.garcia@pmex.com', '+92-303-4567890', 0.05)
ON CONFLICT (email) DO NOTHING;