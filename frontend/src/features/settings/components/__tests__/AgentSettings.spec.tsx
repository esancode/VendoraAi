import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentSettings } from '../AgentSettings';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';

const { mockGet, mockPost, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDelete: vi.fn(),
}));

// Mock axios
vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => ({
        get: mockGet,
        post: mockPost,
        delete: mockDelete,
      })),
    },
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderComponent = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <AgentSettings />
    </QueryClientProvider>
  );
};

describe('AgentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('deve cadastrar um novo exemplo Few-Shot e invocar a API de examples', async () => {
    // Setup mock para GET initial
    mockGet.mockResolvedValue({ data: [] });
    // Setup mock para POST
    mockPost.mockResolvedValue({ data: { success: true } });

    renderComponent();

    // Fill form
    const userQueryInput = screen.getByPlaceholderText(/Ex: "Achei o frete muito caro..."/i);
    const expectedResponseInput = screen.getByPlaceholderText(/Ex: "Compreendo. Conseguimos oferecer frete grátis/i);
    const addButton = screen.getByTestId('add-example-btn');

    fireEvent.change(userQueryInput, { target: { value: 'Qual o valor do produto?' } });
    fireEvent.change(expectedResponseInput, { target: { value: 'O valor é R$ 100.' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/agent/examples', {
        userQuery: 'Qual o valor do produto?',
        expectedResponse: 'O valor é R$ 100.',
      });
    });
  });
});
