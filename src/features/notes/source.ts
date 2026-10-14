import { supabase } from '@/lib/supabase'
import { createSupabaseSource } from './supabaseSource'
import { createLocalSource } from './localSource'
import type { DataSource } from './dataSource'

/** Supabase when configured, otherwise a browser-only demo store. */
export const source: DataSource = supabase ? createSupabaseSource(supabase) : createLocalSource()
