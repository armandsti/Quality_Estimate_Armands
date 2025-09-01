import { useCallback, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { HistoryEntry } from '../types';

export const useHistory = () => {
  const {
    // State
    entries,
    historyLoading: isLoading,
    error,
    activeHistoryEntryId,
    
    // Actions
    setHistoryEntries,
    addHistoryEntry,
    updateHistoryEntry,
    deleteHistoryEntry,
    clearHistory,
    setActiveHistoryEntryId,
    loadHistory,
  } = useAppStore();

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Computed values
  const hasActiveReport = activeHistoryEntryId !== null;

  // History actions
  const handleViewReport = useCallback((entry: HistoryEntry) => {
    setActiveHistoryEntryId(entry.id);
    // Note: View switching is handled by the parent component
  }, [setActiveHistoryEntryId]);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    if (window.confirm("Are you sure you want to delete this analysis report? This action cannot be undone.")) {
      try {
        await deleteHistoryEntry(entryId);
        
        // If we're deleting the currently active entry, clear it
        if (activeHistoryEntryId === entryId) {
          setActiveHistoryEntryId(null);
        }
      } catch (error) {
        console.error('Failed to delete history entry:', error);
      }
    }
  }, [deleteHistoryEntry, activeHistoryEntryId, setActiveHistoryEntryId]);

  const handleClearHistory = useCallback(async () => {
    if (window.confirm("Are you sure you want to permanently delete all analysis history? This action cannot be undone.")) {
      try {
        await clearHistory();
        setActiveHistoryEntryId(null);
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }
  }, [clearHistory, setActiveHistoryEntryId]);

  const handleReturnToResults = useCallback(() => {
    // Note: View switching is handled by the parent component
    // This just indicates the user wants to return to the current analysis
  }, []);

  return {
    // State
    entries,
    isLoading,
    error,
    activeHistoryEntryId,
    hasActiveReport,
    
    // Actions
    handleViewReport,
    handleDeleteEntry,
    handleClearHistory,
    handleReturnToResults,
    
    // Direct actions
    addHistoryEntry,
    updateHistoryEntry,
    deleteHistoryEntry,
    clearHistory,
    setActiveHistoryEntryId,
    loadHistory,
  };
};
