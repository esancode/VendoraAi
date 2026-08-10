import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboardStatus } from '../../../services/dashboardApi';
import { useSocket } from '../../../context/SocketContext';
import { Loader2 } from 'lucide-react';

import { TrialDiagnosticActivator } from './TrialDiagnosticActivator';
import { NarrativeInsightsBanner } from './NarrativeInsightsBanner';
import { LossObjectionTracker } from './LossObjectionTracker';
import { SlaResponseBottleneck } from './SlaResponseBottleneck';
import { UnmappedDemandsList } from './UnmappedDemandsList';
import { DashboardWhatsAppSetup } from './DashboardWhatsAppSetup';

export const DashboardContainer: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  const { data: dashboardStatus, isLoading } = useQuery({
    queryKey: ['dashboard-status'],
    queryFn: getDashboardStatus,
  });

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleInvalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-insights'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-status'] });
    };

    socket.on('dashboard.data_ready', handleInvalidate);
    socket.on('lead.sla_cooling', handleInvalidate);
    socket.on('message.processed', handleInvalidate);

    return () => {
      socket.off('dashboard.data_ready', handleInvalidate);
      socket.off('lead.sla_cooling', handleInvalidate);
      socket.off('message.processed', handleInvalidate);
    };
  }, [socket, isConnected, queryClient]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-zinc-500 bg-[#000000]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const { isChannelConnected = false, isDataAnalyzed = false } = dashboardStatus || {};

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-300 p-4 md:p-8 font-sans selection:bg-zinc-800">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {isChannelConnected && (
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-medium text-zinc-100">Cockpit de Auditoria Comercial</h1>
              <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">Monitoramento Passivo em Tempo Real</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">
                {isConnected ? 'SISTEMA ONLINE' : 'SISTEMA OFFLINE'}
              </span>
            </div>
          </div>
        )}

        {/* ETAPA 1: Conexão do WhatsApp */}
        {!isChannelConnected && (
          <DashboardWhatsAppSetup />
        )}

        {/* ETAPA 2: Botão de Auditoria */}
        {isChannelConnected && !isDataAnalyzed && (
          <TrialDiagnosticActivator />
        )}

        {/* ETAPA 3: Dashboard Real Completo */}
        {isChannelConnected && isDataAnalyzed && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ETAPA 2: Banner Narrativo */}
            <NarrativeInsightsBanner />

            {/* Grid Inferior */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* ETAPA 3: Objeções (4 colunas) */}
              <div className="lg:col-span-4">
                <LossObjectionTracker />
              </div>

              {/* ETAPA 4: SLA dos Vendedores (5 colunas) */}
              <div className="lg:col-span-5">
                <SlaResponseBottleneck />
              </div>

              {/* ETAPA 5: Demandas Não Mapeadas (3 colunas) */}
              <div className="lg:col-span-3">
                <UnmappedDemandsList />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
