import React, { useEffect, useRef } from 'react';
import type { AgentStatus, LogEntry } from '../../hooks/useAgentLogs';

interface InspectorNodeProps {
  agent: { id: string; name: string; phoneNumber?: string };
  status: AgentStatus;
  logs: LogEntry[];
}

export const InspectorNode: React.FC<InspectorNodeProps> = ({ agent, status, logs }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  let statusDotClass = 'bg-zinc-600';
  let statusText = 'idle';

  switch (status) {
    case 'THINKING':
      statusDotClass = 'bg-emerald-500 animate-pulse';
      statusText = 'thinking';
      break;
    case 'TYPING':
      statusDotClass = 'bg-emerald-500 animate-[ping_0.8s_cubic-bezier(0,0,0.2,1)_infinite]';
      statusText = 'typing';
      break;
    case 'HUMAN_REQUIRED':
      statusDotClass = 'bg-rose-500';
      statusText = 'paused';
      break;
  }

  const generateSparkline = () => {
    let path = 'M 0 50 ';
    for (let i = 1; i <= 50; i++) {
      path += `L ${i * (100 / 50)} ${Math.random() * 50} `;
    }
    return path;
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      {/* Main Terminal Column */}
      <div className="flex flex-col flex-1 bg-black border border-zinc-800 rounded-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-[#09090b]">
          <div className="flex flex-col">
            <span className="text-base text-zinc-300">node-core-processor-01</span>
            <span className="text-sm text-zinc-500">
              {agent.name.toLowerCase().replace(/\s+/g, '-')} • {agent.phoneNumber || '+55 (11) 99999-9999'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400 uppercase tracking-widest">
              {statusText}
            </span>
            <div className={`w-3 h-3 rounded-none ${statusDotClass}`} />
          </div>
        </div>

        {/* Expanded Terminal */}
        <div className="flex-1 min-h-[300px] p-4 bg-black overflow-y-auto text-sm text-zinc-500">
          {logs.map((log) => (
            <div key={log.id} className="leading-relaxed mb-2 hover:bg-zinc-900/50 p-1 -mx-1 rounded-sm">
              <span className="text-zinc-600">[{log.timestamp}]</span>{' '}
              <span className="text-sifto-cobalt-light">[{log.level}]</span>{' '}
              <span className="text-zinc-400">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        {/* Extended Sparkline */}
        <div className="h-20 border-t border-zinc-800 px-4 pt-3 pb-4 bg-[#09090b] flex flex-col justify-end">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-zinc-600">24H VOLUME</span>
            <span className="text-xs text-zinc-600">LIVE</span>
          </div>
          <svg viewBox="0 0 100 50" className="w-full h-8 preserve-3d" preserveAspectRatio="none">
            <path
              d={generateSparkline()}
              fill="none"
              className="stroke-emerald-600"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>

      {/* System Prompt Inspector */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        <div className="flex flex-col bg-[#09090b] border border-zinc-800 rounded-sm p-4 h-full">
          <span className="text-xs text-zinc-500 tracking-widest border-b border-zinc-800 pb-2 mb-3">
            SYSTEM_PROMPT_INSPECTOR
          </span>
          <div className="flex-1 text-xs text-zinc-600 leading-relaxed overflow-y-auto">
            <p className="mb-2">Você é um agente de vendas sênior da empresa. Seu objetivo é qualificar leads e agendar reuniões.</p>
            <p className="text-zinc-500 mb-2">/-- ACTIVE_TOOLS --/</p>
            <ul className="list-disc pl-3 mb-2">
              <li>pgvector_search</li>
              <li>calendar_booking</li>
            </ul>
            <p className="text-zinc-500 mb-2">/-- SLANGS --/</p>
            <ul className="list-disc pl-3">
              <li>"Bora"</li>
              <li>"Fechado"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
