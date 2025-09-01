import { createClient } from '@supabase/supabase-js'

// TypeScript declarations for Vite environment variables
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase config - URL:', supabaseUrl ? 'Set' : 'Missing', 'Key:', supabaseAnonKey ? 'Set' : 'Missing');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('Supabase client created successfully');

// Database table names
export const TABLES = {
  PROFILES: 'profiles',
  ANALYSIS_HISTORY: 'analysis_history',
  ANALYSIS_ERRORS: 'analysis_errors',
  SHARED_REPORTS: 'shared_reports',
  SHARED_REPORT_REVIEWERS: 'shared_report_reviewers',
  SHARED_REPORT_DECISIONS: 'shared_report_decisions'
} as const
