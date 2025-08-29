/*
  # Add new client toggle functionality

  1. Table Modifications
    - Add `is_new_client` column to `clients` table for tracking new vs existing clients

  2. Function Updates
    - Update `add_client` function to handle new client flag
    - Update `update_client` function to handle new client flag

  3. Enhanced Analytics
    - Distinguish between new deposits (new clients) and margin-in (existing clients)
    - Better tracking for monthly performance analysis
*/

-- Add is_new_client column to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'is_new_client'
  ) THEN
    ALTER TABLE clients ADD COLUMN is_new_client boolean DEFAULT false;
  END IF;
END $$;

-- Update add_client function to handle new client flag
CREATE OR REPLACE FUNCTION add_client(
  name text,
  overall_margin numeric DEFAULT 0,
  is_new_client boolean DEFAULT false
)
RETURNS clients
LANGUAGE plpgsql
AS $$
DECLARE
  new_client clients%ROWTYPE;
BEGIN
  INSERT INTO clients(name, overall_margin, is_new_client)
  VALUES (
    add_client.name,
    add_client.overall_margin,
    add_client.is_new_client
  )
  RETURNING * INTO new_client;

  RETURN new_client;
END;
$$;

-- Update update_client function to handle new client flag
CREATE OR REPLACE FUNCTION update_client(
  id uuid,
  name text DEFAULT NULL,
  overall_margin numeric DEFAULT NULL,
  is_new_client boolean DEFAULT NULL
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
    overall_margin = COALESCE(update_client.overall_margin, clients.overall_margin),
    is_new_client = COALESCE(update_client.is_new_client, clients.is_new_client),
    updated_at = now()
  WHERE clients.id = update_client.id
  RETURNING * INTO updated_client;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  RETURN updated_client;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION add_client(text, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION update_client(uuid, text, numeric, boolean) TO authenticated;