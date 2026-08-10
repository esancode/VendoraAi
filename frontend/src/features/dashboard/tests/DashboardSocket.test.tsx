import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardContainer } from '../components/DashboardContainer';
import { useSocket } from '../../../context/SocketContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

// Mock dependencies
vi.mock('../../../context/SocketContext', () => ({
  useSocket: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => {
  const original = vi.importActual('@tanstack/react-query');
  return {
    ...original,
    useQuery: vi.fn().mockReturnValue({ data: null, isLoading: false }),
    useQueryClient: vi.fn(),
  };
});

vi.mock('react-hot-toast', () => ({
  toast: {
    custom: vi.fn(),
  },
}));

// We need to mock PriorityLeadsList to avoid rendering its complex logic in this test
vi.mock('../components/PriorityLeadsList', () => ({
  PriorityLeadsList: () => <div data-testid="priority-leads-list">List</div>,
}));

describe('DashboardContainer Socket Integration', () => {
  let mockSocketOn: any;
  let mockSocketOff: any;
  let mockInvalidateQueries: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSocketOn = vi.fn();
    mockSocketOff = vi.fn();
    mockInvalidateQueries = vi.fn();

    (useQueryClient as any).mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });

    (useSocket as any).mockReturnValue({
      socket: {
        on: mockSocketOn,
        off: mockSocketOff,
      },
      isConnected: true,
    });
  });

  it('registers socket listeners on mount and cleans up on unmount', () => {
    const { unmount } = render(<DashboardContainer />);

    expect(mockSocketOn).toHaveBeenCalledWith('lead.received', expect.any(Function));
    expect(mockSocketOn).toHaveBeenCalledWith('webhook.whatsapp.received', expect.any(Function));
    expect(mockSocketOn).toHaveBeenCalledWith('lead.sla_warning', expect.any(Function));
    expect(mockSocketOn).toHaveBeenCalledWith('lead.sla_breached', expect.any(Function));

    unmount();

    expect(mockSocketOff).toHaveBeenCalledWith('lead.received', expect.any(Function));
    expect(mockSocketOff).toHaveBeenCalledWith('lead.sla_warning', expect.any(Function));
  });

  it('invalidates queries on new message events', () => {
    render(<DashboardContainer />);

    // Get the registered callback for 'lead.received'
    const leadReceivedCallback = mockSocketOn.mock.calls.find(call => call[0] === 'lead.received')[1];
    
    // Trigger it
    leadReceivedCallback();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['priority-leads'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard-stats'] });
  });

  it('shows toast and invalidates queries on sla warning', () => {
    render(<DashboardContainer />);

    const slaWarningCallback = mockSocketOn.mock.calls.find(call => call[0] === 'lead.sla_warning')[1];
    
    slaWarningCallback({ leadName: 'Maria' });

    expect(toast.custom).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['priority-leads'] });
  });
});
