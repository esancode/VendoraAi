import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMessagesByLeadId } from '../services/chatApi';
import { MessageSender } from '../types';
import { Loader2, Zap } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface MessageListProps {
  leadId: string;
}

export const MessageList: React.FC<MessageListProps> = ({ leadId }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading, isError } = useQuery({
    queryKey: ['messages', leadId],
    queryFn: () => getMessagesByLeadId(leadId),
    enabled: !!leadId,
    staleTime: 10 * 1000,
  });

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex justify-center items-center text-red-400">
        <p>Erro ao carregar o histórico de mensagens.</p>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex justify-center items-center text-zinc-500">
        <p>Nenhuma mensagem ainda.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      {messages.map((msg) => {
        const isFromCompany = msg.sender === MessageSender.USER || msg.sender === MessageSender.SYSTEM;
        const isAI = msg.sender === MessageSender.SYSTEM;

        return (
          <div 
            key={msg.id} 
            className={cn(
              "flex flex-col max-w-[85%] md:max-w-[75%]",
              isFromCompany ? "self-end items-end" : "self-start items-start"
            )}
          >
            {isAI && (
              <span className="flex items-center text-[10px] font-bold text-sifto-cobalt-light mb-1 ml-1 mr-1 uppercase tracking-wider bg-sifto-cobalt-light/10 px-1.5 py-0.5 rounded border border-sifto-cobalt-light/20">
                <Zap className="w-3 h-3 mr-0.5 fill-sifto-cobalt-light" /> IA
              </span>
            )}
            
            <div 
              className={cn(
                "px-4 py-2.5 rounded  text-[15px] leading-relaxed",
                isFromCompany 
                  ? "bg-black border border-zinc-800 text-white" 
                  : "bg-zinc-900 text-white"
              )}
            >
              {msg.content}
            </div>
            
            <span className="text-[11px] text-zinc-500 mt-1 mx-1 ">
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
