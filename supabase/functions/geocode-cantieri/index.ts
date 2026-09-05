// Supabase Edge Function – geocode-cantieri
// Geocodifica (Nominatim/OSM) i cantieri senza coordinate, a lotti, chiamata da
// public.geocode_tick() via pg_cron. Scrive con il service_role.
//
// 05/09/2026 (audit): ogni passaggio incrementa cantieri.geocode_tentativi;
// dopo 3 tentativi il cantiere esce dalla coda (cantieri_da_geocodificare)
// invece di essere ritentato all'infinito — 348 cantieri irrisolvibili
// venivano riprovati ogni minuto.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const UA = 'FormedilPadovaGestionale/1.0 (cptpd@did.formedilpadova.it)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nominatim(params: Record<string,string>) {
  const base = 'https://nominatim.openstreetmap.org/search';
  const p = new URLSearchParams({ format: 'json', limit: '1', ...params });
  const r = await fetch(`${base}?${p}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const j = await r.json();
  if (Array.isArray(j) && j.length) return { lat: +j[0].lat, lng: +j[0].lon };
  return null;
}

async function geocode(street: string, city: string, postalcode: string) {
  if (street) {
    const s1: Record<string,string> = { country: 'Italia', city, street };
    if (postalcode) s1.postalcode = postalcode;
    let g = await nominatim(s1);
    if (g) return { ...g, mode: 'ok' };
    await sleep(1100);
    const q = [street, postalcode, city, 'Italia'].filter(Boolean).join(', ');
    g = await nominatim({ q });
    if (g) return { ...g, mode: 'ok' };
    await sleep(1100);
  }
  if (city) {
    let g = await nominatim({ country: 'Italia', city, state: 'Veneto' });
    if (!g) { await sleep(1100); g = await nominatim({ q: `${city}, Padova, Italia` }); }
    if (g) return { ...g, mode: 'comune' };
  }
  return null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '40'), 60);
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rows, error } = await db.rpc('cantieri_da_geocodificare', { p_limit: limit });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  let ok = 0, comune = 0, fail = 0;
  for (const c of rows ?? []) {
    const street = [c.cantiere_indirizzo, c.cantiere_civico].filter(Boolean).join(' ').replace(/\bSNC\b/gi,'').trim();
    // il tentativo si conta PRIMA di provare: se la funzione muore a meta'
    // lotto, il cantiere non resta a zero per sempre
    const { data: cur } = await db.from('cantieri').select('geocode_tentativi').eq('cantiere_id', c.cantiere_id).maybeSingle();
    const tentativi = (cur?.geocode_tentativi ?? 0) + 1;
    try {
      const g = await geocode(street, c.comune_nome || '', c.cantiere_cap || '');
      if (g) {
        await db.from('cantieri').update({ lat: g.lat, lng: g.lng, geocode_status: g.mode, geocoded_at: new Date().toISOString(), geocode_tentativi: tentativi }).eq('cantiere_id', c.cantiere_id);
        if (g.mode === 'comune') comune++; else ok++;
      } else {
        await db.from('cantieri').update({ geocode_status: 'not_found', geocoded_at: new Date().toISOString(), geocode_tentativi: tentativi }).eq('cantiere_id', c.cantiere_id);
        fail++;
      }
    } catch (_e) {
      await db.from('cantieri').update({ geocode_status: 'error', geocode_tentativi: tentativi }).eq('cantiere_id', c.cantiere_id);
      fail++;
    }
    await sleep(1100);
  }
  return new Response(JSON.stringify({ processed: (rows ?? []).length, ok, comune, fail }), { headers: { 'Content-Type': 'application/json' } });
});
