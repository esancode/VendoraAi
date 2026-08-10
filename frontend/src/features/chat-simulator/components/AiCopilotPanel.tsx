import React, { useEffect, useState } from 'react';
import { useSocket } from '../../../context/SocketContext';
import { Lightbulb, Copy } from 'lucide-react';

interface AiCopilotPanelProps {
  leadId: string;
  onUseDraft: (draftContent: string) => void;
}

export const AiCopilotPanel: React.FC<AiCopilotPanelProps> = ({ leadId, onUseDraft }) => {
  const { socket, isConnected } = useSocket();
  const [draftContent, setDraftContent] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleDraftSuggested = (data: { leadId: string; draftContent: string }) => {
      // Only show draft if it's for the currently active lead
      if (data.leadId === leadId) {
        setDraftContent(data.draftContent);
      }
    };

    socket.on('lead.draft_suggested', handleDraftSuggested);

    return () => {
      socket.off('lead.draft_suggested', handleDraftSuggested);
    };
  }, [socket, isConnected, leadId]);

  // Reset draft if lead changes
  useEffect(() => {
    setDraftContent(null);
  }, [leadId]);

  if (!draftContent) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-4 px-4 pointer-events-none">
      <div className="bg-zinc-900/90  border border-indigo-500/30 rounded p-4  -indigo-900/20 transform transition-all animate-enter pointer-events-auto">
        <div className="flex items-center gap-2 mb-2 text-indigo-400">
          <Lightbulb className="w-5 h-5 fill-indigo-400/20" />
          <h4 className="font-semibold text-sm">Sugestão da IA</h4>
        </div>
        
        <p className="text-zinc-300 text-sm mb-3 leading-relaxed">
          {draftContent}
        </p>
        
        <div className="flex justify-end">
          <button
            onClick={() => {
              onUseDraft(draftContent);
              setDraftContent(null); // Dismiss after use
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded transition-colors"
          >
            <Copy className="w-4 h-4" />
            Usar Rascunho
          </button>
        </div>
      </div>
    </div>
  );
};
