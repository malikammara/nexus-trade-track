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

// Build a dynamic Zod schema from evaluationPoints
const buildSchema = () => {
  const baseShape: Record<string, z.ZodTypeAny> = {
    agent_id: z.string().min(1, 'Agent is required'),
    week_start_date: z.date(),
    overall_remarks: z.string().optional(),
  }

  evaluationPoints.forEach((item) => {
    baseShape[`${item.id}_score`] = z.number().min(1).max(5)
    baseShape[`${item.id}_remarks`] = z.string().optional()
  })

  return z.object(baseShape)
}

const evaluationSchema = buildSchema()
type EvaluationFormData = z.infer<typeof evaluationSchema>

interface EvaluationFormProps {
  agents: Agent[]
  // accept any so we can pass mapped shape to parent without TS friction
  onSubmit: (data: any) => Promise<void>
  evaluation?: AgentEvaluation
  isEditing?: boolean
}

// helpers
const toYMD = (d: Date | string) =>
  typeof d === 'string' ? (d.includes('T') ? d.split('T')[0] : d) : new Date(d).toISOString().split('T')[0]

export function EvaluationForm({ agents, onSubmit, evaluation, isEditing = false }: EvaluationFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Build defaultValues dynamically from evaluation or defaults
  const defaultValues: any = evaluation
    ? (() => {
        const base: any = {
          agent_id: evaluation.agent_id,
          week_start_date: new Date(evaluation.week_start_date),
          overall_remarks: evaluation.overall_remarks ?? '',
        }

        const scores = (evaluation as any).criteria_scores ?? {}
        const remarks = (evaluation as any).criteria_remarks ?? {}

        evaluationPoints.forEach((item) => {
          base[`${item.id}_score`] = typeof scores[item.id] === 'number' ? scores[item.id] : 3
          base[`${item.id}_remarks`] = remarks[item.id] ?? ''
        })

        return base
      })()
    : (() => {
        const base: any = {
          agent_id: '',
          week_start_date: startOfWeek(new Date(), { weekStartsOn: 1 }),
          overall_remarks: '',
        }

        evaluationPoints.forEach((item) => {
          base[`${item.id}_score`] = 3
          base[`${item.id}_remarks`] = ''
        })

        return base
      })()

  const form = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues,
  })

  // Watch all scores to compute total
  const watchedScores = form.watch(
    evaluationPoints.map((item) => `${item.id}_score`) as (keyof EvaluationFormData)[]
  )

  const totalScore = watchedScores.reduce((sum, value) => sum + (Number(value) || 0), 0)

  // Max score = number of items * 5
  const maxScore = evaluationPoints.length * 5

  // Performance bands for /70 (if 14 items)
  const getPerformanceLevel = (score: number) => {
    if (score <= maxScore * 0.6) {
      return { level: 'Immediate Coaching', color: 'text-destructive', bg: 'bg-destructive/10' }
    }
    if (score <= maxScore * 0.75) {
      return { level: 'Needs Improvement', color: 'text-warning', bg: 'bg-warning/10' }
    }
    if (score <= maxScore * 0.9) {
      return { level: 'Strong Performance', color: 'text-success', bg: 'bg-success/10' }
    }
    return { level: 'Excellent', color: 'text-trading-profit', bg: 'bg-trading-profit/10' }
  }

  const performance = getPerformanceLevel(totalScore)

  const handleSubmit = async (data: EvaluationFormData) => {
    setLoading(true)
    try {
      // Extract criteria_scores & criteria_remarks from dynamic fields
      const criteria_scores: Record<string, number> = {}
      const criteria_remarks: Record<string, string | null> = {}

      evaluationPoints.forEach((item) => {
        const scoreKey = `${item.id}_score` as keyof EvaluationFormData
        const remarksKey = `${item.id}_remarks` as keyof EvaluationFormData

        criteria_scores[item.id] = Number(data[scoreKey] || 0)
        const rawRemarks = data[remarksKey]
        criteria_remarks[item.id] =
          typeof rawRemarks === 'string' && rawRemarks.trim().length > 0 ? rawRemarks.trim() : null
      })

      const mapped = {
        agent_id: data.agent_id,
        week_start_date: data.week_start_date, // page/hook will format
        criteria_scores,
        criteria_remarks,
        overall_remarks:
          typeof data.overall_remarks === 'string' && data.overall_remarks.trim().length > 0
            ? data.overall_remarks.trim()
            : null,
      }

      console.log('EvaluationForm → submit payload', mapped)

      await onSubmit(mapped)
      setOpen(false)
      form.reset()
    } catch (error) {
      console.error('Failed to submit evaluation:', error)
    } finally {
      setLoading(false)
    }
  }

  // Group evaluation points by category for the instructions box
  const groupedByCategory = evaluationPoints.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, typeof evaluationPoints>)

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
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {isEditing ? 'Edit Agent Evaluation' : 'Add Agent Evaluation'}
          </DialogTitle>
        </DialogHeader>

        {/* Reference evaluation points */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">Evaluation points</p>
            <p className="text-xs text-muted-foreground">Each point is scored 1–5; use these as a checklist.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(groupedByCategory).map(([category, items]) => (
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
                        {agents
                          .filter((a) => a.is_active)
                          .map((agent) => (
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
                            className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
                            {field.value ? format(field.value, 'PPP') : <span>Pick week start date</span>}
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
                          disabled={(date) => date > new Date() || date < new Date('2024-01-01')}
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
            <div className={cn('p-4 rounded-lg border-2', performance.bg)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Current Total Score</h3>
                  <p className={cn('text-sm', performance.color)}>{performance.level}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{totalScore}</div>
                  <div className="text-sm text-muted-foreground">out of {maxScore}</div>
                </div>
              </div>
            </div>

            {/* Evaluation Criteria – one block per granular point */}
            <div className="space-y-6">
              {evaluationPoints.map((item) => (
                <div key={item.id} className="space-y-3 p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">
                      {item.label}{' '}
                      <span className="ml-2 text-xs text-muted-foreground">({item.category})</span>
                    </h4>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`${item.id}_score` as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Score (1-5)</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              value={field.value?.toString()}
                              className="flex flex-wrap gap-4"
                            >
                              {[1, 2, 3, 4, 5].map((score) => (
                                <div key={score} className="flex items-center space-x-2">
                                  <RadioGroupItem value={score.toString()} id={`${item.id}_${score}`} />
                                  <Label htmlFor={`${item.id}_${score}`}>{score}</Label>
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
                      name={`${item.id}_remarks` as any}
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
