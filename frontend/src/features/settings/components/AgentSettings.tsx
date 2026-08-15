import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Loader2, Sparkles, Plus, Trash2, Bot, Phone, Link2, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../../services/api';
import { useSocket } from '../../../context/SocketContext';
import { ConfirmModal } from '../../../components/feedback/ConfirmModal';

interface Agent {
  id: string;
  name: string;
  status: boolean;
  tone: string;
  maxDiscount: number;
  refundPolicy: string;
  useEmojis: boolean;
  basePrompt?: string;
  temperature?: number;
}

interface WhatsAppChannel {
  id: string;
  name: string;
  phoneNumber: string;
  agentId: string | null;
  connectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED';
}

interface FewShotExample {
  id: string;
  userQuery: string;
  expectedResponse: string;
}

export const AgentSettings = () => {
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Canais Form State
  const [newChannelName, setNewChannelName] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newAgentId, setNewAgentId] = useState<string>('');
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null);
  
  // Modal QR Code State
  const { socket, isConnected } = useSocket();
  const [qrModalChannelId, setQrModalChannelId] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Listen to WebSocket events
  React.useEffect(() => {
    if (!socket || !isConnected) return;

    const onQrGenerated = (data: { channelId: string; qrCodeBase64: string }) => {
      if (data.channelId === qrModalChannelId) {
        setQrCodeData(data.qrCodeBase64);
        setConnectionError(null);
      }
    };

    const onConnected = (data: { channelId: string }) => {
      if (data.channelId === qrModalChannelId) {
        setIsSuccess(true);
        setConnectionError(null);
        setTimeout(() => {
          setQrModalChannelId(null);
          setQrCodeData(null);
          setIsSuccess(false);
          queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
        }, 3000);
      } else {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      }
    };

    const onConnectionError = (data: { channelId: string; errorType: string; message: string }) => {
      if (data.channelId === qrModalChannelId) {
        setConnectionError(data.message);
        setQrCodeData(null);
        setIsSuccess(false);
        queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      }
    };

    socket.on('channel.qr_generated', onQrGenerated);
    socket.on('channel.connected', onConnected);
    socket.on('channel.connection_error', onConnectionError);

    return () => {
      socket.off('channel.qr_generated', onQrGenerated);
      socket.off('channel.connected', onConnected);
      socket.off('channel.connection_error', onConnectionError);
    };
  }, [socket, isConnected, qrModalChannelId, queryClient]);

  // Agent Form State (Create)
  const [newAgentName, setNewAgentName] = useState('');

  // Agent Form State (Edit)
  const [tone, setTone] = useState('PROFISSIONAL');
  const [maxDiscount, setMaxDiscount] = useState<number>(0);
  const [refundPolicy, setRefundPolicy] = useState('Padrão de 7 dias');
  const [useEmojis, setUseEmojis] = useState(true);

  // Few-Shot Form State
  const [userQuery, setUserQuery] = useState('');
  const [expectedResponse, setExpectedResponse] = useState('');

  // Fetch Channels
  const { data: channels, isLoading: loadingChannels } = useQuery<WhatsAppChannel[]>({
    queryKey: ['whatsapp-channels'],
    queryFn: async () => {
      try {
        const res = await api.get('/whatsapp-channels');
        return Array.isArray(res.data) ? res.data : (res.data?.data || []);
      } catch (error) {
        return [];
      }
    },
  });

  // Fetch Agents
  const { data: agents, isLoading: loadingAgents } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: async () => {
      try {
        const res = await api.get('/agents');
        return Array.isArray(res.data) ? res.data : (res.data?.data || []);
      } catch (error) {
        return [];
      }
    },
  });

  // Fetch Examples
  const { data: examples, isLoading: loadingExamples } = useQuery<FewShotExample[]>({
    queryKey: ['agent-examples', selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      try {
        const res = await api.get(`/agents/${selectedAgentId}/examples`);
        return Array.isArray(res.data) ? res.data : (res.data?.data || []);
      } catch (error) {
        return [];
      }
    },
    enabled: !!selectedAgentId,
  });

  // Load Agent into Editor
  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    setTone(agent.tone || 'PROFISSIONAL');
    setMaxDiscount(agent.maxDiscount || 0);
    setRefundPolicy(agent.refundPolicy || 'Padrão de 7 dias');
    setUseEmojis(agent.useEmojis !== false);
  };

  // Mutations
  const createChannelMutation = useMutation({
    mutationFn: async (data: any) => api.post('/whatsapp-channels', data),
    onSuccess: (res) => {
      toast.success('Canal criado! Iniciando conexão...');
      setNewChannelName('');
      setNewPhoneNumber('');
      setNewAgentId('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      
      // Auto-connect
      const createdId = res.data?.id;
      if (createdId) {
        connectChannelMutation.mutate(createdId);
      }
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Erro ao criar canal.'),
  });

  const connectChannelMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/whatsapp-channels/${id}/connect`),
    onSuccess: (_, id) => {
      setQrModalChannelId(id);
      setQrCodeData(null);
      setIsSuccess(false);
      setConnectionError(null);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Erro ao inicializar conexão.'),
  });

  const disconnectChannelMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/whatsapp-channels/${id}/disconnect`),
    onSuccess: () => {
      toast.success('Canal desconectado!');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
    },
    onError: () => toast.error('Erro ao desconectar.'),
  });

  const bindAgentMutation = useMutation({
    mutationFn: async ({ channelId, agentId }: { channelId: string; agentId: string | null }) => 
      api.patch(`/whatsapp-channels/${channelId}/bind-agent`, { agentId }),
    onSuccess: () => {
      toast.success('Vínculo atualizado!');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
    },
    onError: () => toast.error('Erro ao vincular agente.'),
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/whatsapp-channels/${id}`),
    onSuccess: () => {
      toast.success('Canal excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
    },
    onError: () => toast.error('Erro ao excluir canal.'),
  });

  const createAgentMutation = useMutation({
    mutationFn: async (name: string) => api.post('/agents', { name }),
    onSuccess: () => {
      toast.success('Agente criado com sucesso!');
      setNewAgentName('');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
    onError: () => toast.error('Erro ao criar agente.'),
  });

  const updateAgentMutation = useMutation({
    mutationFn: async (data: any) => api.put(`/agents/${selectedAgentId}`, data),
    onSuccess: () => {
      toast.success('Configurações do agente salvas!');
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
    onError: () => toast.error('Erro ao salvar as configurações.'),
  });

  const addExampleMutation = useMutation({
    mutationFn: async (data: { userQuery: string; expectedResponse: string }) => 
      api.post(`/agents/${selectedAgentId}/examples`, data),
    onSuccess: () => {
      toast.success('Exemplo adicionado!');
      setUserQuery('');
      setExpectedResponse('');
      queryClient.invalidateQueries({ queryKey: ['agent-examples', selectedAgentId] });
    },
    onError: () => toast.error('Erro ao adicionar exemplo.'),
  });

  const deleteExampleMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/agents/${selectedAgentId}/examples/${id}`),
    onSuccess: () => {
      toast.success('Exemplo removido.');
      queryClient.invalidateQueries({ queryKey: ['agent-examples', selectedAgentId] });
    },
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-12">
      <header>
        <div className="flex items-center gap-3 text-sifto-cobalt-light mb-2">
          <Bot className="w-8 h-8" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Canais e Agentes IA</h1>
        </div>
        <p className="text-zinc-500">
          Gerencie seus números de WhatsApp e parametrize múltiplos Agentes de IA com personalidades distintas.
        </p>
      </header>

      {/* Canais de Atendimento */}
      <section className="bg-zinc-950 border border-zinc-800 rounded-md p-6 ">
        <h2 className="text-xl font-bold text-zinc-300 mb-6 flex items-center gap-2">
          <Phone className="w-6 h-6 text-sifto-cobalt-light" />
          Canais de Atendimento (WhatsApp)
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Create Channel */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-500 uppercase">Novo Canal</h3>
            <input
              type="text"
              placeholder="Nome do Canal (Ex: WhatsApp Suporte)"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded px-4 py-2 text-zinc-300 focus:border-sifto-cobalt"
            />
            <input
              type="text"
              placeholder="Número (Ex: 5511999999999)"
              value={newPhoneNumber}
              onChange={(e) => setNewPhoneNumber(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded px-4 py-2 text-zinc-300 focus:border-sifto-cobalt"
            />
            <select
              value={newAgentId}
              onChange={(e) => setNewAgentId(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded px-4 py-2 text-zinc-300 focus:border-sifto-cobalt"
            >
              <option value="">-- Modo Manual (Sem Agente) --</option>
              {agents?.map(ag => (
                <option key={ag.id} value={ag.id}>{ag.name}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!newChannelName || !newPhoneNumber) {
                  return toast.error('Preencha o nome e o número.');
                }
                createChannelMutation.mutate({ 
                  name: newChannelName,
                  phoneNumber: newPhoneNumber, 
                  agentId: newAgentId || null
                });
              }}
              disabled={createChannelMutation.isPending}
              className="w-full flex justify-center items-center gap-2 bg-sifto-cobalt-dark hover:bg-sifto-cobalt text-white py-2 rounded"
            >
              {createChannelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Salvar e Conectar
            </button>
          </div>

          {/* Lista de Canais */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-500 uppercase">Canais Cadastrados</h3>
            {loadingChannels ? (
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            ) : channels?.length ? (
              <div className="space-y-3">
                {channels.map((channel) => (
                  <div key={channel.id} className="flex flex-col md:flex-row items-center justify-between bg-black border border-zinc-800 rounded p-4 gap-4">
                    <div className="flex flex-col flex-1 w-full">
                      <span className="font-semibold text-zinc-300 flex items-center gap-2">
                        {channel.name}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          channel.connectionStatus === 'CONNECTED' ? 'bg-sifto-cobalt/20 text-sifto-cobalt-light' :
                          channel.connectionStatus === 'CONNECTING' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-zinc-700 text-zinc-400'
                        }`}>
                          {channel.connectionStatus}
                        </span>
                      </span>
                      <span className="text-xs text-zinc-500">
                        {channel.phoneNumber}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <Link2 className="w-4 h-4 text-zinc-500 hidden md:block" />
                      <select
                        value={channel.agentId || ''}
                        onChange={(e) => bindAgentMutation.mutate({ channelId: channel.id, agentId: e.target.value || null })}
                        className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm text-zinc-400 w-full md:w-48"
                      >
                        <option value="">-- Modo Manual (Sem Agente) --</option>
                        {agents?.map(ag => (
                          <option key={ag.id} value={ag.id}>{ag.name}</option>
                        ))}
                      </select>
                      
                      {channel.connectionStatus === 'CONNECTED' ? (
                        <button
                          onClick={() => disconnectChannelMutation.mutate(channel.id)}
                          className="bg-zinc-900 hover:bg-zinc-700 text-zinc-400 text-xs px-3 py-1.5 rounded"
                          disabled={disconnectChannelMutation.isPending}
                        >
                          Desconectar
                        </button>
                      ) : (
                        <button
                          onClick={() => connectChannelMutation.mutate(channel.id)}
                          className="bg-sifto-cobalt-dark hover:bg-sifto-cobalt text-white text-xs px-3 py-1.5 rounded"
                          disabled={connectChannelMutation.isPending}
                        >
                          Conectar
                        </button>
                      )}

                      <button
                        onClick={() => setChannelToDelete(channel.id)}
                        className="text-zinc-500 hover:text-red-400 p-2 rounded bg-zinc-950"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 border border-dashed border-zinc-800 rounded text-zinc-500">
                Nenhum canal cadastrado.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Nossos Agentes */}
      <section className="bg-zinc-950 border border-zinc-800 rounded-md p-6 ">
        <h2 className="text-xl font-bold text-zinc-300 mb-6 flex items-center gap-2">
          <Bot className="w-6 h-6 text-sifto-cobalt-light" />
          Nossos Agentes
        </h2>
        
        <div className="flex gap-4 mb-8">
          <input
            type="text"
            placeholder="Nome do novo Agente"
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            className="w-64 bg-black border border-zinc-800 rounded px-4 py-2 text-zinc-300 focus:border-sifto-cobalt"
          />
          <button
            onClick={() => {
              if (!newAgentName) return toast.error('Dê um nome ao agente.');
              createAgentMutation.mutate(newAgentName);
            }}
            disabled={createAgentMutation.isPending}
            className="flex justify-center items-center gap-2 bg-sifto-cobalt-dark hover:bg-sifto-cobalt text-white px-6 py-2 rounded font-medium"
          >
            <Plus className="w-4 h-4" /> Criar Agente
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {agents?.map((agent) => (
            <button
              key={agent.id}
              onClick={() => handleSelectAgent(agent)}
              className={`p-4 rounded border text-left transition-all ${
                selectedAgentId === agent.id 
                  ? 'bg-sifto-cobalt-deep/40 border-sifto-cobalt ring-1 ring-sifto-cobalt' 
                  : 'bg-black border-zinc-800 hover:border-zinc-800'
              }`}
            >
              <h3 className="font-semibold text-zinc-300 mb-1">{agent.name}</h3>
              <p className="text-xs text-zinc-500 line-clamp-2">Tom: {agent.tone}</p>
            </button>
          ))}
        </div>

        {selectedAgentId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-zinc-800 pt-8 mt-8">
            {/* Form Onboarding Agente */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-sifto-cobalt-light" />
                Parametrização do Agente
              </h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                updateAgentMutation.mutate({ name: agents?.find(a => a.id === selectedAgentId)?.name, tone, maxDiscount, refundPolicy, useEmojis, status: true });
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-500 mb-1">Tom de Voz</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded px-4 py-2 text-zinc-300"
                  >
                    <option value="PROFISSIONAL">Profissional e Direto</option>
                    <option value="AMIGAVEL">Amigável e Empático</option>
                    <option value="PERSUASIVO">Persuasivo (Foco em Vendas)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-500 mb-1">Max Desconto (%)</label>
                  <input
                    type="number"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(Number(e.target.value))}
                    className="w-full bg-black border border-zinc-800 rounded px-4 py-2 text-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-500 mb-1">Regras de Reembolso</label>
                  <textarea
                    value={refundPolicy}
                    onChange={(e) => setRefundPolicy(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded px-4 py-2 text-zinc-300 resize-none h-20"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={useEmojis}
                    onChange={(e) => setUseEmojis(e.target.checked)}
                    className="w-5 h-5 rounded border-zinc-800 bg-zinc-950"
                  />
                  <label className="text-sm text-zinc-400">Permitir emojis</label>
                </div>
                <button
                  type="submit"
                  disabled={updateAgentMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-700 text-white font-medium px-4 py-2 rounded transition-colors"
                >
                  <Save className="w-4 h-4" /> Salvar Configurações
                </button>
              </form>
            </div>

            {/* Few Shot Examples */}
            <div className="space-y-6">
              <div className="bg-black border border-zinc-800 rounded p-5">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sifto-cobalt-light" />
                  Adicionar Exemplo (Few-Shot)
                </h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!userQuery || !expectedResponse) return toast.error('Preencha os dados.');
                  addExampleMutation.mutate({ userQuery, expectedResponse });
                }} className="space-y-3">
                  <textarea
                    placeholder="Mensagem do cliente..."
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 resize-none h-16"
                  />
                  <textarea
                    placeholder="Resposta ideal da IA..."
                    value={expectedResponse}
                    onChange={(e) => setExpectedResponse(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 resize-none h-20"
                  />
                  <button
                    type="submit"
                    disabled={addExampleMutation.isPending}
                    className="w-full bg-sifto-cobalt-dark hover:bg-sifto-cobalt text-white font-medium px-4 py-2 rounded transition-colors text-sm"
                  >
                    Cadastrar Exemplo
                  </button>
                </form>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {examples?.map(ex => (
                  <div key={ex.id} className="group bg-black border border-zinc-800 rounded p-3 relative">
                    <button
                      onClick={() => deleteExampleMutation.mutate(ex.id)}
                      className="absolute top-2 right-2 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <p className="text-xs text-zinc-500 mb-1">U: "{ex.userQuery}"</p>
                    <p className="text-xs text-sifto-cobalt-light/80">IA: "{ex.expectedResponse}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* QR Code Modal */}
      {qrModalChannelId && (
        <div className="fixed inset-0 bg-black/60  z-50 flex items-center justify-center">
          <div className="bg-zinc-950 border border-zinc-800 rounded-md p-8 max-w-sm w-full  flex flex-col items-center relative">
            <button 
              onClick={() => setQrModalChannelId(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300"
            >
              &times;
            </button>
            <h3 className="text-xl font-bold text-zinc-100 mb-2">Conectar WhatsApp</h3>
            
            {connectionError ? (
              <div className="flex flex-col items-center py-4 space-y-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded p-4 text-center">
                  <p className="text-red-400 font-medium text-sm leading-relaxed">{connectionError}</p>
                </div>
                <button
                  onClick={() => connectChannelMutation.mutate(qrModalChannelId!)}
                  disabled={connectChannelMutation.isPending}
                  className="w-full h-11 flex justify-center items-center gap-2 bg-zinc-900 hover:bg-zinc-700 text-zinc-300 rounded font-medium transition-colors"
                >
                  {connectChannelMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Tentar Novamente'}
                </button>
              </div>
            ) : isSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-20 h-20 bg-sifto-cobalt/20 rounded-full flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-10 h-10 text-sifto-cobalt" />
                </div>
                <p className="text-sifto-cobalt-light font-medium text-center">Conectado com sucesso!</p>
              </div>
            ) : qrCodeData ? (
              <div className="flex flex-col items-center space-y-4 py-4">
                <div className="bg-white p-4 rounded">
                  <img src={qrCodeData} alt="QR Code WhatsApp" className="w-48 h-48" />
                </div>
                <p className="text-zinc-500 text-sm text-center">
                  Abra o WhatsApp no seu celular, vá em <b>Dispositivos Conectados</b> e aponte a câmera para escancear o QR Code.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-sifto-cobalt" />
                <p className="text-zinc-500 text-sm">Gerando QR Code...</p>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!channelToDelete}
        title="Excluir Canal de Atendimento"
        message="Tem certeza que deseja excluir este canal? O bot deixará de responder neste número e todas as configurações vinculadas serão perdidas."
        confirmText="Excluir Canal"
        isDestructive={true}
        onConfirm={() => {
          if (channelToDelete) deleteChannelMutation.mutate(channelToDelete);
        }}
        onCancel={() => setChannelToDelete(null)}
      />
    </div>
  );
};
