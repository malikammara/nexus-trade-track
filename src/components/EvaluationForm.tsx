import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarIcon, Plus, CreditCard as Edit, ClipboardList } from 'lucide-react'
import { format, startOfWeek } from 'date-fns'
import { cn } from '@/lib/utils'
import { Agent, AgentEvaluation } from '@/types'
import { evaluationPoints } from '@/constants/evaluationPoints'

/** 
 * IMPORTANT: include the three form field names that your UI actually uses:
 * - tone_clarity_remarks
 * - client_satisfaction_remarks
 * - portfolio_revenue_remarks
 * We will map them to canonical keys before submitting.
 */
const evaluationSchema = z.object({
  agent_id: z.string().min(1, 'Agent is required'),
  week_start_date: z.date(),

  // Core 5 criteria
  compliance_score: z.number().min(1).max(5),
  tone_clarity_score: z.number().min(1).max(5),
  relevance_score: z.number().min(1).max(5),
  client_satisfaction_score: z.number().min(1).max(5),
  portfolio_revenue_score: z.number().min(1).max(5),

  // 🔹 NEW: Trading / Discipline / Attitude / Client Metrics
  trading_tasks_score: z.number().min(1).max(5),
  discipline_compliance_score: z.number().min(1).max(5),
  attitude_conduct_score: z.number().min(1).max(5),
  client_metrics_score: z.number().min(1).max(5),

  // Remarks (UI field names)
  compliance_remarks: z.string().optional(),
  tone_clarity_remarks: z.string().optional(),
  relevance_remarks: z.string().optional(),
  client_satisfaction_remarks: z.string().optional(),
  portfolio_revenue_remarks: z.string().optional(),

  // 🔹 NEW remarks
  trading_tasks_remarks: z.string().optional(),
  discipline_compliance_remarks: z.string().optional(),
  attitude_conduct_remarks: z.string().optional(),
  client_metrics_remarks: z.string().optional(),

  overall_remarks: z.string().optional(),

  // (Optional) canonical keys in case something passes them directly
  tone_remarks: z.string().optional(),
  satisfaction_remarks: z.string().optional(),
  portfolio_remarks: z.string().optional(),
})

type EvaluationFormData = z.infer<typeof evaluationSchema>

interface EvaluationFormProps {
  agents: Agent[]
  // accept any so we can pass mapped shape to parent without TS friction
  onSubmit: (data: any) => Promise<void>
  evaluation?: AgentEvaluation
  isEditing?: boolean
}

const criteria = [
  {
    key: 'compliance',
    title: 'Compliance',
    description: 'Calls only via company lines, SOP followed, no WhatsApp advice, privacy ensured.'
  },
  {
    key: 'tone_clarity',
    title: 'Tone & Clarity',
    description: 'Professional, polite, confident, empathetic; clear communication.'
  },
  {
    key: 'relevance',
    title: 'Relevance',
    description: 'Advice matches client profile & needs, stop-loss/margin checks, correct product use.'
  },
  {
    key: 'client_satisfaction',
    title: 'Client Satisfaction',
    description: 'Queries resolved, value delivered, client feels supported and secure.'
  },
  {
    key: 'portfolio_revenue',
    title: 'Portfolio & Revenue Impact',
    description: 'Weekly equity trend, NOTs achieved, exposure within SOP limits, retention effort visible.'
  }
]

// helpers
const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

