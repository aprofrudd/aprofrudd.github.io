// Supabase data layer. Three tables (see ../supabase-setup.sql):
//   teams    one row per team, grouped by class_code
//   answers  one row per (team, field) so teammates editing different boxes never overwrite each other
//   attempts jump log rows, keyed by a client-generated id so retries are idempotent
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// The tutor's rotation clock is stored as an answer on a hidden team with this name.
export const CONTROL = '__control__';

function must({ data, error }) {
  if (error) throw error;
  return data;
}

export async function listTeams(classCode) {
  return must(await sb.from('teams').select('*').eq('class_code', classCode).order('created_at'));
}

export async function getOrCreateTeam(classCode, name) {
  const find = async () => must(await sb.from('teams').select('*').eq('class_code', classCode).eq('name', name).maybeSingle());
  const found = await find();
  if (found) return found;
  const { data, error } = await sb.from('teams').insert({ class_code: classCode, name }).select().single();
  if (error?.code === '23505') return find(); // another device created it a moment ago
  if (error) throw error;
  return data;
}

export async function loadAnswers(teamIds) {
  if (!teamIds.length) return [];
  return must(await sb.from('answers').select('*').in('team_id', teamIds));
}

export async function saveAnswer(team_id, field, value) {
  must(await sb.from('answers').upsert({ team_id, field, value, updated_at: new Date().toISOString() }));
}

// rows: [{ field, value, updated_at }]
export async function saveAnswers(team_id, rows) {
  if (!rows.length) return;
  must(await sb.from('answers').upsert(rows.map((r) => ({ team_id, ...r }))));
}

export async function loadAttempts(teamIds) {
  if (!teamIds.length) return [];
  return must(await sb.from('attempts').select('*').in('team_id', teamIds).order('created_at'));
}

export async function saveAttempt(row) {
  must(await sb.from('attempts').upsert(row));
}

// Live changes. `teamId` null = every team (tutor view filters client-side).
export function subscribe(teamId, { onAnswer, onAttempt, onTeam, onStatus }) {
  const filter = teamId ? { filter: `team_id=eq.${teamId}` } : {};
  const ch = sb.channel(`ia-${teamId || 'all'}-${Math.random().toString(36).slice(2, 8)}`);
  if (onAnswer) ch.on('postgres_changes', { event: '*', schema: 'public', table: 'answers', ...filter }, (p) => onAnswer(p.new));
  if (onAttempt) ch.on('postgres_changes', { event: '*', schema: 'public', table: 'attempts', ...filter }, (p) => onAttempt(p.new));
  if (onTeam) ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'teams' }, (p) => onTeam(p.new));
  ch.subscribe((status) => onStatus?.(status));
  return () => sb.removeChannel(ch);
}

export async function getRotation(classCode) {
  const control = must(await sb.from('teams').select('id').eq('class_code', classCode).eq('name', CONTROL).maybeSingle());
  if (!control) return null;
  const row = must(await sb.from('answers').select('value').eq('team_id', control.id).eq('field', 'rotation').maybeSingle());
  try { return row ? JSON.parse(row.value) : null; } catch { return null; }
}

export async function setRotation(classCode, rotation) {
  const control = await getOrCreateTeam(classCode, CONTROL);
  await saveAnswer(control.id, 'rotation', JSON.stringify(rotation));
}

// Fires when any class's rotation clock changes; callers re-read their own class's clock.
export function onRotationChange(cb) {
  const ch = sb.channel(`ia-rot-${Math.random().toString(36).slice(2, 8)}`);
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: 'field=eq.rotation' }, () => cb());
  ch.subscribe();
  return () => sb.removeChannel(ch);
}
