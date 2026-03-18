import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export function useWebhookToken(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['webhook-token', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_token')
        .select('token')
        .eq('user_id', userId!)
        .maybeSingle();

      if (error) throw error;
      return data?.token as string | null;
    },
  });

  const createToken = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('webhook_token')
        .insert({ user_id: userId! })
        .select('token')
        .single();
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhook-token', userId] }),
  });

  const regenerateToken = useMutation({
    mutationFn: async () => {
      // Delete existing then insert new
      await supabase.from('webhook_token').delete().eq('user_id', userId!);
      const { data, error } = await supabase
        .from('webhook_token')
        .insert({ user_id: userId! })
        .select('token')
        .single();
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhook-token', userId] }),
  });

  const webhookUrl = query.data
    ? `${SUPABASE_URL}/functions/v1/cas-webhook?token=${query.data}`
    : null;

  return { token: query.data, webhookUrl, loading: query.isLoading, createToken, regenerateToken };
}
