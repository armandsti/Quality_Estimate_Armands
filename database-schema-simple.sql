-- Simplified Database schema for QA Analysis Tool
-- Run this in your Supabase SQL editor to fix the current issues

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS public.analysis_errors CASCADE;
DROP TABLE IF EXISTS public.analysis_history CASCADE;
DROP TABLE IF EXISTS public.shared_reports CASCADE;
DROP TABLE IF EXISTS public.shared_report_reviewers CASCADE;
DROP TABLE IF EXISTS public.shared_report_decisions CASCADE;

-- Create analysis_history table with correct UUID types
CREATE TABLE IF NOT EXISTS public.analysis_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_file_name TEXT NOT NULL,
  target_file_name TEXT,
  source_file_content TEXT,
  target_file_content TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  severity_counts JSONB NOT NULL DEFAULT '{"Critical": 0, "Major": 0, "Minor": 0}'::jsonb,
  confirmed_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  workflow_status TEXT DEFAULT 'draft',
  shared_report_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analysis_errors table with correct UUID types
CREATE TABLE IF NOT EXISTS public.analysis_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  history_entry_id UUID REFERENCES public.analysis_history(id) ON DELETE CASCADE NOT NULL,
  segment_id TEXT,
  source_segment TEXT NOT NULL,
  target_segment TEXT NOT NULL,
  source_highlight TEXT,
  target_highlight TEXT,
  error_category TEXT NOT NULL,
  error_type TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_correction TEXT NOT NULL,
  suggestion_highlight TEXT,
  severity TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  rejected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shared_reports table
CREATE TABLE IF NOT EXISTS public.shared_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  history_entry_id UUID REFERENCES public.analysis_history(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workflow_status TEXT NOT NULL DEFAULT 'shared',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shared_report_reviewers table
CREATE TABLE IF NOT EXISTS public.shared_report_reviewers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_report_id UUID REFERENCES public.shared_reports(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reviewer_email TEXT NOT NULL,
  reviewer_name TEXT,
  role TEXT NOT NULL DEFAULT 'reviewer',
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shared_report_id, reviewer_id)
);

-- Create shared_report_decisions table
CREATE TABLE IF NOT EXISTS public.shared_report_decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_report_id UUID REFERENCES public.shared_reports(id) ON DELETE CASCADE NOT NULL,
  error_id INTEGER NOT NULL,
  accepted BOOLEAN NOT NULL,
  rejected BOOLEAN NOT NULL,
  decided_by TEXT NOT NULL,
  decided_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(shared_report_id, error_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON public.analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_history_created_at ON public.analysis_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_errors_history_entry_id ON public.analysis_errors(history_entry_id);
CREATE INDEX IF NOT EXISTS idx_analysis_errors_severity ON public.analysis_errors(severity);
CREATE INDEX IF NOT EXISTS idx_analysis_errors_category ON public.analysis_errors(error_category);
CREATE INDEX IF NOT EXISTS idx_shared_reports_history_entry_id ON public.shared_reports(history_entry_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_creator_id ON public.shared_reports(creator_id);
CREATE INDEX IF NOT EXISTS idx_shared_report_reviewers_shared_report_id ON public.shared_report_reviewers(shared_report_id);
CREATE INDEX IF NOT EXISTS idx_shared_report_reviewers_reviewer_id ON public.shared_report_reviewers(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_shared_report_decisions_shared_report_id ON public.shared_report_decisions(shared_report_id);

-- Enable Row Level Security on all tables
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_report_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_report_decisions ENABLE ROW LEVEL SECURITY;

-- Create simple RLS policies for analysis_history
CREATE POLICY "Users can view own analysis history" ON public.analysis_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis history" ON public.analysis_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analysis history" ON public.analysis_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analysis history" ON public.analysis_history
  FOR DELETE USING (auth.uid() = user_id);

-- Create simple RLS policies for analysis_errors
CREATE POLICY "Users can view own analysis errors" ON public.analysis_errors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.analysis_history 
      WHERE id = analysis_errors.history_entry_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own analysis errors" ON public.analysis_errors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_history 
      WHERE id = analysis_errors.history_entry_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own analysis errors" ON public.analysis_errors
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.analysis_history 
      WHERE id = analysis_errors.history_entry_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own analysis errors" ON public.analysis_errors
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.analysis_history 
      WHERE id = analysis_errors.history_entry_id 
      AND user_id = auth.uid()
    )
  );

-- Create simple RLS policies for shared_reports
CREATE POLICY "Users can view shared reports they created" ON public.shared_reports
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Users can insert shared reports" ON public.shared_reports
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update shared reports they created" ON public.shared_reports
  FOR UPDATE USING (auth.uid() = creator_id);

-- Create simple RLS policies for shared_report_reviewers
CREATE POLICY "Users can view reviewers for reports they created" ON public.shared_report_reviewers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shared_reports 
      WHERE id = shared_report_reviewers.shared_report_id 
      AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reviewers" ON public.shared_report_reviewers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shared_reports 
      WHERE id = shared_report_reviewers.shared_report_id 
      AND creator_id = auth.uid()
    )
  );

-- Create simple RLS policies for shared_report_decisions
CREATE POLICY "Users can view decisions for reports they created" ON public.shared_report_decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shared_reports 
      WHERE id = shared_report_decisions.shared_report_id 
      AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert decisions" ON public.shared_report_decisions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shared_reports 
      WHERE id = shared_report_decisions.shared_report_id 
      AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can update decisions" ON public.shared_report_decisions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.shared_reports 
      WHERE id = shared_report_decisions.shared_report_id 
      AND creator_id = auth.uid()
    )
  );

-- Verify the schema was created successfully
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('analysis_history', 'analysis_errors', 'shared_reports', 'shared_report_reviewers', 'shared_report_decisions')
ORDER BY table_name, ordinal_position;
