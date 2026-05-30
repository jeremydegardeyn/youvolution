import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (!error && data) setProfile(data);
    return { error };
  };

  return { profile, loading, updateProfile, refetch: fetchProfile };
}
