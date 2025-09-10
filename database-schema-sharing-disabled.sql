-- SHARING FEATURE DISABLED - Migration Script
-- This script comments out sharing-related functionality while preserving tables for future use

-- Remove sharing-related columns from analysis_history (optional - can keep for future use)
-- ALTER TABLE public.analysis_history DROP COLUMN IF EXISTS shared_report_id;

-- Disable sharing tables by removing permissions (but keep tables for future use)
-- REVOKE ALL ON public.shared_reports FROM anon, authenticated;
-- REVOKE ALL ON public.shared_report_reviewers FROM anon, authenticated;
-- REVOKE ALL ON public.shared_report_decisions FROM anon, authenticated;

-- Note: Tables are preserved for future implementation
-- To re-enable sharing, restore permissions and update application code

SELECT 'Sharing feature has been disabled. Tables preserved for future use.' as status;
