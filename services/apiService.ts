import { QAError, HistoryEntry, WorkflowStatus } from '../types';

// API Response types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface AnalysisRequest {
  sourceText: string;
  targetText: string;
  glossaryText?: string;
  referenceText?: string;
  websiteText?: string;
}

export interface AnalysisResponse {
  errors: QAError[];
  totalIssues: number;
  processingTime: number;
}

export interface HistoryResponse {
  entries: HistoryEntry[];
  totalCount: number;
}

export interface ShareRequest {
  errors: QAError[];
  sourceFile?: File;
  targetFile?: File;
  metadata?: any;
  creator?: any;
  historyEntryId?: string;
}

export interface ShareResponse {
  shareUrl: string;
  reportId: string;
  expiresAt?: string;
}

// Error types
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Centralized API Service
class ApiService {
  private static instance: ApiService;
  private baseUrl: string;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;

  private constructor() {
    this.baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3001' 
      : window.location.origin;
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // Generic request method with retry logic
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData.code
        );
      }

      return await response.json();
    } catch (error) {
      // Handle network errors with retry logic
      if (error instanceof TypeError && retryCount < this.retryAttempts) {
        console.warn(`API request failed, retrying... (${retryCount + 1}/${this.retryAttempts})`);
        await this.delay(this.retryDelay * Math.pow(2, retryCount));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      // Log error for debugging
      this.logError(error, endpoint, options);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private logError(error: any, endpoint: string, options: RequestInit): void {
    console.error('API Error:', {
      endpoint,
      method: options.method || 'GET',
      error: error.message,
      status: error.status,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  }

  // Analysis API methods
  async analyzeDocument(request: AnalysisRequest): Promise<AnalysisResponse> {
    return this.request<AnalysisResponse>('/api/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // History API methods
  async getHistory(): Promise<HistoryResponse> {
    return this.request<HistoryResponse>('/api/history');
  }

  async saveHistory(entry: Omit<HistoryEntry, 'id'>): Promise<{ id: string }> {
    return this.request<{ id: string }>('/api/history', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async updateHistory(id: string, updates: Partial<HistoryEntry>): Promise<void> {
    return this.request<void>(`/api/history/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteHistory(id: string): Promise<void> {
    return this.request<void>(`/api/history/${id}`, {
      method: 'DELETE',
    });
  }

  // Sharing API methods - DISABLED
  async shareReport(request: ShareRequest): Promise<ShareResponse> {
    // SHARING FEATURE DISABLED
    console.log('shareReport API called but feature is disabled');
    throw new Error('Sharing feature is temporarily disabled for maintenance');
  }

  async getSharedReport(reportId: string): Promise<QAError[]> {
    // SHARING FEATURE DISABLED
    console.log('getSharedReport API called but feature is disabled');
    throw new Error('Sharing feature is temporarily disabled for maintenance');
  }

  async updateSharedReport(reportId: string, updates: any): Promise<void> {
    // SHARING FEATURE DISABLED
    console.log('updateSharedReport API called but feature is disabled');
    throw new Error('Sharing feature is temporarily disabled for maintenance');
  }

  // Error management API methods
  async updateErrorStatus(errorId: string, resolved: boolean, rejected: boolean): Promise<void> {
    return this.request<void>(`/api/errors/${errorId}`, {
      method: 'PUT',
      body: JSON.stringify({ resolved, rejected }),
    });
  }

  // File upload API methods
  async uploadFile(file: File, type: 'source' | 'target' | 'glossary' | 'reference'): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    return this.request<{ url: string }>('/api/upload', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }

  // Export API methods
  async exportReport(format: 'csv' | 'excel' | 'docx', data: any): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/export/${format}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new ApiError(`Export failed: ${response.statusText}`, response.status);
    }

    return response.blob();
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/api/health');
  }
}

// Export singleton instance
export const apiService = ApiService.getInstance();

// Export types for use in other files
export type { ApiResponse, AnalysisRequest, AnalysisResponse, HistoryResponse, ShareRequest, ShareResponse };
