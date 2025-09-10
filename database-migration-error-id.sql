-- Migration script to update error_id column from INTEGER to TEXT
-- This is needed to support UUID error IDs in the sharing feature

-- First, backup the existing data (optional but recommended)
-- CREATE TABLE shared_report_decisions_backup AS SELECT * FROM public.shared_report_decisions;

-- Drop the existing constraint and column, then recreate with TEXT type
ALTER TABLE public.shared_report_decisions DROP CONSTRAINT IF EXISTS shared_report_decisions_shared_report_id_error_id_key;

-- Add new column as TEXT
ALTER TABLE public.shared_report_decisions ADD COLUMN IF NOT EXISTS error_id_text TEXT;

-- Copy data from old column to new column (convert integer to text)
UPDATE public.shared_report_decisions SET error_id_text = error_id::text WHERE error_id_text IS NULL;

-- Drop old column
ALTER TABLE public.shared_report_decisions DROP COLUMN IF EXISTS error_id;

-- Rename new column to original name
ALTER TABLE public.shared_report_decisions RENAME COLUMN error_id_text TO error_id;

-- Make the column NOT NULL
ALTER TABLE public.shared_report_decisions ALTER COLUMN error_id SET NOT NULL;

-- Recreate the unique constraint
ALTER TABLE public.shared_report_decisions ADD CONSTRAINT shared_report_decisions_shared_report_id_error_id_key UNIQUE (shared_report_id, error_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_shared_report_decisions_error_id ON public.shared_report_decisions(error_id);

SELECT 'Migration completed: error_id column updated to TEXT type' as status;