export function EvaluationForm({ agents, onSubmit, evaluation, isEditing = false }: EvaluationFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Prefill: notice how we feed UI field names from canonical DB fields on edit
  const form = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: evaluation ? {
      agent_id: evaluation.agent_id,
      week_start_date: new Date(evaluation.week_start_date),

      // Core 5
      compliance_score: evaluation.compliance_score,
      tone_clarity_score: evaluation.tone_clarity_score,
      relevance_score: evaluation.relevance_score,
      client_satisfaction_score: evaluation.client_satisfaction_score,
      portfolio_revenue_score: evaluation.portfolio_revenue_score,

      // 🔹 NEW scores – fall back to 3 if missing
      trading_tasks_score: (evaluation as any).trading_tasks_score ?? 3,
      discipline_compliance_score: (evaluation as any).discipline_compliance_score ?? 3,
      attitude_conduct_score: (evaluation as any).attitude_conduct_score ?? 3,
      client_metrics_score: (evaluation as any).client_metrics_score ?? 3,

      // Remarks – existing
      compliance_remarks: evaluation.compliance_remarks ?? '',
      tone_clarity_remarks: evaluation.tone_remarks ?? '',              // map from canonical → UI
      relevance_remarks: evaluation.relevance_remarks ?? '',
      client_satisfaction_remarks: evaluation.satisfaction_remarks ?? '',// map from canonical → UI
      portfolio_revenue_remarks: evaluation.portfolio_remarks ?? '',     // map from canonical → UI

      // 🔹 NEW remarks
      trading_tasks_remarks: (evaluation as any).trading_tasks_remarks ?? '',
      discipline_compliance_remarks: (evaluation as any).discipline_compliance_remarks ?? '',
      attitude_conduct_remarks: (evaluation as any).attitude_conduct_remarks ?? '',
      client_metrics_remarks: (evaluation as any).client_metrics_remarks ?? '',

      overall_remarks: evaluation.overall_remarks ?? '',

      // also allow canonical keys if parent supplies
      tone_remarks: evaluation.tone_remarks ?? '',
      satisfaction_remarks: evaluation.satisfaction_remarks ?? '',
      portfolio_remarks: evaluation.portfolio_remarks ?? '',
    } : {
      agent_id: '',
      week_start_date: startOfWeek(new Date(), { weekStartsOn: 1 }),

      // Core 5
      compliance_score: 3,
      tone_clarity_score: 3,
      relevance_score: 3,
      client_satisfaction_score: 3,
      portfolio_revenue_score: 3,

      // 🔹 NEW scores defaults
      trading_tasks_score: 3,
      discipline_compliance_score: 3,
      attitude_conduct_score: 3,
      client_metrics_score: 3,

      // Remarks
      compliance_remarks: '',
      tone_clarity_remarks: '',
      relevance_remarks: '',
      client_satisfaction_remarks: '',
      portfolio_revenue_remarks: '',

      // 🔹 NEW remarks defaults
      trading_tasks_remarks: '',
      discipline_compliance_remarks: '',
      attitude_conduct_remarks: '',
      client_metrics_remarks: '',

      overall_remarks: '',

      tone_remarks: '',
      satisfaction_remarks: '',
      portfolio_remarks: '',
    }
  })

  const watchedScores = form.watch([
    'compliance_score',
    'tone_clarity_score',
    'relevance_score',
    'client_satisfaction_score',
    'portfolio_revenue_score',
    // 🔹 include the new 4 in total
    'trading_tasks_score',
    'discipline_compliance_score',
    'attitude_conduct_score',
    'client_metrics_score',
  ])

  const totalScore = watchedScores.reduce((sum, score) => sum + (score || 0), 0)

  // Now max = 45 (9 * 5). Thresholds proportionally scaled from old /25:
  // <=60% → Immediate Coaching, <=~76% → Needs Improvement, <=~92% → Strong Performance, else Excellent.
  const getPerformanceLevel = (score: number) => {
    if (score <= 27) {
      return { level: 'Immediate Coaching', color: 'text-destructive', bg: 'bg-destructive/10' }
    }
    if (score <= 34) {
      return { level: 'Needs Improvement', color: 'text-warning', bg: 'bg-warning/10' }
    }
    if (score <= 41) {
      return { level: 'Strong Performance', color: 'text-success', bg: 'bg-success/10' }
    }
    return { level: 'Excellent', color: 'text-trading-profit', bg: 'bg-trading-profit/10' }
  }

  const performance = getPerformanceLevel(totalScore)

  const handleSubmit = async (data: EvaluationFormData) => {
    setLoading(true)
    try {
      // Map UI field names → canonical names expected by your page/hook/DB function
      const mapped = {
        ...data,
        week_start_date: data.week_start_date, // keep Date; page converts to YYYY-MM-DD
        tone_remarks: isNonEmpty(data.tone_remarks)
          ? data.tone_remarks
          : (isNonEmpty(data.tone_clarity_remarks) ? data.tone_clarity_remarks.trim() : ''),
        satisfaction_remarks: isNonEmpty(data.satisfaction_remarks)
          ? data.satisfaction_remarks
          : (isNonEmpty(data.client_satisfaction_remarks) ? data.client_satisfaction_remarks.trim() : ''),
        portfolio_remarks: isNonEmpty(data.portfolio_remarks)
          ? data.portfolio_remarks
          : (isNonEmpty(data.portfolio_revenue_remarks) ? data.portfolio_revenue_remarks.trim() : ''),
      }

      // Optional: log exactly what leaves the form
      console.log('EvaluationForm → submit payload', {
        totalScore,
        trading_tasks_score: mapped.trading_tasks_score,
        discipline_compliance_score: mapped.discipline_compliance_score,
        attitude_conduct_score: mapped.attitude_conduct_score,
        client_metrics_score: mapped.client_metrics_score,
        tone_remarks: mapped.tone_remarks,
        satisfaction_remarks: mapped.satisfaction_remarks,
        portfolio_remarks: mapped.portfolio_remarks,
        compliance_remarks: mapped.compliance_remarks,
        relevance_remarks: mapped.relevance_remarks,
        overall_remarks: mapped.overall_remarks,
      })

      await onSubmit(mapped)
      setOpen(false)
      form.reset()
    } catch (error) {
      console.error('Failed to submit evaluation:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Evaluation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {isEditing ? 'Edit Agent Evaluation' : 'Add Agent Evaluation'}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">Evaluation points</p>
            <p className="text-xs text-muted-foreground">Use these as reference while scoring and adding remarks.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(
              evaluationPoints.reduce((acc, item) => {
                if (!acc[item.category]) acc[item.category] = []
                acc[item.category].push(item)
                return acc
              }, {} as Record<string, typeof evaluationPoints>)
            ).map(([category, items]) => (
              <div key={category} className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{category}</p>

                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                  {items.map((item) => (
                    <li key={item.id}>{item.label}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Agent and Date Selection */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="agent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select agent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agents.filter(a => a.is_active).map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name} ({agent.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="week_start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Week Starting</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick week start date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            if (date) {
                              const monday = startOfWeek(date, { weekStartsOn: 1 })
                              field.onChange(monday)
                            }
                          }}
                          disabled={(date) =>
                            date > new Date() || date < new Date("2024-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Score Summary */}
            <div className={cn("p-4 rounded-lg border-2", performance.bg)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Current Total Score</h3>
                  <p className={cn("text-sm", performance.color)}>
                    {performance.level}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{totalScore}</div>
                  <div className="text-sm text-muted-foreground">out of 45</div>
                </div>
              </div>
            </div>

            {/* Evaluation Criteria – existing 5 */}
            <div className="space-y-6">
              {criteria.map((criterion) => (
                <div key={criterion.key} className="space-y-3 p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{criterion.title}</h4>
                    <p className="text-sm text-muted-foreground">{criterion.description}</p>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`${criterion.key}_score` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Score (1-5)</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              value={field.value?.toString()}
                              className="flex gap-4"
                            >
                              {[1, 2, 3, 4, 5].map((score) => (
                                <div key={score} className="flex items-center space-x-2">
                                  <RadioGroupItem value={score.toString()} id={`${criterion.key}_${score}`} />
                                  <Label htmlFor={`${criterion.key}_${score}`}>{score}</Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`${criterion.key}_remarks` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Remarks (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Add specific feedback..."
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 🔹 A. Trading Tasks */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">A. Trading Tasks</h4>
                <p className="text-sm text-muted-foreground">
                  Daily trade calls, stop-loss accuracy (9/10), exposure at ~50% of equity, NOTs achievement.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="trading_tasks_score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Score (1-5)</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                          className="flex gap-4"
                        >
                          {[1, 2, 3, 4, 5].map((score) => (
                            <div key={score} className="flex items-center space-x-2">
                              <RadioGroupItem value={score.toString()} id={`trading_tasks_${score}`} />
                              <Label htmlFor={`trading_tasks_${score}`}>{score}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trading_tasks_remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Comment on trade calls, SL placement, exposure, NOTs..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 🔹 B. Discipline & Compliance */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">B. Discipline &amp; Compliance</h4>
                <p className="text-sm text-muted-foreground">
                  Accurate execution, correct order placement &amp; reporting, PMEX / SOP adherence, timely task completion, clean logs.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="discipline_compliance_score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Score (1-5)</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                          className="flex gap-4"
                        >
                          {[1, 2, 3, 4, 5].map((score) => (
                            <div key={score} className="flex items-center space-x-2">
                              <RadioGroupItem value={score.toString()} id={`discipline_compliance_${score}`} />
                              <Label htmlFor={`discipline_compliance_${score}`}>{score}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discipline_compliance_remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Execution accuracy, PMEX rules, logs & documentation..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 🔹 C. Attitude & Professional Conduct */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">C. Attitude &amp; Professional Conduct</h4>
                <p className="text-sm text-muted-foreground">
                  Patience, professionalism, call quality, daily market updates, handling client pressure.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="attitude_conduct_score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Score (1-5)</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                          className="flex gap-4"
                        >
                          {[1, 2, 3, 4, 5].map((score) => (
                            <div key={score} className="flex items-center space-x-2">
                              <RadioGroupItem value={score.toString()} id={`attitude_conduct_${score}`} />
                              <Label htmlFor={`attitude_conduct_${score}`}>{score}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="attitude_conduct_remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Comment on patience, tone under pressure, professionalism..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 🔹 D. Client Metrics */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">D. Client Metrics</h4>
                <p className="text-sm text-muted-foreground">
                  Client retention vs 60% target, Margin In vs 30% target, overall client health.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="client_metrics_score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Score (1-5)</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                          className="flex gap-4"
                        >
                          {[1, 2, 3, 4, 5].map((score) => (
                            <div key={score} className="flex items-center space-x-2">
                              <RadioGroupItem value={score.toString()} id={`client_metrics_${score}`} />
                              <Label htmlFor={`client_metrics_${score}`}>{score}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_metrics_remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Retention % vs target, Margin In quality, key client outcomes..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Overall Remarks */}
            <FormField
              control={form.control}
              name="overall_remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Overall Remarks</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add overall feedback and recommendations..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : isEditing ? 'Update Evaluation' : 'Add Evaluation'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
