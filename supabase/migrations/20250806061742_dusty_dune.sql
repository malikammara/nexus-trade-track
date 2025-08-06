/*
  # Create monthly performance tracking table

  1. New Tables
    - `monthly_performance`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `month` (integer, 1-12)
      - `year` (integer)
      - `margin_in` (numeric, default 0) - CS margin for this month
      - `overall_margin` (numeric, default 0) - Total margin for this month
      - `revenue_generated` (numeric, default 0) - Revenue generated this month
      - `nots_achieved` (integer, default 0) - NOTs achieved this month
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `monthly_performance` table
    - Add policies for authenticated users to read and admin to manage
    - Add unique constraint on client_id, month, year combination
*/

CREATE TABLE IF NOT EXISTS monthly_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2020),
  margin_in numeric DEFAULT 0 CHECK (margin_in >= 0),
  overall_margin numeric DEFAULT 0 CHECK (overall_margin >= 0),
  revenue_generated numeric DEFAULT 0 CHECK (revenue_generated >= 0),
  nots_achieved integer DEFAULT 0 CHECK (nots_achieved >= 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, month, year)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_monthly_performance_client_date 
  ON monthly_performance(client_id, year, month);

CREATE INDEX IF NOT EXISTS idx_monthly_performance_date 
  ON monthly_performance(year, month);

-- Enable RLS
ALTER TABLE monthly_performance ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all monthly performance data
CREATE POLICY "Authenticated users can read monthly performance"
  ON monthly_performance
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for admin users to insert monthly performance
CREATE POLICY "Admin users can insert monthly performance"
  ON monthly_performance
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- Policy for admin users to update monthly performance
CREATE POLICY "Admin users can update monthly performance"
  ON monthly_performance
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- Policy for admin users to delete monthly performance
CREATE POLICY "Admin users can delete monthly performance"
  ON monthly_performance
  FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');