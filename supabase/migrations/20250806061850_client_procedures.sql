/*
  # Client management procedures and daily performance table

  1. New Tables
    - `daily_performance`
      - Tracks daily margin and equity per client
  2. New Functions
    - `add_client`
    - `update_client`
    - `add_daily_margin`
*/

-- Create daily_performance table
CREATE TABLE IF NOT EXISTS daily_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  entry_date date DEFAULT CURRENT_DATE,
  margin_in numeric DEFAULT 0 CHECK (margin_in >= 0),
  overall_margin numeric DEFAULT 0 CHECK (overall_margin >= 0),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on daily_performance
ALTER TABLE daily_performance ENABLE ROW LEVEL SECURITY;

-- Policies for daily_performance
CREATE POLICY "Authenticated users can read daily performance"
  ON daily_performance
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert daily performance"
  ON daily_performance
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

CREATE POLICY "Admin users can update daily performance"
  ON daily_performance
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

CREATE POLICY "Admin users can delete daily performance"
  ON daily_performance
  FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- Function to add a new client
CREATE OR REPLACE FUNCTION add_client(
  name text,
  margin_in numeric DEFAULT 0,
  overall_margin numeric DEFAULT 0,
  invested_amount numeric DEFAULT 0,
  monthly_revenue numeric DEFAULT 0
)
RETURNS clients
LANGUAGE plpgsql
AS $$
DECLARE
  new_client clients%ROWTYPE;
BEGIN
  INSERT INTO clients(name, margin_in, overall_margin, invested_amount, monthly_revenue)
  VALUES (
    add_client.name,
    add_client.margin_in,
    add_client.overall_margin,
    add_client.invested_amount,
    add_client.monthly_revenue
  )
  RETURNING * INTO new_client;

  RETURN new_client;
END;
$$;

GRANT EXECUTE ON FUNCTION add_client(text, numeric, numeric, numeric, numeric) TO authenticated;

-- Function to update an existing client
CREATE OR REPLACE FUNCTION update_client(
  id uuid,
  name text,
  margin_in numeric,
  overall_margin numeric,
  invested_amount numeric,
  monthly_revenue numeric
)
RETURNS clients
LANGUAGE plpgsql
AS $$
DECLARE
  updated_client clients%ROWTYPE;
BEGIN
  UPDATE clients
  SET
    name = COALESCE(update_client.name, clients.name),
    margin_in = COALESCE(update_client.margin_in, clients.margin_in),
    overall_margin = COALESCE(update_client.overall_margin, clients.overall_margin),
    invested_amount = COALESCE(update_client.invested_amount, clients.invested_amount),
    monthly_revenue = COALESCE(update_client.monthly_revenue, clients.monthly_revenue),
    nots_generated = calculate_client_nots(COALESCE(update_client.margin_in, clients.margin_in))
  WHERE clients.id = update_client.id
  RETURNING * INTO updated_client;

  RETURN updated_client;
END;
$$;

GRANT EXECUTE ON FUNCTION update_client(uuid, text, numeric, numeric, numeric, numeric) TO authenticated;

-- Function to add daily margin/equity for a client
CREATE OR REPLACE FUNCTION add_daily_margin(
  client_id uuid,
  margin_in numeric,
  overall_margin numeric,
  entry_date date DEFAULT CURRENT_DATE
)
RETURNS clients
LANGUAGE plpgsql
AS $$
DECLARE
  updated_client clients%ROWTYPE;
  v_month integer := EXTRACT(MONTH FROM add_daily_margin.entry_date);
  v_year integer := EXTRACT(YEAR FROM add_daily_margin.entry_date);
BEGIN
  INSERT INTO daily_performance (client_id, entry_date, margin_in, overall_margin)
  VALUES (add_daily_margin.client_id, add_daily_margin.entry_date, add_daily_margin.margin_in, add_daily_margin.overall_margin);

  UPDATE clients
  SET
    margin_in = clients.margin_in + add_daily_margin.margin_in,
    overall_margin = clients.overall_margin + add_daily_margin.overall_margin,
    nots_generated = calculate_client_nots(clients.margin_in + add_daily_margin.margin_in)
  WHERE clients.id = add_daily_margin.client_id
  RETURNING * INTO updated_client;

  INSERT INTO monthly_performance (client_id, month, year, margin_in, overall_margin, revenue_generated, nots_achieved)
  VALUES (add_daily_margin.client_id, v_month, v_year, add_daily_margin.margin_in, add_daily_margin.overall_margin, 0, calculate_client_nots(add_daily_margin.margin_in))
  ON CONFLICT (client_id, month, year) DO UPDATE
    SET margin_in = monthly_performance.margin_in + EXCLUDED.margin_in,
        overall_margin = monthly_performance.overall_margin + EXCLUDED.overall_margin,
        nots_achieved = calculate_client_nots(monthly_performance.margin_in + EXCLUDED.margin_in);

  RETURN updated_client;
END;
$$;

GRANT EXECUTE ON FUNCTION add_daily_margin(uuid, numeric, numeric, date) TO authenticated;
