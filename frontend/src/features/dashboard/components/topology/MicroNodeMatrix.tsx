import React from 'react';
import type { AgentStatus, LogEntry } from '../../hooks/useAgentLogs';

interface MicroNodeProps {
  agent: { id: string; name: string; phoneNumber?: string };
  status: AgentStatus;
  lastLog?: LogEntry;
}

const MicroNode: React.FC<MicroNodeProps> = ({ agent, status, lastLog }) => {
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

  // Generate a fake stable traffic bar based on id hash for visual effect
  const trafficLevel = (agent.id.charCodeAt(0) % 100) + 10; 

  return (
    <div className="flex flex-col bg-black border border-zinc-800 rounded-sm p-3 hover:border-zinc-600 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
          <span className="text-sm text-zinc-300 truncate max-w-[120px]">
            {agent.name.toLowerCase().replace(/\s+/g, '-')}
          </span>
          <span className="text-xs text-zinc-500">
            {agent.phoneNumber || '+55 (11) 99999-9999'}
          </span>
        </div>
        <div className={`w-2 h-2 rounded-none ${statusDotClass}`} title={statusText} />
      </div>

      <div className="flex flex-col gap-2 mt-auto">
        <div className="h-1.5 w-full bg-zinc-900 rounded-sm overflow-hidden">
          <div className="h-full bg-zinc-700" style={{ width: `${trafficLevel}%` }}></div>
        </div>
        <span className="text-xs text-zinc-600 truncate">
          {lastLog ? `↳ [${lastLog.timestamp}] ${lastLog.message}` : '↳ Waiting for events...'}
        </span>
      </div>
    </div>
  );
};

interface MicroNodeMatrixProps {
  agents: { id: string; name: string; phoneNumber?: string }[];
  statuses: Record<string, AgentStatus>;
  logs: Record<string, LogEntry[]>;
}

export const MicroNodeMatrix: React.FC<MicroNodeMatrixProps> = ({ agents, statuses, logs }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
      {agents.map((agent) => {
        const agentLogs = logs[agent.id] || [];
        const lastLog = agentLogs.length > 0 ? agentLogs[agentLogs.length - 1] : undefined;
        return (
          <MicroNode 
            key={agent.id} 
            agent={agent} 
            status={statuses[agent.id] || 'IDLE'} 
            lastLog={lastLog}
          />
        );
      })}
    </div>
  );
};
