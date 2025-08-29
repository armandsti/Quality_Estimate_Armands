
export enum Severity {
  Critical = 'Critical',
  Major = 'Major',
  Minor = 'Minor',
}

export enum ErrorCategory {
  Accuracy = 'Accuracy',
  Linguistic = 'Linguistic',
  Terminology = 'Terminology',
  Style = 'Style & Register',
  Formatting = 'Formatting',
  Locale = 'Locale & Convention',
  Other = 'Other',
}

export interface QAError {
  id: number;
  segmentId?: string;
  sourceSegment: string;
  targetSegment: string;
  sourceHighlight?: string;
  targetHighlight?: string;
  errorCategory: ErrorCategory;
  errorType: string;
  description: string;
  suggestedCorrection: string;
  suggestionHighlight?: string;
  severity: Severity;
  resolved?: boolean;
  rejected?: boolean;
}

export interface HistoryEntry {
  id: string;
  date: string;
  sourceFileName: string;
  targetFileName?: string;
  errorCount: number;
  errors: QAError[];
  severityCounts: {
    [Severity.Critical]: number;
    [Severity.Major]: number;
    [Severity.Minor]: number;
  };
  confirmedCount?: number;
  rejectedCount?: number;
  creator?: {
    id: string;
    email: string;
    name?: string;
  };
  viewers?: Array<{
    id: string;
    email: string;
    name?: string;
    viewedAt: string;
  }>;
  decisions?: Record<string, {
    accepted: boolean;
    rejected: boolean;
    decidedBy: string;
    decidedAt: string;
    comment?: string;
  }>;
}

// New types for authentication and database
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseHistoryEntry {
  id: string;
  user_id: string;
  source_file_name: string;
  target_file_name?: string;
  source_file_content?: string;
  target_file_content?: string;
  error_count: number;
  severity_counts: {
    [Severity.Critical]: number;
    [Severity.Major]: number;
    [Severity.Minor]: number;
  };
  confirmed_count: number;
  rejected_count: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseAnalysisError {
  id: string;
  history_entry_id: string;
  segment_id?: string;
  source_segment: string;
  target_segment: string;
  source_highlight?: string;
  target_highlight?: string;
  error_category: ErrorCategory;
  error_type: string;
  description: string;
  suggested_correction: string;
  suggestion_highlight?: string;
  severity: Severity;
  resolved: boolean;
  rejected: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}