import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';

export async function fetchSession(userId: string) {
  const { data } = await supabase
    .from('cas_inbound_session')
    .select('inbound_email_address')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.inbound_email_address ?? null;
}

export async function callCreateSession(): Promise<string> {
  // Use supabase.functions.invoke so the client handles JWT auth headers
  // and token refresh automatically — raw fetch with manual Bearer tokens
  // can fail Supabase's built-in JWT gate on edge functions.
  const { data, error } = await supabase.functions.invoke('create-inbound-session', {
    method: 'POST',
  });

  if (error) throw new Error(error.message);
  if (!data?.inboundEmail) throw new Error('No inbound email returned');
  return data.inboundEmail as string;
}

export function useInboundSession(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: inboundEmail, isLoading } = useQuery({
    queryKey: ['inbound-session', userId],
    queryFn: () => fetchSession(userId!),
    enabled: !!userId,
  });

  const createSession = useMutation({
    mutationFn: callCreateSession,
    onSuccess: (email) => {
      queryClient.setQueryData(['inbound-session', userId], email);
    },
  });

  return { inboundEmail, isLoading, createSession };
}
