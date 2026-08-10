import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPriorityLeads } from '../../../services/dashboardApi';
import type { Lead } from '../../../services/dashboardApi';
import { LeadCard } from '../../dashboard/components/LeadCard';
import { MessageList } from './MessageList';
import { AiCopilotPanel } from './AiCopilotPanel';
import { ActionBar } from './ActionBar';
import { Loader2, ArrowLeft, MessageSquareOff, Users, MessageSquare } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { api } from '../../../services/api';

export const ChatContainer: React.FC = () => {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  // Fetch agents
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await api.get('/agents');
      return response.data;
    },
  });

  const { data: leads, isLoading } = useQuery({
    queryKey: ['priority-leads', selectedAgentId],
    queryFn: () => getPriorityLeads(selectedAgentId),
  });

  const handleBackToList = () => {
    setActiveLead(null);
  };

  const handleUseDraft = (content: string) => {
    setDraftContent(content);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 h-[calc(100vh)] flex flex-col">
      <header className="shrink-0">
        <div className="flex items-center gap-3 text-emerald-400 mb-2">
          <MessageSquare className="w-8 h-8" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Copiloto e Atendimento</h1>
        </div>
        <p className="text-zinc-500">
          Supervisione as conversas do seu agente de IA ou assuma o controle humano (Handoff) quando necessário.
        </p>
      </header>

      <div className="flex-1 flex overflow-hidden border border-zinc-800 rounded-sm bg-black">
        {/* Left Column: Leads List */}
        <div 
          className={cn(
          "w-full md:w-1/3 flex flex-col bg-zinc-950 border-r border-zinc-800 transition-transform duration-300",
          activeLead ? "hidden md:flex" : "flex"
        )}
      >
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Atendimento</h2>
          <p className="text-sm text-zinc-500 mt-1">Leads aguardando resposta</p>
          
          <div className="mt-4">
            <label className="block text-xs font-medium text-zinc-500 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Filtrar por Agente
            </label>
            <select
              value={selectedAgentId}
              onChange={(e) => {
                setSelectedAgentId(e.target.value);
                setActiveLead(null); // Reset active lead when switching agent filter
              }}
              className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="">Todos os Agentes</option>
              {agents?.map((agent: any) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : leads && leads.length > 0 ? (
            leads.map((lead) => (
              <LeadCard 
                key={lead.id} 
                lead={lead} 
                isActive={activeLead?.id === lead.id}
                onClick={setActiveLead}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-zinc-500">
              <MessageSquareOff className="w-8 h-8 mb-2" />
              <p>Nenhum lead na fila.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Active Chat */}
      <div 
        className={cn(
          "w-full md:w-2/3 flex-col bg-zinc-950/50 md:rounded-r-xl md:border md:border-l-0 border-zinc-800",
          activeLead ? "flex" : "hidden md:flex"
        )}
      >
        {activeLead ? (
          <>
            {/* Mobile Header */}
            <div className="md:hidden flex items-center p-3 border-b border-zinc-800 bg-zinc-950 sticky top-0 z-10">
              <button 
                onClick={handleBackToList}
                className="p-2 mr-2 text-zinc-500 hover:text-white rounded active:bg-zinc-900 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Voltar para a lista"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-zinc-300 truncate">{activeLead.name}</h3>
                <span className="text-xs text-emerald-400">Atendimento Ativo</span>
              </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:flex p-4 border-b border-zinc-800 bg-zinc-950/50">
              <div>
                <h3 className="font-semibold text-lg text-zinc-300">{activeLead.name}</h3>
                <span className="text-sm text-zinc-500">Tempo limite: {new Date(activeLead.slaLimitAt).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto relative p-4 flex flex-col">
              <MessageList leadId={activeLead.id} />
            </div>

            {/* Ai Copilot and Action Bar container */}
            <div className="relative">
              <AiCopilotPanel leadId={activeLead.id} onUseDraft={handleUseDraft} />
              <ActionBar 
                leadId={activeLead.id} 
                draftContent={draftContent} 
                setDraftContent={setDraftContent}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <MessageSquareOff className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium text-zinc-500">Selecione um lead</p>
            <p className="text-sm text-zinc-500 mt-1">Para iniciar o atendimento</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
