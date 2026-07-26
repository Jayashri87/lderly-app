import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VitalSignsCard } from '../components/vitals/VitalSignsCard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock fetch
global.fetch = vi.fn();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

describe('VitalSignsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state', () => {
    (global.fetch as any).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <QueryClientProvider client={queryClient}>
        <VitalSignsCard nodeId="bedroom" />
      </QueryClientProvider>
    );

    // Component should render (loading skeleton)
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should render error state', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(
      <QueryClientProvider client={queryClient}>
        <VitalSignsCard nodeId="bedroom" />
      </QueryClientProvider>
    );

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/unable to connect/i)).toBeInTheDocument();
    });
  });
});
