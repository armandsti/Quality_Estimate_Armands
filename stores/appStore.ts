import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { QAError, HistoryEntry, Severity, WorkflowStatus, UserProfile } from '../types';
import { apiService } from '../services/apiService';

// State interfaces
interface AnalysisState {
  errors: QAError[];
  isLoading: boolean;
  apiError: string | null;
  sourceFile: File | null;
  targetFile: File | null;
  glossaryFile: File | null;
  referenceFile: File | null;
  sourceText: string;
  targetText: string;
  glossaryText: string;
  referenceText: string;
  websiteText: string;
  sourceWordCount: number;
  totalAnalyzedWords: number;
  severityFilter: Severity[];
  categoryFilter: string;
  activeHistoryEntryId: string | null;
}

interface HistoryState {
  entries: HistoryEntry[];
  historyLoading: boolean;
  error: string | null;
}

interface UserState {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  userLoading: boolean;
}

interface ViewState {
  currentView: 'upload' | 'results' | 'history' | 'progress';
  isRedirecting: boolean;
}

interface AppState extends AnalysisState, HistoryState, UserState, ViewState {
  // Actions
  // Analysis actions
  setErrors: (errors: QAError[]) => void;
  setLoading: (loading: boolean) => void;
  setApiError: (error: string | null) => void;
  setSourceFile: (file: File | null) => void;
  setTargetFile: (file: File | null) => void;
  setGlossaryFile: (file: File | null) => void;
  setReferenceFile: (file: File | null) => void;
  setSourceText: (text: string) => void;
  setTargetText: (text: string) => void;
  setGlossaryText: (text: string) => void;
  setReferenceText: (text: string) => void;
  setWebsiteText: (text: string) => void;
  setSourceWordCount: (count: number) => void;
  setTotalAnalyzedWords: (count: number) => void;
  setSeverityFilter: (filter: Severity[]) => void;
  setCategoryFilter: (filter: string) => void;
  setActiveHistoryEntryId: (id: string | null) => void;
  
  // History actions
  setHistoryEntries: (entries: HistoryEntry[]) => void;
  addHistoryEntry: (entry: HistoryEntry) => void;
  updateHistoryEntry: (id: string, updates: Partial<HistoryEntry>) => void;
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;
  
