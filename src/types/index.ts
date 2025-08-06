export interface Client {
  id: string;
  name: string;
  margin_in: number;
  overall_margin: number;
  invested_amount: number;
  monthly_revenue: number;
  nots_generated: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  commission_usd: number;
  tick_size: number;
  tick_value: number;
  price_quote: number;
  created_at: string;
}

export interface MonthlyPerformance {
  id: string;
  client_id: string;
  month: number;
  year: number;
  margin_in: number;
  overall_margin: number;
  revenue_generated: number;
  nots_achieved: number;
  created_at: string;
  client?: Client;
}

export interface DailyPerformance {
  id: string;
  client_id: string;
  entry_date: string;
  margin_in: number;
  overall_margin: number;
  created_at: string;
  client?: Client;
}

export interface TeamSettings {
  id: string;
  commission_threshold_pkr: number;
  nots_target_per_client: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_clients: number;
  total_margin_in: number;
  total_overall_margin: number;
  total_monthly_revenue: number;
  total_nots: number;
  target_nots: number;
  progress_percentage: number;
}