import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActionBar } from '../components/ActionBar';
import { AiCopilotPanel } from '../components/AiCopilotPanel';
import * as SocketContextModule from '../../../context/SocketContext';
import * as chatApi from '../services/chatApi';

// Mocks
vi.mock('../../../context/SocketContext', () => ({
  useSocket: vi.fn(),
}));
vi.mock('../services/chatApi', () => ({
  sendReplyToLead: vi.fn(),
  toggleLeadAutonomy: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithQueryClient = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('ChatSimulator Integration', () => {
  let mockSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the socket object
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };

    (SocketContextModule.useSocket as any).mockReturnValue({
      socket: mockSocket,
      isConnected: true,
    });
  });

  describe('AiCopilotPanel', () => {
    it('should display the draft card when lead.draft_suggested is received for the active lead', () => {
      const handleUseDraft = vi.fn();
      render(<AiCopilotPanel leadId="lead-123" onUseDraft={handleUseDraft} />);

      const draftHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'lead.draft_suggested')[1];

      act(() => {
        draftHandler({ leadId: 'lead-123', draftContent: 'Olá, como posso ajudar?' });
      });

      expect(screen.getByText('Olá, como posso ajudar?')).toBeDefined();
    });

    it('should call onUseDraft and hide panel when clicking "Usar Rascunho"', () => {
      const handleUseDraft = vi.fn();
      render(<AiCopilotPanel leadId="lead-123" onUseDraft={handleUseDraft} />);

      const draftHandler = mockSocket.on.mock.calls.find((call: any) => call[0] === 'lead.draft_suggested')[1];
      
      act(() => {
        draftHandler({ leadId: 'lead-123', draftContent: 'Rascunho de Teste' });
      });

      const useDraftButton = screen.getByText('Usar Rascunho');
      fireEvent.click(useDraftButton);

      expect(handleUseDraft).toHaveBeenCalledWith('Rascunho de Teste');
      expect(screen.queryByText('Rascunho de Teste')).toBeNull();
    });
  });

  describe('ActionBar', () => {
    it('should update textarea when typing', () => {
      const setDraftContent = vi.fn();
      renderWithQueryClient(
        <ActionBar leadId="lead-123" draftContent="" setDraftContent={setDraftContent} />
      );

      const textarea = screen.getByPlaceholderText(/Digite sua mensagem/i);
      fireEvent.change(textarea, { target: { value: 'Nova mensagem' } });

      expect(setDraftContent).toHaveBeenCalledWith('Nova mensagem');
    });

    it('should toggle autonomy and call API', async () => {
      const setDraftContent = vi.fn();
      (chatApi.toggleLeadAutonomy as any).mockResolvedValue({});

      renderWithQueryClient(
        <ActionBar leadId="lead-123" draftContent="" setDraftContent={setDraftContent} />
      );

      // Initially active, clicking it will pause it
      const toggleButton = screen.getByText('IA Ativa');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(chatApi.toggleLeadAutonomy).toHaveBeenCalledWith('lead-123', true);
      });
      
      expect(screen.getByText('IA Pausada')).toBeDefined();
    });
  });
});
