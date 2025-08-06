/*
  # Create team settings table

  1. New Tables
    - `team_settings`
      - `id` (uuid, primary key)
      - `commission_threshold_pkr` (numeric, default 6000) - PKR amount = 1 NOT
      - `nots_target_per_client` (integer, default 50) - Monthly target NOTs per client
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `team_settings` table
    - Add policies for authenticated users to read and admin to manage
    - Insert default settings row
*/

CREATE TABLE IF NOT EXISTS team_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_threshold_pkr numeric DEFAULT 6000 CHECK (commission_threshold_pkr > 0),
  nots_target_per_client integer DEFAULT 50 CHECK (nots_target_per_client > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE team_settings ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read team settings
CREATE POLICY "Authenticated users can read team settings"
  ON team_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for admin users to update team settings
CREATE POLICY "Admin users can update team settings"
  ON team_settings
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- Policy for admin users to insert team settings
CREATE POLICY "Admin users can insert team settings"
  ON team_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- Create updated_at trigger for team_settings
CREATE TRIGGER update_team_settings_updated_at
  BEFORE UPDATE ON team_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO team_settings (commission_threshold_pkr, nots_target_per_client)
VALUES (6000, 50)
ON CONFLICT DO NOTHING;