  // User actions
  setUserProfile: (profile: UserProfile | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setUserLoading: (loading: boolean) => void;
  
  // View actions
  setCurrentView: (view: 'upload' | 'results' | 'history' | 'progress') => void;
  setRedirecting: (redirecting: boolean) => void;
  
  // Complex actions
  analyzeDocument: () => Promise<void>;
  applyCorrection: (errorId: string) => Promise<void>;
  rejectCorrection: (errorId: string) => Promise<void>;
  revertCorrection: (errorId: string) => Promise<void>;
  editSuggestion: (errorId: string, suggestion: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  saveToHistory: () => Promise<void>;
  resetAnalysis: () => void;
}

// Initial state
const initialState = {
  // Analysis state
  errors: [],
  isLoading: false,
  apiError: null,
  sourceFile: null,
  targetFile: null,
  glossaryFile: null,
  referenceFile: null,
  sourceText: '',
  targetText: '',
  glossaryText: '',
  referenceText: '',
  websiteText: '',
  sourceWordCount: 0,
  totalAnalyzedWords: parseInt(localStorage.getItem('totalAnalyzedWords') || '0', 10),
  severityFilter: [],
  categoryFilter: 'All',
  activeHistoryEntryId: null,
  
  // History state
  entries: [],
  historyLoading: false,
  error: null,
  
  // User state
  profile: null,
  isAuthenticated: false,
  userLoading: false,
  
  // View state
  currentView: 'upload' as const,
  isRedirecting: false,
};

// Create the store
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        // Analysis actions
        setErrors: (errors) => set({ errors }),
        setLoading: (loading) => set({ isLoading: loading }),
        setApiError: (error) => set({ apiError: error }),
        setSourceFile: (file) => set({ sourceFile: file }),
        setTargetFile: (file) => set({ targetFile: file }),
        setGlossaryFile: (file) => set({ glossaryFile: file }),
        setReferenceFile: (file) => set({ referenceFile: file }),
        setSourceText: (text) => set({ sourceText: text }),
        setTargetText: (text) => set({ targetText: text }),
        setGlossaryText: (text) => set({ glossaryText: text }),
        setReferenceText: (text) => set({ referenceText: text }),
        setWebsiteText: (text) => set({ websiteText: text }),
        setSourceWordCount: (count) => set({ sourceWordCount: count }),
        setTotalAnalyzedWords: (count) => {
          set({ totalAnalyzedWords: count });
          localStorage.setItem('totalAnalyzedWords', count.toString());
        },
        setSeverityFilter: (filter) => set({ severityFilter: filter }),
        setCategoryFilter: (filter) => set({ categoryFilter: filter }),
        setActiveHistoryEntryId: (id) => set({ activeHistoryEntryId: id }),
        
          // History actions
  setHistoryEntries: (entries) => set({ entries }),
  addHistoryEntry: (entry) => set((state) => ({ 
    entries: [entry, ...state.entries] 
  })),
  updateHistoryEntry: (id, updates) => set((state) => ({
    entries: state.entries.map(entry => 
      entry.id === id ? { ...entry, ...updates } : entry
    )
  })),
  deleteHistoryEntry: (id) => set((state) => ({
    entries: state.entries.filter(entry => entry.id !== id)
  })),
  clearHistory: () => set({ entries: [] }),
  
  // User actions
  setUserProfile: (profile) => set({ profile }),
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
  setUserLoading: (loading) => set({ userLoading: loading }),
        
        // View actions
        setCurrentView: (view) => set({ currentView: view }),
        setRedirecting: (redirecting) => set({ isRedirecting: redirecting }),
        
        // Complex actions
        analyzeDocument: async () => {
          const state = get();
          set({ isLoading: true, apiError: null });
          
          try {
            const response = await apiService.analyzeDocument({
              sourceText: state.sourceText,
              targetText: state.targetText,
              glossaryText: state.glossaryText,
              referenceText: state.referenceText,
              websiteText: state.websiteText,
            });
            
            set({ 
              errors: response.errors,
              isLoading: false,
              currentView: 'results'
            });
            
            // Update word count
            const newTotal = state.totalAnalyzedWords + state.sourceWordCount;
            get().setTotalAnalyzedWords(newTotal);
            
          } catch (error) {
            set({ 
              isLoading: false, 
              apiError: error instanceof Error ? error.message : 'Analysis failed'
            });
          }
        },
        
        applyCorrection: async (errorId) => {
          const state = get();
          const updatedErrors = state.errors.map(error =>
            error.id === errorId 
              ? { ...error, resolved: true, rejected: false }
              : error
          );
          
          set({ errors: updatedErrors });
          
          try {
            await apiService.updateErrorStatus(errorId, true, false);
          } catch (error) {
            console.error('Failed to update error status:', error);
          }
        },
        
        rejectCorrection: async (errorId) => {
          const state = get();
          const updatedErrors = state.errors.map(error =>
            error.id === errorId 
              ? { ...error, rejected: true, resolved: false }
              : error
          );
          
          set({ errors: updatedErrors });
          
          try {
            await apiService.updateErrorStatus(errorId, false, true);
          } catch (error) {
            console.error('Failed to update error status:', error);
          }
        },
        
        revertCorrection: async (errorId) => {
          const state = get();
          const updatedErrors = state.errors.map(error =>
            error.id === errorId 
              ? { ...error, resolved: false, rejected: false }
              : error
          );
          
          set({ errors: updatedErrors });
          
          try {
            await apiService.updateErrorStatus(errorId, false, false);
          } catch (error) {
            console.error('Failed to update error status:', error);
          }
        },
        
        editSuggestion: async (errorId, suggestion) => {
          const state = get();
          const updatedErrors = state.errors.map(error =>
            error.id === errorId 
              ? { ...error, suggestedCorrection: suggestion }
              : error
          );
          
          set({ errors: updatedErrors });
        },
        
          loadHistory: async () => {
    set({ historyLoading: true, error: null });
    
    try {
      const response = await apiService.getHistory();
      set({ entries: response.entries, historyLoading: false });
    } catch (error) {
      set({ 
        historyLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load history'
      });
    }
  },
        
        saveToHistory: async () => {
          const state = get();
          if (!state.sourceFile || state.errors.length === 0) return;
          
          try {
            const entry: Omit<HistoryEntry, 'id'> = {
              date: new Date().toISOString(),
              sourceFileName: state.sourceFile.name,
              targetFileName: state.targetFile?.name,
              errorCount: state.errors.length,
              errors: state.errors,
              severityCounts: {
                Critical: state.errors.filter(e => e.severity === Severity.Critical).length,
                Major: state.errors.filter(e => e.severity === Severity.Major).length,
                Minor: state.errors.filter(e => e.severity === Severity.Minor).length,
              },
              confirmedCount: state.errors.filter(e => e.resolved).length,
              rejectedCount: state.errors.filter(e => e.rejected).length,
              workflowStatus: WorkflowStatus.Draft,
            };
            
            const response = await apiService.saveHistory(entry);
            const newEntry = { ...entry, id: response.id };
            get().addHistoryEntry(newEntry);
            get().setActiveHistoryEntryId(response.id);
            
          } catch (error) {
            console.error('Failed to save to history:', error);
          }
        },
        
        resetAnalysis: () => {
          set({
            errors: [],
            apiError: null,
            sourceFile: null,
            targetFile: null,
            glossaryFile: null,
            referenceFile: null,
            sourceText: '',
            targetText: '',
            glossaryText: '',
            referenceText: '',
            websiteText: '',
            sourceWordCount: 0,
            severityFilter: [],
            categoryFilter: 'All',
            activeHistoryEntryId: null,
            currentView: 'upload',
          });
        },
      }),
      {
        name: 'qa-riks-store',
        partialize: (state) => ({
          // Only persist certain parts of the state
          totalAnalyzedWords: state.totalAnalyzedWords,
          severityFilter: state.severityFilter,
          categoryFilter: state.categoryFilter,
        }),
      }
    ),
    {
      name: 'qa-riks-store',
    }
  )
);
