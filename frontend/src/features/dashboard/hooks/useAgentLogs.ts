import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../../../context/SocketContext';

export type AgentStatus = 'IDLE' | 'THINKING' | 'TYPING' | 'HUMAN_REQUIRED';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  agentId?: string;
}

export const useAgentLogs = (agentIds: string[]) => {
  const { socket, isConnected } = useSocket();
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({});
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});
  
  // Ref for the timer to manage heartbeat
  const lastActivityRef = useRef<Record<string, number>>({});

  const addLog = useCallback((agentId: string, level: string, message: string) => {
    setLogs(prev => {
      const currentLogs = prev[agentId] || [];
      const newLog: LogEntry = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
        level,
        message,
        agentId,
      };
      return {
        ...prev,
        [agentId]: [...currentLogs.slice(-29), newLog], // Max 30 logs per agent
      };
    });
    lastActivityRef.current[agentId] = Date.now();
  }, []);

  const updateStatus = useCallback((agentId: string, status: AgentStatus) => {
    setStatuses(prev => ({ ...prev, [agentId]: status }));
  }, []);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleStatusChanged = (data: { agentId: string; status: AgentStatus; reason?: string }) => {
      if (agentIds.includes(data.agentId)) {
        updateStatus(data.agentId, data.status);
        addLog(data.agentId, 'SYS', `Status changed to ${data.status}`);
      }
    };

    const handleMessageProcessed = (data: { agentId: string; type: string; message: string; from?: string }) => {
      if (agentIds.includes(data.agentId)) {
        const prefix = data.type.toUpperCase();
        addLog(data.agentId, prefix, data.from ? `${data.from}: "${data.message}"` : data.message);
      }
    };

    socket.on('agent.status_changed', handleStatusChanged);
    socket.on('lead.message_processed', handleMessageProcessed);

    // Initial default logs for agents that just connected
    agentIds.forEach(id => {
      if (!logs[id]) {
        addLog(id, 'SYSTEM', 'Node initialized. Waiting for traffic...');
        updateStatus(id, 'IDLE');
      }
    });

    return () => {
      socket.off('agent.status_changed', handleStatusChanged);
      socket.off('lead.message_processed', handleMessageProcessed);
    };
  }, [socket, isConnected, agentIds, addLog, updateStatus]);

  // Heartbeat Effect: Injects a ping if idle for > 40s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      agentIds.forEach(id => {
        const lastActivity = lastActivityRef.current[id] || 0;
        if (now - lastActivity > 40000 && statuses[id] === 'IDLE') {
          addLog(id, 'PING', 'Connection stable on port 443. Waiting for events...');
        }
      });
    }, 10000); // Check every 10s

    return () => clearInterval(interval);
  }, [agentIds, statuses, addLog]);

  // Derived selector for multiplexed terminal (returns single flat array limited to 50 total)
  const getMultiplexedLogs = useCallback((): LogEntry[] => {
    const allLogs = Object.values(logs).flat();
    return allLogs
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id))
      .slice(-50);
  }, [logs]);

  return {
    statuses,
    logs,
    addLog,
    updateStatus,
    getMultiplexedLogs
  };
};
