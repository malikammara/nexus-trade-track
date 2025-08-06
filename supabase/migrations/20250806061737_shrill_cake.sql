/*
  # Create products table

  1. New Tables
    - `products`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null) - Product name (e.g., EUR/USD, Gold, Bitcoin)
      - `commission_usd` (numeric, not null) - Commission in USD
      - `tick_size` (numeric, not null) - Minimum price movement
      - `tick_value` (numeric, not null) - Value of one tick in USD
      - `price_quote` (numeric, not null) - Current market price
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `products` table
    - Add policy for authenticated users to read all products
    - Add policy for admin users to manage products
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  commission_usd numeric NOT NULL CHECK (commission_usd >= 0),
  tick_size numeric NOT NULL CHECK (tick_size > 0),
  tick_value numeric NOT NULL CHECK (tick_value > 0),
  price_quote numeric NOT NULL CHECK (price_quote > 0),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all products
CREATE POLICY "Authenticated users can read products"
  ON products
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for admin users to insert products
CREATE POLICY "Admin users can insert products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- Policy for admin users to update products
CREATE POLICY "Admin users can update products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');

-- Policy for admin users to delete products
CREATE POLICY "Admin users can delete products"
  ON products
  FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'doctorcrack007@gmail.com');