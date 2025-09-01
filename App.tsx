
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Header } from './components/Header';
import { UploadPage } from './components/UploadPage';
import { ResultsPage } from './components/ResultsPage';
import { HistoryPage } from './components/HistoryPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthForm } from './components/Auth/AuthForm';
import { AuthCallback } from './components/Auth/AuthCallback';
import { SharedReportView } from './components/SharedReportView';
import { parseFile, parseBilingualFile } from './services/fileParserService';
import { runQAAnalysis } from './services/aiService';
import { exportToExcel, exportToDocx, exportToCorrectedBilingualFile, syncCreatorDecisionsToSharedReport, syncSharedDecisionsToCreator } from './services/reportService';
import { QAError, Severity, HistoryEntry, WorkflowStatus } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { HistoryService } from './services/historyService';
import { updateGlobalStatistics } from './components/StatisticsPanel';

const countWords = (text: string): number => {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
};

function AppContent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // All state hooks must come first, before any conditional logic
  const [view, setView] = useState<'upload' | 'results' | 'history'>('upload');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [glossaryFile, setGlossaryFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [glossaryText, setGlossaryText] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [websiteText, setWebsiteText] = useState('');
  const [sourceWordCount, setSourceWordCount] = useState(0);
  const [totalAnalyzedWords, setTotalAnalyzedWords] = useState(() => {
    return parseInt(localStorage.getItem('totalAnalyzedWords') || '0', 10);
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [errors, setErrors] = useState<QAError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [activeHistoryEntryId, setActiveHistoryEntryId] = useState<string | null>(null);

  // Smart redirect logic that preserves current page on refresh
  useEffect(() => {
    if (!loading) {
      const currentPath = window.location.pathname;
      
      if (!user) {
        // User is not authenticated
        if (currentPath !== '/auth' && currentPath !== '/auth/callback') {
          // Save the current path to redirect back after login
          sessionStorage.setItem('redirectAfterLogin', currentPath);
          navigate('/auth', { replace: true });
        }
      } else {
        // User is authenticated
        if (currentPath === '/auth') {
          // If on auth page and authenticated, redirect to saved path or home
          const redirectPath = sessionStorage.getItem('redirectAfterLogin') || '/';
          sessionStorage.removeItem('redirectAfterLogin');
          setIsRedirecting(true);
          navigate(redirectPath, { replace: true });
        }
        // Don't redirect if user is authenticated and on any other page
        // This includes /, /upload, /results, /history, and /shared-report/*
      }
    }
  }, [user, loading, navigate]);

  // Preserve current view state based on URL path
  useEffect(() => {
    if (!loading && user) {
      const currentPath = window.location.pathname;
      
      console.log('Initial view setup:', currentPath, 'Current view:', view, 'IsLoading:', isLoading, 'Errors:', errors.length);
      
      // Set the appropriate view based on the URL path, but don't override if we have analysis results
      if (currentPath === '/history') {
        setView('history');
      } else if (currentPath === '/results') {
        setView('results');
      } else if (currentPath === '/upload') {
        setView('upload');
      } else if (currentPath === '/' && errors.length === 0 && view === 'upload') {
        // Only set to upload if no analysis results AND we're already on upload
        console.log('Keeping view on upload (default)');
      }
      // Don't change view for shared-report paths as they're handled separately
    }
  }, [user, loading, errors.length]);

  // Additional effect to handle URL changes without causing redirects
  useEffect(() => {
    if (!loading && user) {
      const currentPath = window.location.pathname;
      
      console.log('URL change detected:', currentPath, 'Current view:', view);
      
      // Only update view if we're not already on the correct view AND not in the middle of analysis
      if (currentPath === '/history' && view !== 'history') {
        console.log('Setting view to history');
        setView('history');
      } else if (currentPath === '/results' && view !== 'results') {
        console.log('Setting view to results');
        setView('results');
      } else if (currentPath === '/upload' && view !== 'upload') {
        console.log('Setting view to upload');
        setView('upload');
      } else if (currentPath === '/' && view !== 'upload' && !isLoading && errors.length === 0) {
        // Only set to upload if not loading and no active analysis results
        console.log('Setting view to upload (default)');
        setView('upload');
      } else if (currentPath === '/' && view === 'history') {
        // If we're on home page but view is history, keep it that way
        console.log('Keeping history view on home page');
      } else if (currentPath === '/results' && view !== 'results') {
        // If we're on results page but view is not results, set it
        console.log('Setting view to results from URL');
        setView('results');
      }
    }
  }, [window.location.pathname, user, loading, view, isLoading, errors.length]);

  // Define loadHistoryFromDatabase function BEFORE using it
  const loadHistoryFromDatabase = async () => {
    if (!user) return;
    
    try {
      const dbHistory = await HistoryService.getAnalysisHistory(user.id);
      console.log('Loaded history from database:', dbHistory.length, 'entries');
      
      // Also try to load from localStorage to merge any missing data
      try {
        const savedHistory = localStorage.getItem('translationHistory');
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory);
          if (Array.isArray(parsed)) {
            console.log('Loaded history from localStorage:', parsed.length, 'entries');
            
            // Merge database and localStorage data, preferring localStorage for latest updates
            const mergedHistory = parsed.map(localEntry => {
              const dbEntry = dbHistory.find(db => db.id === localEntry.id);
              if (dbEntry) {
                // Merge, preferring localStorage data for workflow status and decisions
                return {
                  ...dbEntry,
                  workflowStatus: localEntry.workflowStatus || dbEntry.workflowStatus,
                  sharedReportId: localEntry.sharedReportId || dbEntry.sharedReportId,
                  confirmedCount: localEntry.confirmedCount || dbEntry.confirmedCount,
                  rejectedCount: localEntry.rejectedCount || dbEntry.rejectedCount,
                  decisions: localEntry.decisions || dbEntry.decisions,
                  sharedWith: localEntry.sharedWith || dbEntry.sharedWith
                };
              }
              return localEntry;
            });
            
            // Add any database entries that aren't in localStorage
            dbHistory.forEach(dbEntry => {
              if (!mergedHistory.find(local => local.id === dbEntry.id)) {
                mergedHistory.push(dbEntry);
              }
            });
            
            setHistory(mergedHistory);
            console.log('Merged history:', mergedHistory.length, 'entries');
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load from localStorage:', e);
      }
      
      // If no localStorage data or merge failed, use database data
      setHistory(dbHistory);
    } catch (error) {
      console.error('Failed to load history from database:', error);
      // Fallback to localStorage if database fails
      try {
        const savedHistory = localStorage.getItem('translationHistory');
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory);
          if (Array.isArray(parsed)) {
            setHistory(parsed);
            console.log('Fallback to localStorage:', parsed.length, 'entries');
          }
        }
      } catch (e) {
        console.error('Failed to load from localStorage:', e);
      }
    }
  };

  // Load history from database when user is authenticated
  useEffect(() => {
    if (user) {
      // Clear corrupted localStorage data and start fresh
      try {
        const savedHistory = localStorage.getItem('translationHistory');
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory);
          if (Array.isArray(parsed)) {
            // Check if any entries have invalid UUIDs
            const hasInvalidUUIDs = parsed.some(entry => {
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              return !uuidRegex.test(entry.id);
            });
            
            if (hasInvalidUUIDs) {
              console.log('Found invalid UUIDs in localStorage, clearing corrupted data');
              localStorage.removeItem('translationHistory');
              localStorage.removeItem('sharedReports');
            }
          }
        }
      } catch (error) {
        console.error('Error checking localStorage:', error);
        // Clear localStorage if there's an error
        localStorage.removeItem('translationHistory');
        localStorage.removeItem('sharedReports');
      }
      
      loadHistoryFromDatabase();
    }
  }, [user]);

  // Persist total analyzed words to localStorage
  useEffect(() => {
    localStorage.setItem('totalAnalyzedWords', totalAnalyzedWords.toString());
  }, [totalAnalyzedWords]);

  // Sync review progress with history state
  useEffect(() => {
    if (activeHistoryEntryId && user) {
        setHistory(prevHistory =>
            prevHistory.map(entry => {
                if (entry.id === activeHistoryEntryId) {
                    const confirmedCount = errors.filter(e => e.resolved).length;
                    const rejectedCount = errors.filter(e => e.rejected).length;
                    return { ...entry, errors, confirmedCount, rejectedCount };
                }
                return entry;
            })
        );
    }
  }, [errors, activeHistoryEntryId, user]);

  // Save history to localStorage and database whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      try {
        localStorage.setItem('translationHistory', JSON.stringify(history));
        console.log('History saved to localStorage:', history.length, 'entries');
        
        // Also save to database if user is authenticated
        if (user) {
          // Filter out entries with invalid UUIDs and only save valid ones
          const validEntries = history.filter(entry => {
            // Check if the ID is a valid UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const isValidUUID = uuidRegex.test(entry.id);
            
            if (!isValidUUID) {
              console.log('Skipping invalid UUID entry:', entry.id);
            }
            
            return isValidUUID;
          });
          
          console.log('Valid entries to save to database:', validEntries.length);
          
          // Save each valid history entry to database
          validEntries.forEach(async (entry) => {
            try {
              // Update the history entry in the database
              await HistoryService.updateHistoryEntry(entry);
              console.log('History entry saved to database:', entry.id);
            } catch (error) {
              console.error('Failed to save history entry to database:', entry.id, error);
            }
          });
        }
      } catch (error) {
        console.error('Failed to save history:', error);
      }
    }
  }, [history, user]);

  // Function to sync shared report status to history
  const syncSharedReportStatus = useCallback(async (historyEntryId: string) => {
    try {
      const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
      const sharedReportId = Object.keys(storedReports).find(key =>
        storedReports[key].historyEntryId === historyEntryId
      );

      if (sharedReportId) {
        const sharedReport = storedReports[sharedReportId];
        console.log('Syncing shared report status for history entry:', historyEntryId, sharedReport);
        
        setHistory(prevHistory => {
          const updatedHistory = prevHistory.map(entry => {
            if (entry.id === historyEntryId) {
              return {
                ...entry,
                workflowStatus: sharedReport.workflowStatus,
                sharedWith: sharedReport.reviewers,
                decisions: sharedReport.decisions,
                sharedReportId: sharedReportId // Add reference to shared report
              };
            }
            return entry;
          });
          
          console.log('Updated history:', updatedHistory);
          return updatedHistory;
        });

        // Also update the database if user is authenticated
        if (user) {
          try {
            await HistoryService.updateWorkflowStatus(historyEntryId, sharedReport.workflowStatus);
            await HistoryService.updateSharedReportId(historyEntryId, sharedReportId);
          } catch (error) {
            console.error('Failed to update workflow status in database:', error);
          }
        }
      } else {
        console.log('No shared report found for history entry:', historyEntryId);
      }
    } catch (error) {
      console.error('Failed to sync shared report status:', error);
    }
  }, [user]);

  // Function to sync shared decisions to current errors when viewing a report
  const syncSharedDecisionsToCurrentErrors = useCallback(async (historyEntryId: string) => {
    try {
      const sharedDecisions = await syncSharedDecisionsToCreator(historyEntryId);
      
      if (Object.keys(sharedDecisions).length > 0) {
        setErrors(prevErrors =>
          prevErrors.map(error => {
            const decision = sharedDecisions[error.id.toString()];
            if (decision) {
              return {
                ...error,
                resolved: decision.accepted || false,
                rejected: decision.rejected || false
              };
            }
            return error;
          })
        );
        console.log('Synced shared decisions to current errors:', sharedDecisions);
      }
    } catch (error) {
      console.error('Failed to sync shared decisions to current errors:', error);
    }
  }, []);

  // Function to handle share success and update history
  const handleShareSuccess = useCallback((historyEntryId: string) => {
    console.log('Share successful for history entry:', historyEntryId);
    // The history will be automatically updated through the useEffect that saves to localStorage
    // and the syncSharedReportStatus function will be called to update the workflow status
  }, []);

  // Note: Do NOT return early here; keep hook order consistent.

  const handleFileChange = (
    setter: React.Dispatch<React.SetStateAction<File | null>>, 
    textSetter: React.Dispatch<React.SetStateAction<string>>,
    role: 'source' | 'target' | 'glossary' | 'reference'
  ) => async (file: File | null) => {
    setter(file);
    if (file) {
      try {
        setApiError(null);
        const bilingualExtensions = ['.xliff', '.xlf', '.tmx', '.sdlxliff'];
        const isBilingual = bilingualExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (role === 'source' && isBilingual) {
          const { source, target } = await parseBilingualFile(file);
          setSourceText(source);
          setTargetText(target);
          setSourceWordCount(countWords(source));
          // Don't clear targetFile immediately to avoid race conditions
          // It will be handled when the analysis starts
        } else {
          const text = await parseFile(file);
          textSetter(text);
          if (role === 'source') {
              setSourceWordCount(countWords(text));
          }
        }
      } catch (error) {
        console.error("Error parsing file:", error);
        const message = error instanceof Error ? error.message : `An unknown error occurred while parsing ${file.name}.`;
        setApiError(message);
        textSetter(''); // Clear text on error
        if (role === 'source') { // Also clear target if source fails
            setTargetText('');
            setSourceWordCount(0);
        }
      }
    } else {
      textSetter('');
      if (role === 'source') {
        setSourceWordCount(0);
      }
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!sourceText || !targetText) {
      setApiError('Source and Target documents are required.');
      return;
    }
    
    // Validate text content length
    if (sourceText.trim().length < 10) {
      setApiError('Source text is too short. Please provide a document with more content.');
      return;
    }
    
    if (targetText.trim().length < 10) {
      setApiError('Target text is too short. Please provide a document with more content.');
      return;
    }
    
    setTotalAnalyzedWords(prev => prev + sourceWordCount);

    setIsLoading(true);
    setApiError(null);
    setErrors([]);
    setView('results'); // Switch to results view to show loader
    
    // Add timeout for very long operations
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setApiError('Analysis is taking longer than expected. Please wait or try with a smaller document.');
      }
    }, 30000); // 30 seconds

    try {
      const result = await runQAAnalysis(sourceText, targetText, glossaryText, referenceText, websiteText);
      setErrors(result);

      // Update global statistics for new report
      updateGlobalStatistics('new_report');

      if (sourceFile && user) {
        try {
          // Save to database
          const historyId = await HistoryService.saveAnalysisHistory(
            user.id,
            sourceFile.name,
            targetFile?.name,
            sourceText,
            targetText,
            result
          );

          // Create local entry for immediate UI update
          const newEntry: HistoryEntry = {
            id: historyId,
            date: new Date().toISOString(),
            sourceFileName: sourceFile.name,
            targetFileName: targetFile?.name,
            errorCount: result.length,
            errors: result,
            severityCounts: {
              [Severity.Critical]: result.filter(e => e.severity === Severity.Critical).length,
              [Severity.Major]: result.filter(e => e.severity === Severity.Major).length,
              [Severity.Minor]: result.filter(e => e.severity === Severity.Minor).length,
            },
            confirmedCount: 0,
            rejectedCount: 0,
          };
          setHistory(prev => [newEntry, ...prev]);
          setActiveHistoryEntryId(newEntry.id);

          // Update workflow status in database
          try {
            await HistoryService.updateWorkflowStatus(newEntry.id, 'draft' as WorkflowStatus);
          } catch (error) {
            console.error('Failed to update workflow status:', error);
          }
        } catch (error) {
          console.error('Failed to save to database:', error);
          // Fallback to local storage
          const newEntry: HistoryEntry = {
            id: crypto.randomUUID(), // Use proper UUID instead of timestamp
            date: new Date().toISOString(),
            sourceFileName: sourceFile.name,
            targetFileName: targetFile?.name,
            errorCount: result.length,
            errors: result,
            severityCounts: {
              [Severity.Critical]: result.filter(e => e.severity === Severity.Critical).length,
              [Severity.Major]: result.filter(e => e.severity === Severity.Major).length,
              [Severity.Minor]: result.filter(e => e.severity === Severity.Minor).length,
            },
            confirmedCount: 0,
            rejectedCount: 0,
          };
          setHistory(prev => [newEntry, ...prev]);
          setActiveHistoryEntryId(newEntry.id);
        }
      }

    } catch (error) {
      console.error('Gemini API Error:', error);
      const message = error instanceof Error ? error.message : 'An error occurred during AI analysis. Please check the console for details.';
      setApiError(message);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
      // Ensure we stay on results view after analysis completes
      console.log('Analysis completed, setting view to results');
      setView('results');
      
      // Force the view to stay on results for a moment to prevent override
      setTimeout(() => {
        if (errors.length > 0) {
          console.log('Forcing view to stay on results due to analysis results');
          setView('results');
        }
      }, 100);
    }
  }, [sourceText, targetText, glossaryText, referenceText, websiteText, sourceWordCount, sourceFile, targetFile, user]);

  const handleStartNewAnalysis = useCallback(() => {
    console.log('New Analysis button clicked, setting view to upload');
    setView('upload');
    // Update URL to reflect the upload view
    window.history.pushState({}, '', '/upload');
    setActiveHistoryEntryId(null);
    // Reset all state for a fresh start, but keep history and total word count
    setSourceFile(null);
    setTargetFile(null);
    setGlossaryFile(null);
    setReferenceFile(null);
    setSourceText('');
    setTargetText('');
    setGlossaryText('');
    setReferenceText('');
    setWebsiteText('');
    setSourceWordCount(0);
    setErrors([]);
    setApiError(null);
    setSeverityFilter([]);
    setCategoryFilter('All');
  }, []);

   const handleResetTotalWords = useCallback(() => {
    if (window.confirm("Are you sure you want to reset the total analyzed word count?")) {
      setTotalAnalyzedWords(0);
    }
  }, []);
  
  const handleShowHistory = useCallback(() => {
    console.log('History button clicked, setting view to history');
    setView('history');
    // Update URL to reflect the history view
    window.history.pushState({}, '', '/history');
  }, []);
  
  const handleReturnToResults = useCallback(() => {
    console.log('Return to Results button clicked, setting view to results');
    console.log('Current errors length:', errors.length);
    console.log('Current view:', view);
    setView('results');
    // Update URL to reflect the results view
    window.history.pushState({}, '', '/results');
    console.log('View set to results, URL updated to /results');
  }, [errors.length, view]);

  const handleClearHistory = useCallback(async () => {
    console.log('Clear All History button clicked');
    if (window.confirm("Are you sure you want to permanently delete all analysis history? This action cannot be undone.")) {
      console.log('User confirmed deletion, clearing history...');
      // Delete all history from database if user is authenticated
      if (user) {
        try {
          console.log('Deleting from database for user:', user.id);
          for (const entry of history) {
            await HistoryService.deleteAnalysisHistory(entry.id);
          }
          console.log('Successfully deleted all entries from database');
        } catch (error) {
          console.error('Failed to clear history from database:', error);
        }
      }
      
      // Clear from localStorage as well
      try {
        localStorage.removeItem('translationHistory');
        console.log('Cleared history from localStorage');
      } catch (error) {
        console.error('Failed to clear localStorage:', error);
      }
      
      // Clear state
      setHistory([]);
      setActiveHistoryEntryId(null);
      setErrors([]);
      console.log('Cleared history state, history length now:', 0);
    } else {
      console.log('User cancelled deletion');
    }
  }, [user, history]);

  const handleDeleteHistoryEntry = useCallback(async (entryId: string) => {
    if (window.confirm("Are you sure you want to delete this analysis report? This action cannot be undone.")) {
      // Delete from database if user is authenticated
      if (user) {
        try {
          await HistoryService.deleteAnalysisHistory(entryId);
        } catch (error) {
          console.error('Failed to delete from database:', error);
        }
      }
      
      setHistory(prev => prev.filter(entry => entry.id !== entryId));
      
      // If we're deleting the currently active entry, clear it
      if (activeHistoryEntryId === entryId) {
        setActiveHistoryEntryId(null);
        setErrors([]);
      }
    }
  }, [activeHistoryEntryId, user]);
  
  const handleViewHistoryReport = useCallback(async (entry: HistoryEntry) => {
    console.log('View Report button clicked for entry:', entry.id);
    setApiError(null);
    setIsLoading(false);
    setErrors(entry.errors);
    setActiveHistoryEntryId(entry.id); // Set as the active report to allow edits to be saved.
    // Mock files for display purposes on the results page
    setSourceFile(new File([], entry.sourceFileName, {type: "text/plain"}));
    if (entry.targetFileName) {
        setTargetFile(new File([], entry.targetFileName, {type: "text/plain"}));
    } else {
        setTargetFile(null);
    }
    setGlossaryFile(null);
    setSeverityFilter([]);
    setCategoryFilter('All');
    setView('results');
    // Update URL to reflect the results view
    window.history.pushState({}, '', '/results');

    // Sync shared decisions to current errors
    await syncSharedDecisionsToCurrentErrors(entry.id);
  }, [syncSharedDecisionsToCurrentErrors]);

  const handleApplyCorrection = useCallback(async (errorId: string) => {
    setErrors(prevErrors =>
        prevErrors.map(e =>
            e.id === errorId ? { ...e, resolved: true, rejected: false } : e
        )
    );

    // Update global statistics
    updateGlobalStatistics('accept');

    // Update database if user is authenticated
    if (user) {
      try {
        await HistoryService.updateErrorStatus(errorId.toString(), true, false);
        
        // Sync to shared report if this is a shared report
        if (activeHistoryEntryId) {
          await syncCreatorDecisionsToSharedReport(activeHistoryEntryId, errorId, true, false);
        }
      } catch (error) {
        console.error('Failed to update database:', error);
      }
    }
  }, [user, activeHistoryEntryId]);

  const handleRejectCorrection = useCallback(async (errorId: string) => {
    setErrors(prevErrors =>
      prevErrors.map(e =>
        e.id === errorId ? { ...e, rejected: true, resolved: false } : e
      )
    );

    // Update global statistics
    updateGlobalStatistics('reject');

    // Update database if user is authenticated
    if (user) {
      try {
        await HistoryService.updateErrorStatus(errorId.toString(), false, true);
        
        // Sync to shared report if this is a shared report
        if (activeHistoryEntryId) {
          await syncCreatorDecisionsToSharedReport(activeHistoryEntryId, errorId, false, true);
        }
      } catch (error) {
        console.error('Failed to update database:', error);
      }
    }
  }, [user, activeHistoryEntryId]);

  const handleSuggestionEdit = useCallback(async (errorId: string, newSuggestion: string) => {
    setErrors(prevErrors =>
        prevErrors.map(e =>
            e.id === errorId ? { ...e, suggestedCorrection: newSuggestion, suggestionHighlight: '' } : e
        )
    );

    // Update global statistics
    updateGlobalStatistics('edit_clicked');

    // Sync suggestion edit to ALL shared reports if this is a shared report
    if (activeHistoryEntryId) {
      try {
        const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
        const allRelatedReportIds = Object.keys(storedReports).filter(key => 
          storedReports[key].historyEntryId === activeHistoryEntryId
        );
        
        console.log(`Found ${allRelatedReportIds.length} related reports for creator suggestion edit: ${activeHistoryEntryId}`);
        
        // Update ALL reports in the chain with the creator's suggestion edit
        allRelatedReportIds.forEach(reportId => {
          const report = storedReports[reportId];
          const updatedErrors = report.errors.map((error: any) => 
            error.id === errorId 
              ? { ...error, suggestedCorrection: newSuggestion }
              : error
          );
          
          report.errors = updatedErrors;
          storedReports[reportId] = report;
          console.log(`Synced suggestion edit to report ${reportId}: error ${errorId}`);
        });
        
        localStorage.setItem('sharedReports', JSON.stringify(storedReports));
        console.log(`Successfully synced suggestion edit to all ${allRelatedReportIds.length} related reports`);
      } catch (error) {
        console.error('Failed to sync suggestion edit to shared reports:', error);
      }
    }
  }, [activeHistoryEntryId]);
  
  const handleRevertCorrection = useCallback(async (errorId: string) => {
    setErrors(prevErrors =>
        prevErrors.map(e =>
            e.id === errorId ? { ...e, resolved: false, rejected: false } : e
        )
    );

    // Update database if user is authenticated
    if (user) {
      try {
        await HistoryService.updateErrorStatus(errorId.toString(), false, false);
        
        // Sync to shared report if this is a shared report
        if (activeHistoryEntryId) {
          await syncCreatorDecisionsToSharedReport(activeHistoryEntryId, errorId, false, false);
        }
      } catch (error) {
        console.error('Failed to update database:', error);
      }
    }
  }, [user, activeHistoryEntryId]);

  const handleDownloadCorrectedFile = useCallback(() => {
    const resolvedErrors = errors.filter(e => e.resolved);
    if (resolvedErrors.length === 0) {
        alert("No corrections have been applied. Please apply suggestions before downloading.");
        return;
    }

    const bilingualXmlExtensions = ['.xliff', '.xlf', '.sdlxliff', '.tmx'];
    const isBilingualXml = sourceFile && bilingualXmlExtensions.some(ext => sourceFile.name.toLowerCase().endsWith(ext));
    
    if (isBilingualXml && sourceFile) {
      exportToCorrectedBilingualFile(sourceFile, resolvedErrors, sourceFile.name);
    } else if (targetFile?.name.toLowerCase().endsWith('.docx')) {
      exportToDocx(targetFile, resolvedErrors, targetFile.name);
    } else {
        alert("Corrected file download is only supported for .docx, .xliff, and .tmx files.");
    }
  }, [errors, sourceFile, targetFile]);

  const handleToggleSeverityFilter = (severity: Severity) => {
    setSeverityFilter(prev => 
      prev.includes(severity) 
        ? prev.filter(s => s !== severity) 
        : [...prev, severity]
    );
  };
  
  const handleCategoryFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
  }

  const filteredErrors = useMemo(() => {
    let filtered = errors;
    if (severityFilter.length > 0) {
      filtered = filtered.filter(error => severityFilter.includes(error.severity));
    }
    if (categoryFilter !== 'All') {
        filtered = filtered.filter(error => error.errorCategory === categoryFilter);
    }
    return filtered;
  }, [errors, severityFilter, categoryFilter]);
  
  const uniqueCategories = useMemo(() => {
      const categories = new Set(errors.map(e => e.errorCategory));
      return ['All', ...Array.from(categories)];
  }, [errors]);

  const canAnalyze = sourceText && targetText && !isLoading;
  const hasActiveReport = errors.length > 0;

  const renderView = () => {
    // If we have analysis results, force the view to results
    if (errors.length > 0 && view === 'upload') {
      console.log('Forcing view to results due to analysis results');
      setView('results');
    }
    
    switch(view) {
        case 'upload':
            return <UploadPage
                        onFileChange={handleFileChange}
                        sourceFile={sourceFile}
                        targetFile={targetFile}
                        glossaryFile={glossaryFile}
                        referenceFile={referenceFile}
                        setSourceFile={setSourceFile}
                        setSourceText={setSourceText}
                        setTargetFile={setTargetFile}
                        setTargetText={setTargetText}
                        setGlossaryFile={setGlossaryFile}
                        setGlossaryText={setGlossaryText}
                        setReferenceFile={setReferenceFile}
                        referenceText={referenceText}
                        setReferenceText={setReferenceText}
                        websiteText={websiteText}
                        setWebsiteText={setWebsiteText}
                        onAnalyze={handleAnalyze}
                        canAnalyze={canAnalyze}
                        isLoading={isLoading}
                        apiError={apiError}
                        sourceWordCount={sourceWordCount}
                        totalAnalyzedWords={totalAnalyzedWords}
                        onResetTotalWords={handleResetTotalWords}
                    />;
        case 'results':
            return <ResultsPage
                        allErrors={errors}
                        errors={filteredErrors}
                        isLoading={isLoading}
                        apiError={apiError}
                        onBack={handleStartNewAnalysis}
                        severityFilter={severityFilter}
                        onToggleSeverityFilter={handleToggleSeverityFilter}
                        onExportReport={() => exportToExcel(filteredErrors)}
                        onApplyCorrection={handleApplyCorrection}
                        onRejectCorrection={handleRejectCorrection}
                        onSuggestionEdit={handleSuggestionEdit}
                        onRevertCorrection={handleRevertCorrection}
                        onDownloadCorrected={handleDownloadCorrectedFile}
                        sourceFile={sourceFile}
                        targetFile={targetFile}
                        categoryFilter={categoryFilter}
                        onCategoryFilterChange={handleCategoryFilterChange}
                        uniqueCategories={uniqueCategories}
                        historyEntryId={activeHistoryEntryId || undefined}
                        onShareSuccess={handleShareSuccess}
                    />;
        case 'history':
            return <HistoryPage
                        history={history}
                        onViewReport={handleViewHistoryReport}
                        onClearHistory={handleClearHistory}
                        onDeleteEntry={handleDeleteHistoryEntry}
                        onStartNew={handleStartNewAnalysis}
                        hasActiveReport={hasActiveReport}
                        onReturnToResults={handleReturnToResults}
                        onSyncSharedReportStatus={syncSharedReportStatus}
                   />;
        default:
             return <UploadPage
                        onFileChange={handleFileChange}
                        sourceFile={sourceFile}
                        targetFile={targetFile}
                        glossaryFile={glossaryFile}
                        referenceFile={referenceFile}
                        setSourceFile={setSourceFile}
                        setSourceText={setSourceText}
                        setTargetFile={setTargetFile}
                        setTargetText={setTargetText}
                        setGlossaryFile={setGlossaryFile}
                        setGlossaryText={setGlossaryText}
                        setReferenceFile={setReferenceFile}
                        referenceText={referenceText}
                        setReferenceText={setReferenceText}
                        websiteText={websiteText}
                        setWebsiteText={setWebsiteText}
                        onAnalyze={handleAnalyze}
                        canAnalyze={canAnalyze}
                        isLoading={isLoading}
                        apiError={apiError}
                        sourceWordCount={sourceWordCount}
                        totalAnalyzedWords={totalAnalyzedWords}
                        onResetTotalWords={handleResetTotalWords}
                    />;
    }
  }

  // Safe early returns AFTER all hooks are declared
  if (loading && !isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <Header 
            wordsUsed={totalAnalyzedWords}
            onAnalyzeDocument={handleStartNewAnalysis}
            onShowHistory={handleShowHistory}
            onShowInProcess={handleReturnToResults}
            isProcessing={isLoading}
        />
        <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
          {renderView()}
        </main>
      </div>
    </ErrorBoundary>
  );
}

// AuthWrapper component to handle authentication redirects
function AuthWrapper() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // Check if there's a saved redirect path
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect
  }

  return <AuthForm />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth" element={<AuthWrapper />} />
          <Route path="/shared-report/:reportId" element={<SharedReportView />} />
          <Route path="/" element={<AppContent />} />
          <Route path="/upload" element={<AppContent />} />
          <Route path="/results" element={<AppContent />} />
          <Route path="/history" element={<AppContent />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
