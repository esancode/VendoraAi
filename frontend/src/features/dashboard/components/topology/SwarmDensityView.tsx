import React, { useRef, useEffect, useState } from 'react';
import type { AgentStatus, LogEntry } from '../../hooks/useAgentLogs';
import { X } from 'lucide-react';

interface SwarmDensityViewProps {
  agents: { id: string; name: string; phoneNumber?: string }[];
  statuses: Record<string, AgentStatus>;
  multiplexedLogs: LogEntry[];
  allLogs: Record<string, LogEntry[]>;
}

export const SwarmDensityView: React.FC<SwarmDensityViewProps> = ({ agents, statuses, multiplexedLogs, allLogs }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [multiplexedLogs]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const selectedAgentLogs = selectedAgentId ? allLogs[selectedAgentId] || [] : [];
  const selectedAgentStatus = selectedAgentId ? statuses[selectedAgentId] || 'IDLE' : 'IDLE';

  return (
    <div className="flex flex-col gap-4 h-full relative overflow-hidden">
      
      {/* Matriz de Células (Colmeia) */}
      <div className="bg-black border border-zinc-800 p-4 rounded-sm">
        <span className="text-xs text-zinc-500 tracking-widest block mb-3">
          SWARM_DENSITY_MATRIX [{agents.length} NODES]
        </span>
        <div className="flex flex-wrap gap-[2px]">
          {agents.map(agent => {
            const status = statuses[agent.id] || 'IDLE';
            let cellClass = 'bg-zinc-800';
            if (status === 'THINKING') cellClass = 'bg-sifto-sla-success animate-pulse';
            if (status === 'TYPING') cellClass = 'bg-sifto-sla-success animate-[ping_0.8s_cubic-bezier(0,0,0.2,1)_infinite]';
            if (status === 'HUMAN_REQUIRED') cellClass = 'bg-rose-500';

            return (
              <div 
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                title={`${agent.name} (${status})`}
                className={`w-4 h-4 rounded-none cursor-pointer hover:ring-1 hover:ring-white transition-all ${cellClass}`}
              />
            );
          })}
        </div>
      </div>

      {/* Multiplexed Terminal */}
      <div className="flex-1 bg-black border border-zinc-800 rounded-sm p-4 overflow-hidden flex flex-col min-h-[300px]">
        <span className="text-xs text-zinc-500 tracking-widest block mb-3 border-b border-zinc-800 pb-2">
          MULTIPLEXED_MASTER_TERMINAL
        </span>
        <div className="flex-1 overflow-y-auto text-xs text-zinc-500">
          {multiplexedLogs.map((log) => (
            <div key={log.id} className="leading-tight mb-1 hover:bg-zinc-900/50 p-0.5 -mx-0.5">
              <span className="text-zinc-600">[{log.timestamp}]</span>{' '}
              <span className="text-sifto-cobalt-light">[{log.agentId?.substring(0, 8) || 'SYS'}]</span>{' '}
              <span className="text-sifto-sla-success">[{log.level}]</span>{' '}
              <span className="text-zinc-400">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Click-to-Focus Overlay (Drawer) */}
      {selectedAgent && (
        <div className="absolute top-0 right-0 h-full w-full md:w-80 bg-[#09090b] border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <div className="flex flex-col">
              <span className="text-sm text-zinc-300">NODE_INSPECTION</span>
              <span className="text-xs text-sifto-sla-success">{selectedAgentStatus}</span>
            </div>
            <button onClick={() => setSelectedAgentId(null)} className="text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-4 border-b border-zinc-800 bg-black">
            <span className="text-sm text-white block">{selectedAgent.name}</span>
            <span className="text-xs text-zinc-500">{selectedAgent.phoneNumber || 'No phone'}</span>
            <span className="text-xs text-zinc-600 block mt-2">ID: {selectedAgent.id}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-black text-xs text-zinc-500">
            <span className="text-zinc-600 block mb-2 border-b border-zinc-800 pb-1">ISOLATED_LOGS</span>
            {selectedAgentLogs.length === 0 ? (
              <span className="text-zinc-700">No logs for this node yet.</span>
            ) : (
              selectedAgentLogs.map(log => (
                <div key={log.id} className="leading-tight mb-1">
                  <span className="text-zinc-600">[{log.timestamp}]</span>{' '}
                  <span className="text-zinc-400">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};
