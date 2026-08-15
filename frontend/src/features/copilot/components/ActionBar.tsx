import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendReplyToLead, toggleLeadAutonomy } from '../services/chatApi';
import { api } from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import { Send, AlertTriangle, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ActionBarProps {
  leadId: string;
  draftContent: string;
  setDraftContent: (content: string) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({ leadId, draftContent, setDraftContent }) => {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();
  const [isManualRequired, setIsManualRequired] = useState(false);

  // Listen for HITL alerts
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleManualIntervention = (data: { leadId: string }) => {
      if (data.leadId === leadId) {
        setIsManualRequired(true);
      }
    };

    socket.on('lead.manual_intervention_required', handleManualIntervention);

    return () => {
      socket.off('lead.manual_intervention_required', handleManualIntervention);
    };
  }, [socket, isConnected, leadId]);

  // Reset state on lead change
  useEffect(() => {
    setIsManualRequired(false);
    setDraftContent('');
  }, [leadId, setDraftContent]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendReplyToLead(leadId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', leadId] });
      setDraftContent('');
    },
    onError: () => {
      toast.error('Erro ao enviar mensagem.');
    }
  });

  const toggleAutonomyMutation = useMutation({
    mutationFn: (requiresManual: boolean) => toggleLeadAutonomy(leadId, requiresManual),
    onSuccess: (_, variables) => {
      setIsManualRequired(variables);
      toast.success(variables ? 'Agente pausado.' : 'Agente reativado.');
    },
    onError: () => {
      toast.error('Erro ao alterar autonomia do agente.');
    }
  });

  const generateDraftMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/chats/${leadId}/draft`);
      return response.data;
    },
    onSuccess: (data) => {
      setDraftContent(data.draft);
      toast.success('Rascunho gerado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao gerar rascunho com IA.');
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftContent.trim()) return;
    sendMutation.mutate(draftContent);
  };

  const handleToggleAutonomy = () => {
    toggleAutonomyMutation.mutate(!isManualRequired);
  };

  return (
    <div className="bg-zinc-950 border-t border-zinc-800 p-4">
      {isManualRequired && (
        <div className="mb-3 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded flex items-start gap-2  animate-enter">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">
            <strong>Atenção:</strong> Este atendimento requer intervenção humana imediata. O agente autônomo foi desativado temporariamente para este lead.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleToggleAutonomy}
            disabled={toggleAutonomyMutation.isPending}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-white disabled:opacity-50"
            style={{ color: isManualRequired ? '#94a3b8' : '#34d399' }} // zinc-400 or emerald-400
          >
            {isManualRequired ? (
              <ToggleLeft className="w-6 h-6 text-zinc-500" />
            ) : (
              <ToggleRight className="w-6 h-6 text-emerald-500" />
            )}
            {isManualRequired ? 'IA Pausada' : 'IA Ativa'}
          </button>
          {toggleAutonomyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
        </div>
        
        <button
          onClick={() => generateDraftMutation.mutate()}
          disabled={generateDraftMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-emerald-500/50 hover:text-emerald-400 text-zinc-400 text-sm font-medium rounded-sm transition-all"
        >
          {generateDraftMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span className="font-mono">🤖</span>
          )}
          Sugerir Resposta com IA
        </button>
      </div>

      <form onSubmit={handleSend} className="relative">
        <textarea
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          placeholder="Digite sua mensagem ou use um rascunho da IA..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded p-3 pr-14 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-sifto-cobalt focus:ring-1 focus:ring-sifto-cobalt resize-none min-h-[60px] max-h-[120px]"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={!draftContent.trim() || sendMutation.isPending}
          className="absolute right-2 bottom-2 p-2 bg-sifto-cobalt hover:bg-sifto-cobalt-dark disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded transition-colors"
        >
          {sendMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
};
