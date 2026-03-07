import { supabase } from '@/integrations/supabase/client';

let cachedPublicIp: string | null = null;

async function getPublicIp(): Promise<string | null> {
  if (cachedPublicIp) return cachedPublicIp;
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    cachedPublicIp = data.ip;
    return cachedPublicIp;
  } catch (e) {
    return null;
  }
}

export async function registerPresence(roomCode: string, displayName?: string) {
  const public_ip = await getPublicIp();
  if (!public_ip) return;
  try {
    await supabase.from('room_presence').upsert({
      room_code: roomCode,
      public_ip,
      display_name: displayName || null,
      last_seen: new Date().toISOString(),
      meta: {},
    }, { onConflict: ['room_code', 'public_ip'] });
  } catch (e) {
    // silent
  }
}

export async function fetchNearbyRooms(ttlMillis = 2 * 60 * 1000) {
  const public_ip = await getPublicIp();
  if (!public_ip) return [] as { room_code: string; display_name?: string; last_seen: string }[];
  const since = new Date(Date.now() - ttlMillis).toISOString();
  try {
    const { data, error } = await supabase
      .from('room_presence')
      .select('room_code, display_name, last_seen')
      .eq('public_ip', public_ip)
      .gte('last_seen', since);
    if (error) return [];
    // dedupe by room_code, pick the newest
    const map = new Map<string, any>();
    (data || []).forEach((r: any) => {
      const existing = map.get(r.room_code);
      if (!existing || new Date(r.last_seen) > new Date(existing.last_seen)) map.set(r.room_code, r);
    });
    return Array.from(map.values());
  } catch (e) {
    return [];
  }
}

export async function cleanupOldPresence(ttlMillis = 5 * 60 * 1000) {
  const cutoff = new Date(Date.now() - ttlMillis).toISOString();
  try {
    await supabase.from('room_presence').delete().lt('last_seen', cutoff);
  } catch (e) {
    // ignore
  }
}
