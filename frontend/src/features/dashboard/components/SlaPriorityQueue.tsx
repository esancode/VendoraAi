import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPriorityLeads } from '../../../services/dashboardApi';
import { Loader2 } from 'lucide-react';
import { useSocket } from '../../../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import { LeadCard } from './LeadCard';

export const SlaPriorityQueue: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  const { data: leads, isLoading, isError } = useQuery({
    queryKey: ['priority-leads'],
    queryFn: () => getPriorityLeads(),
  });

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: ['priority-leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    };

    socket.on('lead.received', handleNewMessage);
    socket.on('webhook.whatsapp.received', handleNewMessage);

    return () => {
      socket.off('lead.received', handleNewMessage);
      socket.off('webhook.whatsapp.received', handleNewMessage);
    };
  }, [socket, isConnected, queryClient]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-zinc-500 bg-black border border-zinc-800 rounded-sm">
        <Loader2 className="w-4 h-4 animate-spin mb-2" />
        <span className="text-[10px]">LOADING QUEUE...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-rose-500 bg-black border border-rose-900 rounded-sm">
        <span className="text-[10px]">ERROR LOADING QUEUE</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#09090b] border border-zinc-800 rounded-sm h-full max-h-[800px]">
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <span className="text-xs text-zinc-400">[PRIORITY_QUEUE]</span>
        <span className="text-[10px] text-zinc-500">{leads?.length || 0} WAITING</span>
      </div>
      
      <div className="flex flex-col p-2 gap-2 overflow-y-auto">
        {!leads || leads.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <span className="text-[10px] text-zinc-600">QUEUE EMPTY</span>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => navigate('/chat')} />
          ))
        )}
      </div>
    </div>
  );
};
