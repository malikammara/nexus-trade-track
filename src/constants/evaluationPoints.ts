// src/constants/evaluationPoints.ts
export type EvaluationItem = {
  id: string
  label: string
  description: string
  category: string
}

export const evaluationPoints: EvaluationItem[] = [
  {
    id: 'compliance',
    label: 'Compliance',
    description:
      'Calls only via company lines, SOP followed, no WhatsApp advice, privacy ensured.',
    category: 'Core Criteria',
  },
  {
    id: 'tone_clarity',
    label: 'Tone & Clarity',
    description:
      'Professional, polite, confident, empathetic; clear and composed communication.',
    category: 'Core Criteria',
  },
  {
    id: 'relevance',
    label: 'Relevance',
    description:
      'Advice matches client profile & needs, correct product selection, proper risk checks.',
    category: 'Core Criteria',
  },
  {
    id: 'client_satisfaction',
    label: 'Client Satisfaction',
    description:
      'Queries resolved, value delivered, client feels supported, informed, and secure.',
    category: 'Core Criteria',
  },
  {
    id: 'portfolio_revenue',
    label: 'Portfolio & Revenue Impact',
    description:
      'Weekly equity trend, NOTs achieved, exposure within SOP limits, visible retention effort.',
    category: 'Core Criteria',
  },
  {
    id: "daily_trade_calls",
    label: "Daily Trade Calls",
    description: "Timely calls to clients regarding assigned products.",
    category: "Trading Tasks",
  },
  {
    id: "stop_loss_accuracy",
    label: "Stop-Loss Placement Accuracy",
    description: "Target accuracy of 9/10 (only one error permitted).",
    category: "Trading Tasks",
  },
  {
    id: "exposure_management",
    label: "Exposure Management",
    description: "Maintain exposure at 50% of total equity.",
    category: "Trading Tasks",
  },
  {
    id: "not_achievement",
    label: "NOT (Numbers & Targets) Achievement",
    description: "Daily + monthly NOTs achieved (weighted at 30%).",
    category: "Trading Tasks",
  },

  {
    id: "accurate_trade_execution",
    label: "Accurate Trade Execution",
    description: "Zero-error execution of all trades.",
    category: "Discipline & Compliance",
  },
  {
    id: "correct_order_placement",
    label: "Correct Order Placement",
    description: "All orders placed correctly with documentation.",
    category: "Discipline & Compliance",
  },
  {
    id: "protocol_adherence",
    label: "Protocol & PMEX Rule Adherence",
    description: "Full compliance with SOPs, company rules, PMEX rules.",
    category: "Discipline & Compliance",
  },
  {
    id: "task_timeliness",
    label: "Timely Completion of Tasks",
    description: "All assignments completed on schedule.",
    category: "Discipline & Compliance",
  },
  {
    id: "record_maintenance",
    label: "Record & Log Maintenance",
    description: "Accurate client records, call logs, and trade logs.",
    category: "Discipline & Compliance",
  },

  {
    id: "client_professionalism",
    label: "Professional Interaction",
    description: "Patience, respectful tone, and professionalism.",
    category: "Attitude & Professional Conduct",
  },
  {
    id: "call_quality",
    label: "Call Quality & Market Updates",
    description: "Effective calls; timely and accurate market updates.",
    category: "Attitude & Professional Conduct",
  },
  {
    id: "pressure_handling",
    label: "Pressure Handling",
    description: "Ability to manage client pressure situations.",
    category: "Attitude & Professional Conduct",
  },

  {
    id: "client_retention",
    label: "Client Retention",
    description: "Retention performance against a 60% required benchmark.",
    category: "Client Metrics",
  },
  {
    id: "margin_in",
    label: "Margin In",
    description: "Achieved margin-in vs target of 30%.",
    category: "Client Metrics",
  },
];
