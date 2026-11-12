import { supabase } from './supabase';

export async function createPairCode(): Promise<string> {
  const { data, error } = await supabase.rpc('create_pair_code');
  if (error) throw error;
  return data as string;
}

export type JoinResult = 'ok' | 'invalid_code' | 'already_paired' | 'error';

export async function joinWithCode(code: string): Promise<JoinResult> {
  const { error } = await supabase.rpc('join_pair', { p_code: code.trim() });
  if (!error) return 'ok';
  if (error.message.includes('invalid_code')) return 'invalid_code';
  if (error.message.includes('already_paired')) return 'already_paired';
  return 'error';
}
