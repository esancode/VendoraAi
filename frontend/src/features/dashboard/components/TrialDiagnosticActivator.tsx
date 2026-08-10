import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { activateAudit } from '../../../services/dashboardApi';
import { Terminal, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const TrialDiagnosticActivator: React.FC = () => {
  const [step, setStep] = useState<'IDLE' | 'PROCESSING'>('IDLE');
  const [logs, setLogs] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: activateAudit,
    onSuccess: () => {
      setStep('PROCESSING');
      // The actual transition to the dashboard is handled by the socket event 'dashboard.data_ready'
      // which invalidates the queries in DashboardContainer.
      
      const sequence = [
        { time: 500, text: '[00:15] [INGESTION] Enfileirando histórico do WhatsApp no BullMQ...' },
        { time: 2500, text: '[00:35] [WORKER] Anonimizando dados pessoais sensíveis (LGPD)...' },
        { time: 5000, text: '[00:55] [AI_ENGINE] Analisando objeções e gargalos com Gemini 1.5 Flash...' },
        { time: 7000, text: '[01:10] [COMPILING] Gravando insights e aguardando WebSocket Push...' },
      ];

      sequence.forEach((item) => {
        setTimeout(() => {
          setLogs(prev => [...prev, item.text]);
        }, item.time);
      });
    },
    onError: () => {
      toast.error('Erro ao iniciar auditoria.');
    }
  });

  const handleStart = () => {
    mutation.mutate();
  };

  return (
    <div className="w-full border border-zinc-800 rounded-sm bg-[#09090b] overflow-hidden animate-in fade-in duration-500">
      {step === 'IDLE' ? (
        <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-lg text-zinc-100 font-medium mb-2 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-zinc-400" />
              Auditoria Retroativa Disponível
            </h2>
            <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
              WhatsApp conectado com sucesso. Agora, ative nosso Auditor Comercial para analisar retroativamente suas conversas históricas.
            </p>
          </div>
          <button
            onClick={handleStart}
            disabled={mutation.isPending}
            className="shrink-0 px-6 py-3 bg-zinc-100 hover:bg-white text-black text-xs font-bold tracking-wider rounded-sm transition-colors uppercase disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            [ INICIAR AUDITORIA IMEDIATA ]
          </button>
        </div>
      ) : (
        <div className="p-4 bg-black text-xs flex flex-col gap-2 min-h-[140px]">
          {logs.map((log, i) => (
            <div key={i} className="text-zinc-400 animate-pulse">
              <span className="text-emerald-500 mr-2">{'>'}</span>
              {log}
            </div>
          ))}
          {logs.length < 4 && (
            <div className="text-zinc-600 animate-pulse">
              <span className="text-emerald-500 mr-2">{'>'}</span>
              _
            </div>
          )}
        </div>
      )}
    </div>
  );
};
