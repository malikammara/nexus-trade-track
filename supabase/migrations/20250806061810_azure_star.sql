/*
  # Seed sample data for development

  1. Sample Data
    - Insert sample products (Forex, Commodities, Indices, Crypto, Stocks)
    - Insert sample clients with realistic data
    - Insert sample monthly performance records

  2. Notes
    - This is for development/testing purposes
    - Data reflects realistic trading scenarios
*/

-- Insert sample products
INSERT INTO products (name, commission_usd, tick_size, tick_value, price_quote) VALUES
  ('EUR/USD', 25.00, 0.00001, 1.00, 1.0875),
  ('GBP/USD', 30.00, 0.00001, 1.00, 1.2650),
  ('USD/JPY', 25.00, 0.001, 1.00, 149.85),
  ('Gold (XAU/USD)', 50.00, 0.01, 1.00, 2045.50),
  ('Silver (XAG/USD)', 40.00, 0.001, 1.00, 24.85),
  ('S&P 500', 40.00, 0.25, 12.50, 4575.25),
  ('NASDAQ 100', 45.00, 0.25, 5.00, 15850.75),
  ('Bitcoin (BTC/USD)', 75.00, 1.00, 1.00, 43250.00),
  ('Ethereum (ETH/USD)', 50.00, 0.01, 1.00, 2680.50),
  ('Tesla (TSLA)', 30.00, 0.01, 1.00, 248.50),
  ('Apple (AAPL)', 25.00, 0.01, 1.00, 192.75),
  ('WTI Crude Oil', 45.00, 0.01, 1.00, 78.50)
ON CONFLICT (name) DO NOTHING;

-- Insert sample clients
INSERT INTO clients (name, margin_in, overall_margin, invested_amount, monthly_revenue, nots_generated) VALUES
  ('Ahmed Khan Trading Co.', 185000, 245000, 500000, 75000, 15),
  ('Karachi Investment Group', 145000, 195000, 400000, 65000, 12),
  ('Lahore Capital Partners', 125000, 175000, 350000, 55000, 10),
  ('Islamabad Forex Solutions', 165000, 215000, 450000, 68000, 13),
  ('Multan Trading House', 95000, 135000, 280000, 42000, 8),
  ('Faisalabad Investment Co.', 115000, 155000, 320000, 48000, 9),
  ('Peshawar Capital Group', 135000, 185000, 380000, 58000, 11),
  ('Quetta Trading Partners', 85000, 125000, 250000, 38000, 7),
  ('Sialkot Investment Ltd.', 105000, 145000, 300000, 45000, 8),
  ('Gujranwala Forex Hub', 155000, 205000, 420000, 62000, 12),
  ('Rawalpindi Trading Co.', 175000, 225000, 480000, 72000, 14),
  ('Hyderabad Capital Solutions', 125000, 165000, 340000, 52000, 10)
ON CONFLICT (name) DO NOTHING;

-- Insert sample monthly performance data for the last 3 months
DO $$
DECLARE
  client_record RECORD;
  current_month integer := EXTRACT(MONTH FROM CURRENT_DATE);
  current_year integer := EXTRACT(YEAR FROM CURRENT_DATE);
  month_offset integer;
  target_month integer;
  target_year integer;
BEGIN
  -- Loop through last 3 months
  FOR month_offset IN 0..2 LOOP
    target_month := current_month - month_offset;
    target_year := current_year;
    
    -- Handle year rollover
    IF target_month <= 0 THEN
      target_month := target_month + 12;
      target_year := target_year - 1;
    END IF;
    
    -- Insert performance data for each client
    FOR client_record IN SELECT id, margin_in, overall_margin, monthly_revenue, nots_generated FROM clients LOOP
      INSERT INTO monthly_performance (
        client_id, 
        month, 
        year, 
        margin_in, 
        overall_margin, 
        revenue_generated, 
        nots_achieved
      ) VALUES (
        client_record.id,
        target_month,
        target_year,
        -- Vary the monthly data slightly from current totals
        client_record.margin_in * (0.8 + (month_offset * 0.1) + (random() * 0.2)),
        client_record.overall_margin * (0.8 + (month_offset * 0.1) + (random() * 0.2)),
        client_record.monthly_revenue * (0.8 + (month_offset * 0.1) + (random() * 0.2)),
        GREATEST(1, client_record.nots_generated + FLOOR((random() - 0.5) * 4)::integer)
      ) ON CONFLICT (client_id, month, year) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;