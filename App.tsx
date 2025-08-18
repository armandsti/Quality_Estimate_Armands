
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Header } from './components/Header';
import { UploadPage } from './components/UploadPage';
import { ResultsPage } from './components/ResultsPage';
import { HistoryPage } from './components/HistoryPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthForm } from './components/Auth/AuthForm';
import { AuthCallback } from './components/Auth/AuthCallback';
import { parseFile, parseBilingualFile } from './services/fileParserService';
import { runQAAnalysis } from './services/aiService';
import { exportToExcel, exportToDocx, exportToCorrectedBilingualFile } from './services/reportService';
import { QAError, Severity, HistoryEntry } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { HistoryService } from './services/historyService';

const countWords = (text: string): number => {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
};

function AppContent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  console.log('🔍 DEBUG: AppContent rendered - user =', user, 'loading =', loading, 'isRedirecting =', isRedirecting);
  console.log('🔍 DEBUG: Current pathname =', window.location.pathname);
  console.log('🔍 DEBUG: Authentication state - user:', user, 'loading:', loading);
  
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

  console.log('AppContent: user =', user, 'loading =', loading, 'isRedirecting =', isRedirecting);
  
  // Redirect to auth if not authenticated
  useEffect(() => {
    console.log('🔍 DEBUG: AppContent useEffect triggered, user =', user, 'loading =', loading);
    if (!loading && !user) {
      console.log('🔍 DEBUG: AppContent: Redirecting to /auth');
      navigate('/auth');
    } else if (!loading && user) {
      console.log('🔍 DEBUG: AppContent: User authenticated, should render main app');
      // If we're on the auth page and user is authenticated, redirect to main app
      if (window.location.pathname === '/auth') {
        console.log('🔍 DEBUG: AppContent: Redirecting from /auth to main app');
        setIsRedirecting(true);
        navigate('/', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  // Simple redirect for unauthenticated users (removed aggressive redirects)
  useEffect(() => {
    if (!loading && !user && window.location.pathname !== '/auth') {
      console.log('🔍 DEBUG: Simple redirect to /auth - user not authenticated');
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  // Define loadHistoryFromDatabase function BEFORE using it
  const loadHistoryFromDatabase = async () => {
    if (!user) return;
    
    try {
      const dbHistory = await HistoryService.getAnalysisHistory(user.id);
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
      loadHistoryFromDatabase();
    }
  }, [user]);

  // Show loading while checking authentication (but not during redirects)
  if (loading && !isRedirecting) {
    console.log('AppContent: Showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!user) {
    console.log('AppContent: No user, returning null');
    return null;
  }

  console.log('AppContent: User authenticated, rendering main app');

  useEffect(() => {
    localStorage.setItem('totalAnalyzedWords', totalAnalyzedWords.toString());
  }, [totalAnalyzedWords]);

  // This effect syncs the user's review progress (accepts/rejects) with the history state.
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

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show authentication form if user is not logged in
  if (!user) {
    return <AuthForm />;
  }

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
        } catch (error) {
          console.error('Failed to save to database:', error);
          // Fallback to local storage
          const newEntry: HistoryEntry = {
            id: Date.now().toString(),
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
    }
  }, [sourceText, targetText, glossaryText, referenceText, websiteText, sourceWordCount, sourceFile, targetFile, user]);

  const handleStartNewAnalysis = useCallback(() => {
    setView('upload');
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
  
  const handleShowHistory = useCallback(() => setView('history'), []);
  
  const handleReturnToResults = useCallback(() => {
    setView('results');
  }, []);

  const handleClearHistory = useCallback(async () => {
    if (window.confirm("Are you sure you want to permanently delete all analysis history? This action cannot be undone.")) {
      // Delete all history from database if user is authenticated
      if (user) {
        try {
          for (const entry of history) {
            await HistoryService.deleteAnalysisHistory(entry.id);
          }
        } catch (error) {
          console.error('Failed to clear history from database:', error);
        }
      }
      setHistory([]);
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
  
  const handleViewHistoryReport = useCallback((entry: HistoryEntry) => {
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
  }, []);

  const handleApplyCorrection = useCallback(async (errorId: number) => {
    setErrors(prevErrors =>
        prevErrors.map(e =>
            e.id === errorId ? { ...e, resolved: true, rejected: false } : e
        )
    );

    // Update database if user is authenticated
    if (user) {
      try {
        await HistoryService.updateErrorStatus(errorId.toString(), true, false);
      } catch (error) {
        console.error('Failed to update database:', error);
      }
    }
  }, [user]);

  const handleRejectCorrection = useCallback(async (errorId: number) => {
    setErrors(prevErrors =>
      prevErrors.map(e =>
        e.id === errorId ? { ...e, rejected: true, resolved: false } : e
      )
    );

    // Update database if user is authenticated
    if (user) {
      try {
        await HistoryService.updateErrorStatus(errorId.toString(), false, true);
      } catch (error) {
        console.error('Failed to update database:', error);
      }
    }
  }, [user]);

  const handleSuggestionEdit = useCallback((errorId: number, newSuggestion: string) => {
    setErrors(prevErrors =>
        prevErrors.map(e =>
            e.id === errorId ? { ...e, suggestedCorrection: newSuggestion, suggestionHighlight: '' } : e
        )
    );
  }, []);
  
  const handleRevertCorrection = useCallback(async (errorId: number) => {
    setErrors(prevErrors =>
        prevErrors.map(e =>
            e.id === errorId ? { ...e, resolved: false, rejected: false } : e
        )
    );

    // Update database if user is authenticated
    if (user) {
      try {
        await HistoryService.updateErrorStatus(errorId.toString(), false, false);
      } catch (error) {
        console.error('Failed to update database:', error);
      }
    }
  }, [user]);

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
                        onExportExcel={() => exportToExcel(filteredErrors)}
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

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        {/* VERSION INDICATOR */}
        <div className="bg-blue-100 border-b-2 border-blue-400 p-2 text-center text-xs">
          🚀 VERSION: 2024-12-19 16:00 UTC - Authentication fixes deployed - Commit: 42e2a4b
        </div>
        {/* DEBUG INDICATOR */}
        <div className="bg-yellow-100 border-b-2 border-yellow-400 p-2 text-center text-sm">
          🔍 DEBUG: User: {user ? user.email : 'None'} | Loading: {loading.toString()} | Path: {window.location.pathname}
        </div>
        {/* ENVIRONMENT CHECK */}
        <div className="bg-red-100 border-b-2 border-red-400 p-2 text-center text-xs">
          🚨 ENV CHECK: Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'} | Supabase Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}
        </div>
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

  console.log('🔍 DEBUG: AuthWrapper rendered - user:', user, 'loading:', loading);
  console.log('🔍 DEBUG: AuthWrapper pathname =', window.location.pathname);

  useEffect(() => {
    console.log('🔍 DEBUG: AuthWrapper useEffect triggered - user:', user, 'loading:', loading);
    if (!loading && user) {
      console.log('🔍 DEBUG: AuthWrapper: User authenticated, redirecting to main app');
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    console.log('🔍 DEBUG: AuthWrapper: Showing loading spinner');
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
    console.log('🔍 DEBUG: AuthWrapper: User exists, returning null (will redirect)');
    return null; // Will redirect
  }

  console.log('🔍 DEBUG: AuthWrapper: No user, rendering AuthForm');
  return <AuthForm />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth" element={<AuthWrapper />} />
          <Route path="/" element={<AppContent />} />
          <Route path="/upload" element={<AppContent />} />
          <Route path="/results" element={<AppContent />} />
          <Route path="/history" element={<AppContent />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
