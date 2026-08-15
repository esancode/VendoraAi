import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Search, Plus, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Users } from 'lucide-react';


// Interfaces
interface KnowledgeSource {
  id: string;
  title: string;
  content: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  chunkCount: number;
  updatedAt: string;
}

import { api } from '../../../services/api';

import { ConfirmModal } from '../../../components/feedback/ConfirmModal';

export const KnowledgeManager = () => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null);

  // Fetch agents
  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await api.get('/agents');
      return response.data;
    },
  });

  // Fetch sources
  const { data: sources, isLoading } = useQuery<KnowledgeSource[]>({
    queryKey: ['knowledge-sources', selectedAgentId],
    enabled: !!selectedAgentId,
    queryFn: async () => {
      try {
        const response = await api.get('/knowledge-sources', { params: { agentId: selectedAgentId } });
        if (Array.isArray(response.data)) return response.data;
        if (response.data && Array.isArray(response.data.data)) return response.data.data;
        return [];
      } catch (error) {
        console.error('Error fetching knowledge sources:', error);
        // Fallback for UI if endpoint doesn't exist yet
        return [];
      }
    },
  });

  // Create source mutation
  const createMutation = useMutation({
    mutationFn: async (newSource: { title: string; content: string; agentId: string }) => {
      const response = await api.post('/knowledge-sources', newSource);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Documento enviado para vetorização!');
      setTitle('');
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['knowledge-sources', selectedAgentId] });
    },
    onError: () => {
      toast.error('Erro ao cadastrar base de conhecimento.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/knowledge-sources/${id}`, { params: { agentId: selectedAgentId } });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Documento excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['knowledge-sources', selectedAgentId] });
    },
    onError: () => {
      toast.error('Erro ao excluir documento.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) {
      toast.error('Selecione um agente antes de cadastrar.');
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast.error('Preencha o título e o conteúdo.');
      return;
    }
    createMutation.mutate({ title, content, agentId: selectedAgentId });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="mb-8">
        <div className="flex items-center gap-3 text-sifto-cobalt-light mb-2">
          <Database className="w-8 h-8" />
          <h1 className="text-2xl font-bold text-white tracking-tight">RAG Document Manager</h1>
        </div>
        <p className="text-zinc-500">
          Gerencie a base de conhecimento vetorial. Adicione regras de negócio e FAQs para treinar o Copiloto.
        </p>
      </header>

      {/* Seletor de Agente */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-md p-6 ">
        <label className="block text-sm font-medium text-zinc-500 mb-2 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Selecione o Agente de IA
        </label>
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="w-full bg-black border border-zinc-800 rounded px-4 py-3 text-zinc-300 focus:outline-none focus:border-sifto-cobalt focus:ring-1 focus:ring-sifto-cobalt transition-all"
        >
          <option value="">-- Selecione um agente --</option>
          {agents?.map((agent: any) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} {agent.role ? `(${agent.role})` : ''}
            </option>
          ))}
        </select>
        {!selectedAgentId && (
          <p className="mt-2 text-sm text-amber-500/80">
            A base de conhecimento agora é isolada por agente. Escolha um agente para visualizar ou adicionar fontes.
          </p>
        )}
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 transition-opacity duration-300 ${!selectedAgentId ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Formulario */}
        <section className="bg-zinc-950 border border-zinc-800 rounded-md p-6 ">
          <h2 className="text-lg font-semibold text-zinc-300 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-sifto-cobalt-light" />
            Nova Fonte de Conhecimento
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-zinc-500 mb-1">
                Título da Fonte
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Política de Trocas e Devoluções"
                className="w-full bg-black border border-zinc-800 rounded px-4 py-3 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-sifto-cobalt focus:ring-1 focus:ring-sifto-cobalt transition-all"
                disabled={createMutation.isPending}
              />
            </div>
            
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-zinc-500 mb-1">
                Conteúdo (FAQ / Regras)
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Cole aqui as regras de negócio em texto limpo ou markdown..."
                rows={8}
                className="w-full bg-black border border-zinc-800 rounded px-4 py-3 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-sifto-cobalt focus:ring-1 focus:ring-sifto-cobalt transition-all resize-none"
                disabled={createMutation.isPending}
              />
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending || !selectedAgentId}
              className="w-full flex items-center justify-center gap-2 bg-sifto-cobalt-dark hover:bg-sifto-cobalt text-white font-medium px-6 py-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando Vetores...
                </>
              ) : (
                <>
                  <Database className="w-5 h-5" />
                  Cadastrar e Vetorizar
                </>
              )}
            </button>
          </form>
        </section>

        {/* Lista de Fontes */}
        <section className="bg-zinc-950/50 border border-zinc-800/50 rounded-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-zinc-300 flex items-center gap-2">
              <Search className="w-5 h-5 text-zinc-500" />
              Fontes Cadastradas
            </h2>
            <span className="bg-zinc-900 text-zinc-400 text-xs px-2 py-1 rounded-md font-medium">
              {sources?.length || 0} Itens
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {isLoading ? (
              <div key="loading-state" className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
              </div>
            ) : sources && sources.length > 0 ? (
              <React.Fragment key="data-state">
                {sources.map((source) => (
                <div key={source.id} className="bg-black border border-zinc-800 rounded p-4 transition-all hover:border-zinc-800">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-medium text-zinc-300 mb-2 truncate flex-1">{source.title}</h3>
                    <button
                      onClick={() => setSourceToDelete(source.id)}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded-md hover:bg-red-400/10 transition-colors"
                      title="Remover"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-zinc-500">
                      {new Date(source.updatedAt).toLocaleDateString()}
                    </span>
                    
                    {/* Status Badge */}
                    {source.status === 'COMPLETED' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sifto-cobalt/10 text-sifto-cobalt-light border border-sifto-cobalt/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-sifto-cobalt-light"></span>
                        Vetorizado ({source.chunkCount || 0} Chunks)
                      </span>
                    ) : source.status === 'PROCESSING' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3 animate-spin-slow" />
                        Vetorizando...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        Falha na Vetorização
                      </span>
                    )}
                  </div>
                </div>
                ))}
              </React.Fragment>
            ) : (
              <div key="empty-state" className="text-center p-8 border border-dashed border-zinc-800 rounded">
                <Database className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm">Nenhuma fonte de conhecimento cadastrada ainda.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={!!sourceToDelete}
        title="Excluir Base de Conhecimento"
        message="Tem certeza que deseja excluir esta fonte e todos os seus embeddings vetoriais? O copiloto não conseguirá mais responder perguntas sobre esse assunto."
        confirmText="Excluir Permanentemente"
        isDestructive={true}
        onConfirm={() => {
          if (sourceToDelete) deleteMutation.mutate(sourceToDelete);
        }}
        onCancel={() => setSourceToDelete(null)}
      />
    </div>
  );
};
