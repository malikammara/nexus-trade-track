// src/constants/evaluationPoints.ts

export type EvaluationPointSection = {
    title: string
    items: string[]
  }
  
  export const evaluationPoints: EvaluationPointSection[] = [
    {
      title: "A. Trading Tasks",
      items: [
        "Daily Trade Calls: Timely calls to clients regarding assigned products.",
        "Stop-Loss Placement: Target accuracy of 9/10 (maximum one error permitted).",
        "Exposure Management: Maintain exposure at 50% of total equity.",
        "Numbers & Targets (NOTs): Achievement of daily and monthly targets, weighted at 30%."
      ]
    },
    {
      title: "B. Discipline and Compliance",
      items: [
        "Accurate trade execution with zero errors.",
        "Correct order placement and reporting/documentation.",
        "Adherence to all trading protocols, PMEX rules, and company policies.",
        "Timely completion of assigned tasks.",
        "Maintenance of accurate client records and trade logs."
      ]
    },
    {
      title: "C. Attitude and Professional Conduct",
      items: [
        "Patience and professionalism in client interactions.",
        "Quality of call handling and daily market-update submissions.",
        "Effective management of client pressure situations."
      ]
    },
    {
      title: "D. Client Metrics",
      items: [
        "Client Retention: Minimum target of 60%.",
        "Margin In: Minimum target of 30%."
      ]
    }
  ]
  