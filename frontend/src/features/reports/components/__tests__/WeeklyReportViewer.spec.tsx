import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WeeklyReportViewer } from '../WeeklyReportViewer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

// Mock axios
vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => ({
        get: mockGet,
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
      <WeeklyReportViewer />
    </QueryClientProvider>
  );
};

describe('WeeklyReportViewer', () => {
  let createObjectURLMock: any;
  let revokeObjectURLMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    
    createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-url');
    revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve chamar o mock de download e simular o clique do link ao baixar PDF', async () => {
    // Setup mock para GET initial
    mockGet.mockImplementation(async (url: string) => {
      if (url === '/reports/weekly') {
        return {
          data: {
            id: '123',
            period: 'Mock Period',
            markdownContent: 'Mock Report Content',
            generatedAt: new Date().toISOString(),
          }
        };
      }
      if (url === '/reports/weekly/download') {
        return { data: new Blob(['pdf-data'], { type: 'application/pdf' }) };
      }
      return { data: null };
    });

    renderComponent();

    const downloadButton = await screen.findByRole('button', { name: /Baixar Relatório PDF/i });
    await waitFor(() => {
      expect(downloadButton.hasAttribute('disabled')).toBe(false);
    });
    
    // Mock the click on the created link
    const linkMock = {
      href: '',
      setAttribute: vi.fn(),
      click: vi.fn(),
      parentNode: {
        removeChild: vi.fn(),
      },
    };
    
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') return linkMock as any;
      return originalCreateElement(tagName);
    });
    
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {
      return linkMock as any;
    });

    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/reports/weekly/download', {
        responseType: 'blob',
      });
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(linkMock.setAttribute).toHaveBeenCalledWith('download', 'relatorio_semanal.pdf');
      expect(linkMock.click).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:http://localhost/mock-url');
    });

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
  });
});
