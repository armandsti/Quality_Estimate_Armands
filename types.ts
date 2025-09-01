
export enum Severity {
  Critical = 'Critical',
  Major = 'Major',
  Minor = 'Minor',
}

export enum WorkflowStatus {
  Draft = 'draft',
  Shared = 'shared',
  InReview = 'in_review',
  Completed = 'completed',
}

export enum UserRole {
  Creator = 'creator',
  Reviewer = 'reviewer',
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
  id: string;
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
  workflowStatus?: WorkflowStatus;
  creator?: {
    id: string;
    email: string;
    name?: string;
  };
  sharedWith?: Array<{
    id: string;
    email: string;
    name?: string;
    role: UserRole;
    invitedAt: string;
    lastViewedAt?: string;
    completedAt?: string;
  }>;
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
  sharedReportId?: string; // Links to the shared report for this history entry
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
  workflow_status?: WorkflowStatus;
  shared_report_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSharedReport {
  id: string;
  history_entry_id: string;
  creator_id: string;
  workflow_status: WorkflowStatus;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSharedReportReviewer {
  id: string;
  shared_report_id: string;
  reviewer_id: string;
  reviewer_email: string;
  reviewer_name?: string;
  role: UserRole;
  invited_at: string;
  last_viewed_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSharedReportDecision {
  id: string;
  shared_report_id: string;
  error_id: number;
  accepted: boolean;
  rejected: boolean;
  decided_by: string;
  decided_at: string;
  comment?: string;
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

export interface SharedReportData {
  id: string;
  historyEntryId: string; // Link back to the original history entry
  timestamp: string;
  errors: QAError[];
  sourceFileName: string;
  targetFileName: string;
  metadata: any;
  summary: {
    totalIssues: number;
    criticalCount: number;
    majorCount: number;
    minorCount: number;
  };
  workflowStatus: WorkflowStatus;
  creator: {
    id: string;
    email: string;
    name?: string;
  };
  reviewers: Array<{
    id: string;
    email: string;
    name?: string;
    role: UserRole;
    invitedAt: string;
    lastViewedAt?: string;
    completedAt?: string;
  }>;
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