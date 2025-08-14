/*
  # Add specific trading products for CS team suggestions

  1. Products Added
    - Crude Oil (WTI) - Crude-100
    - Gold (XAU/USD) - Gold-1oz  
    - NASDAQ 100 Index - Nasdaq-100

  2. Notes
    - These are the three main products for CS team trade suggestions
    - Commission rates are in USD and will be converted to PKR in frontend
    - Realistic market prices and commission structures
*/

-- Insert the three main trading products for CS suggestions
INSERT INTO products (name, commission_usd, tick_size, tick_value, price_quote) VALUES
  ('Crude-100 (WTI Oil)', 45.00, 0.01, 1.00, 78.50),
  ('Gold-1oz (XAU/USD)', 50.00, 0.01, 1.00, 2045.50),
  ('Nasdaq-100 Index', 45.00, 0.25, 5.00, 15850.75)
ON CONFLICT (name) DO UPDATE SET
  commission_usd = EXCLUDED.commission_usd,
  tick_size = EXCLUDED.tick_size,
  tick_value = EXCLUDED.tick_value,
  price_quote = EXCLUDED.price_quote;

-- Update existing similar products if they exist
UPDATE products 
SET commission_usd = 45.00, tick_size = 0.01, tick_value = 1.00, price_quote = 78.50
WHERE name ILIKE '%crude%' OR name ILIKE '%oil%';

UPDATE products 
SET commission_usd = 50.00, tick_size = 0.01, tick_value = 1.00, price_quote = 2045.50
WHERE name ILIKE '%gold%' OR name ILIKE '%xau%';

UPDATE products 
SET commission_usd = 45.00, tick_size = 0.25, tick_value = 5.00, price_quote = 15850.75
WHERE name ILIKE '%nasdaq%';