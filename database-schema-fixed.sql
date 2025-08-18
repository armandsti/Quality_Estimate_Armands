-- Database schema for QA Analysis Tool (Fixed for Supabase)
-- Run this in your Supabase SQL editor

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analysis_history table
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analysis_errors table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON public.analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_history_created_at ON public.analysis_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_errors_history_entry_id ON public.analysis_errors(history_entry_id);
CREATE INDEX IF NOT EXISTS idx_analysis_errors_severity ON public.analysis_errors(severity);
CREATE INDEX IF NOT EXISTS idx_analysis_errors_category ON public.analysis_errors(error_category);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_errors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for analysis_history
CREATE POLICY "Users can view own analysis history" ON public.analysis_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis history" ON public.analysis_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analysis history" ON public.analysis_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analysis history" ON public.analysis_history
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for analysis_errors
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT ALL ON public.analysis_history TO anon, authenticated;
GRANT ALL ON public.analysis_errors TO anon, authenticated;

-- Create a function to handle profile creation (will be called from the app)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, just return
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log the error but don't fail the signup
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger will be created automatically by Supabase
-- If you need to create it manually, you can do it through the dashboard
-- or use this command (but it might still give permission errors):
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
