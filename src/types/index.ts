export interface Client {
  id: string;
  name: string;
  margin_in: number;
  overall_margin: number;
  invested_amount: number;
  monthly_revenue: number;
  nots_generated: number;
  agent_id?: string;
  created_at: string;
  updated_at: string;
  is_new_client?: boolean;
  agent?: Agent;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  commission_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  client_count?: number;
  active_client_count?: number;
  total_client_margin?: number;
  total_client_revenue?: number;
  total_client_nots?: number;
  estimated_commission?: number;
}

export interface AgentPerformance {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  total_clients: number;
  active_clients: number;
  total_margin: number;
  total_revenue: number;
  total_nots: number;
  agent_commission: number;
  avg_margin_per_client: number;
  avg_revenue_per_client: number;
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

export interface AgentEvaluation {
  id: string;
  agent_id: string;
  week_start_date: string;
  compliance_score: number;
  tone_clarity_score: number;
  relevance_score: number;
  client_satisfaction_score: number;
  portfolio_revenue_score: number;
  total_score: number;
  compliance_remarks?: string;
  tone_remarks?: string;
  relevance_remarks?: string;
  satisfaction_remarks?: string;
  portfolio_remarks?: string;
  overall_remarks?: string;
  evaluated_by: string;
  created_at: string;
  updated_at: string;
  agent_name?: string;
  agent_email?: string;
  performance_level?: string;
  alert_message?: string;
}

export interface EvaluationAlert {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  total_score: number;
  week_start_date: string;
  alert_message: string;
  alert_level: 'critical' | 'warning' | 'good' | 'excellent' | 'none';
}

export interface DashboardStats {
  total_clients: number;
  total_margin_in: number;
  total_overall_margin: number;
  total_monthly_revenue: number;
  total_nots: number;
  target_nots: number;
  progress_percentage: number;
  daily_target_nots: number;
  weekly_target_nots: number;
}

export type NewClient = {
  name: string;
  margin_in: number;
  overall_margin: number;
  invested_amount: number;
  monthly_revenue: number;
};
