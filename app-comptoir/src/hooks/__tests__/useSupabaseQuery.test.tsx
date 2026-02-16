import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSupabaseQuery } from '../useSupabaseQuery';
import { supabase } from '../../config/supabase';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSupabaseQuery', () => {
  it('should fetch data successfully', async () => {
    const mockData = [{ id: '1', name: 'Test' }];
    
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      }),
    } as any);

    const { result } = renderHook(
      () =>
        useSupabaseQuery(['test'], (supabase) =>
          supabase.from('test').select('*')
        ),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('should handle errors', async () => {
    const mockError = { message: 'Test error' };
    
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      }),
    } as any);

    const { result } = renderHook(
      () =>
        useSupabaseQuery(['test'], (supabase) =>
          supabase.from('test').select('*')
        ),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(mockError);
  });
});
