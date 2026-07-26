import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNodeVitals, useAllVitals } from '../hooks/useVitals';

// Mock fetch
global.fetch = vi.fn();

describe('useVitals hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useNodeVitals', () => {
    it('should fetch vitals for a specific node', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          vitalSigns: {
            heartRate: 72,
            breathingRate: 16,
            presence: true,
            personCount: 1,
            motionLevel: 0.25,
          },
        }),
      });

      const { result } = renderHook(() => useNodeVitals('bedroom'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('useAllVitals', () => {
    it('should fetch vitals from all nodes', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          data: [
            {
              nodeId: 'bedroom',
              vitalSigns: {
                heartRate: 72,
                presence: true,
              },
            },
          ],
        }),
      });

      const { result } = renderHook(() => useAllVitals());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
