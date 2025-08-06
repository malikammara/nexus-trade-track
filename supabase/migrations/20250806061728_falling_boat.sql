/*
  # Create clients table

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null)
      - `margin_in` (numeric, default 0) - CS margin generated
      - `overall_margin` (numeric, default 0) - Total margin including other sources
      - `invested_amount` (numeric, default 0) - Amount invested by client
      - `monthly_revenue` (numeric, default 0) - Monthly revenue generated
      - `nots_generated` (integer, default 0) - Number of NOTs generated
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `clients` table
    - Add policy for authenticated users to read all clients
    - Add policy for admin users to manage clients
*/

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  margin_in numeric DEFAULT 0 CHECK (margin_in >= 0),
  overall_margin numeric DEFAULT 0 CHECK (overall_margin >= 0),
  invested_amount numeric DEFAULT 0 CHECK (invested_amount >= 0),
  monthly_revenue numeric DEFAULT 0 CHECK (monthly_revenue >= 0),
  nots_generated integer DEFAULT 0 CHECK (nots_generated >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all clients
CREATE POLICY "Authenticated users can read clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for admin users to insert clients
CREATE POLICY "Admin users can insert clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- Policy for admin users to update clients
CREATE POLICY "Admin users can update clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- Policy for admin users to delete clients
CREATE POLICY "Admin users can delete clients"
  ON clients
  FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();