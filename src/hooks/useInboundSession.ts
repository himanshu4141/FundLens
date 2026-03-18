import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

async function fetchSession(userId: string) {
  const { data } = await supabase
    .from('cas_inbound_session')
    .select('inbound_email_address')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.inbound_email_address ?? null;
}

async function callCreateSession(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-inbound-session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  const data = await res.json();
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
