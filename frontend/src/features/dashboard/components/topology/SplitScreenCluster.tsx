import React, { useRef, useEffect } from 'react';
import type { AgentStatus, LogEntry } from '../../hooks/useAgentLogs';

interface AgentNodeProps {
  agent: { id: string; name: string; phoneNumber?: string };
  status: AgentStatus;
  logs: LogEntry[];
}

const AgentNode: React.FC<AgentNodeProps> = ({ agent, status, logs }) => {
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
      statusDotClass = 'bg-sifto-sla-success animate-pulse';
      statusText = 'thinking';
      break;
    case 'TYPING':
      statusDotClass = 'bg-sifto-sla-success animate-[ping_0.8s_cubic-bezier(0,0,0.2,1)_infinite]';
      statusText = 'typing';
      break;
    case 'HUMAN_REQUIRED':
      statusDotClass = 'bg-rose-500';
      statusText = 'paused';
      break;
  }

  const generateSparkline = () => {
    let path = 'M 0 10 ';
    for (let i = 1; i <= 20; i++) {
      path += `L ${i * (100 / 20)} ${Math.random() * 20} `;
    }
    return path;
  };

  return (
    <div className="flex flex-col bg-black border border-zinc-800 rounded-sm overflow-hidden h-full min-h-[250px]">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-[#09090b]">
        <div className="flex flex-col">
          <span className="text-sm text-zinc-300 truncate max-w-[150px]">
            {agent.name.toLowerCase().replace(/\s+/g, '-')}
          </span>
          <span className="text-xs text-zinc-500">
            {agent.phoneNumber || '+55 (11) 99999-9999'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 uppercase tracking-widest hidden sm:inline-block">
            {statusText}
          </span>
          <div className={`w-2.5 h-2.5 rounded-none ${statusDotClass}`} title={statusText} />
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto text-xs text-zinc-500 flex flex-col justify-end min-h-[140px]">
          {logs.map((log) => (
            <div key={log.id} className="leading-relaxed mb-1 truncate" title={log.message}>
              <span className="text-zinc-600">[{log.timestamp}]</span>{' '}
              <span className="text-zinc-400">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

      <div className="mt-auto px-3 pb-3">
        <svg viewBox="0 0 100 20" className="w-full h-4 preserve-3d" preserveAspectRatio="none">
          <path
            d={generateSparkline()}
            fill="none"
            className="stroke-sifto-sla-success"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
};

interface SplitScreenClusterProps {
  agents: { id: string; name: string; phoneNumber?: string }[];
  statuses: Record<string, AgentStatus>;
  logs: Record<string, LogEntry[]>;
}

export const SplitScreenCluster: React.FC<SplitScreenClusterProps> = ({ agents, statuses, logs }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-zinc-800 rounded-sm overflow-hidden">
      {agents.map((agent) => (
        <div key={agent.id} className="border-b md:border-b-0 md:border-r border-zinc-800 last:border-b-0 last:border-r-0">
          <AgentNode 
            agent={agent} 
            status={statuses[agent.id] || 'IDLE'} 
            logs={logs[agent.id] || []} 
          />
        </div>
      ))}
    </div>
  );
};
