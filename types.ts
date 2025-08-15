
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
}