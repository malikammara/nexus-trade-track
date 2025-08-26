import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Link, Unlink } from 'lucide-react'
import { Agent, Client } from '@/types'
import { useAuth } from '@/contexts/AuthProvider'
import { useClients } from '@/hooks/useClients'
import { useAgents } from '@/hooks/useAgents'
import { useToast } from '@/hooks/use-toast'

interface ClientAgentLinkFormProps {
  client?: Client
  agent?: Agent
  onSuccess?: () => void
}

export function ClientAgentLinkForm({ client, agent, onSuccess }: ClientAgentLinkFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const { isAdmin } = useAuth()
  const { clients, refetch: refetchClients } = useClients()
  const { agents, linkClientToAgent, unlinkClientFromAgent } = useAgents()
  const { toast } = useToast()

  // Filter clients and agents based on props
  const availableClients = client ? [client] : clients.filter(c => !c.agent_id)
  const availableAgents = agent ? [agent] : agents.filter(a => a.is_active)

  useEffect(() => {
    if (client) setSelectedClientId(client.id)
    if (agent) setSelectedAgentId(agent.id)
  }, [client, agent])

  if (!isAdmin) return null

  const handleLink = async () => {
    if (!selectedClientId || !selectedAgentId) {
      toast({
        title: "Selection Required",
        description: "Please select both a client and an agent.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      await linkClientToAgent(selectedClientId, selectedAgentId)
      await refetchClients()
      
      const clientName = clients.find(c => c.id === selectedClientId)?.name
      const agentName = agents.find(a => a.id === selectedAgentId)?.name
      
      toast({
        title: "Client Linked",
        description: `${clientName} has been linked to ${agentName}.`
      })
      
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to link client to agent.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUnlink = async () => {
    if (!selectedClientId) return

    setLoading(true)
    try {
      await unlinkClientFromAgent(selectedClientId)
      await refetchClients()
      
      const clientName = clients.find(c => c.id === selectedClientId)?.name
      
      toast({
        title: "Client Unlinked",
        description: `${clientName} has been unlinked from their agent.`
      })
      
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unlink client from agent.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const isUnlinkMode = client && client.agent_id
  const buttonIcon = isUnlinkMode ? Unlink : Link
  const buttonText = isUnlinkMode ? "Unlink Agent" : "Link to Agent"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <buttonIcon className="h-4 w-4 mr-1" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isUnlinkMode ? 'Unlink Client from Agent' : 'Link Client to Agent'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!client && (
            <div className="space-y-2">
              <Label htmlFor="client-select">Select Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {availableClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isUnlinkMode && !agent && (
            <div className="space-y-2">
              <Label htmlFor="agent-select">Select Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({(a.commission_rate * 100).toFixed(1)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isUnlinkMode && client && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>{client.name}</strong> is currently linked to their agent.
                This action will remove the agent assignment.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={isUnlinkMode ? handleUnlink : handleLink}
              disabled={loading || (!isUnlinkMode && (!selectedClientId || !selectedAgentId))}
              variant={isUnlinkMode ? "destructive" : "default"}
            >
              {loading ? 'Processing...' : buttonText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}