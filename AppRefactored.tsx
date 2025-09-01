import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Header } from './components/Header';
import { UploadPage } from './components/UploadPage';
import { ResultsPage } from './components/ResultsPage';
import { HistoryPage } from './components/HistoryPage';
import { ProgressPage } from './components/ProgressPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthForm } from './components/Auth/AuthForm';
import { AuthCallback } from './components/Auth/AuthCallback';
import { SharedReportView } from './components/SharedReportView';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useAppStore } from './stores/appStore';
import { useAnalysis } from './hooks/useAnalysis';
import { useHistory } from './hooks/useHistory';
import { EasterEgg } from './components/EasterEgg';

// Main App Content Component
function AppContent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const {
    currentView,
    isRedirecting,
    setCurrentView,
    setRedirecting,
  } = useAppStore();

  const {
    errors,
    isLoading,
    apiError,
    sourceFile,
    targetFile,
    glossaryFile,
    referenceFile,
    sourceText,
    targetText,
    glossaryText,
    referenceText,
    websiteText,
    sourceWordCount,
    totalAnalyzedWords,
    severityFilter,
    categoryFilter,
    uniqueCategories,
    activeHistoryEntryId,
    filteredErrors,
    canAnalyze,
    handleFileChange,
    handleAnalyze,
    handleApplyCorrection,
    handleRejectCorrection,
    handleRevertCorrection,
    handleSuggestionEdit,
    toggleSeverityFilter,
    handleCategoryFilterChange,
    handleResetTotalWords,
    resetAnalysis,
    setSourceFile,
    setSourceText,
    setTargetFile,
    setTargetText,
    setGlossaryFile,
    setGlossaryText,
    setReferenceFile,
    setReferenceText,
    setWebsiteText,
  } = useAnalysis();

  const {
    entries,
    hasActiveReport,
    handleViewReport,
    handleDeleteEntry,
    handleClearHistory,
    handleReturnToResults,
  } = useHistory();

  // Authentication redirect logic
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
          setRedirecting(true);
          navigate(redirectPath, { replace: true });
        }
      }
    }
  }, [user, loading, navigate, setRedirecting]);

  // URL-based view state management
  useEffect(() => {
    if (!loading && user) {
      const currentPath = window.location.pathname;
      
      // Set view based on URL path
      if (currentPath === '/history') {
        setCurrentView('history');
      } else if (currentPath === '/results') {
        setCurrentView('results');
      } else if (currentPath === '/upload') {
        setCurrentView('upload');
      } else if (currentPath === '/' && errors.length === 0 && currentView === 'upload') {
        // Keep upload view if no analysis results
      }
    }
  }, [user, loading, errors.length, currentView, setCurrentView]);

  // Navigation handlers
  const handleStartNewAnalysis = () => {
    setCurrentView('upload');
    resetAnalysis();
    navigate('/upload');
  };

  const handleShowHistory = () => {
    setCurrentView('history');
    navigate('/history');
  };

  const handleReturnToResults = () => {
    setCurrentView('results');
    navigate('/results');
  };

  // Export functions
  const handleExportReport = () => {
    // Export functionality would be implemented here
    console.log('Export report');
  };

  const handleDownloadCorrected = () => {
    // Download corrected file functionality would be implemented here
    console.log('Download corrected file');
  };

  // Share functions
  const handleShareSuccess = (historyEntryId: string) => {
    console.log('Share successful for history entry:', historyEntryId);
  };

  const syncSharedReportStatus = (historyEntryId: string) => {
    console.log('Syncing shared report status for:', historyEntryId);
  };

  // Render view based on current state
  const renderView = () => {
    switch (currentView) {
      case 'upload':
        return (
          <UploadPage
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
          />
        );

      case 'progress':
        return (
          <ProgressPage
            sourceFileName={sourceFile?.name}
            targetFileName={targetFile?.name}
          />
        );

      case 'results':
        return (
          <ResultsPage
            allErrors={errors}
            errors={filteredErrors}
            isLoading={isLoading}
            apiError={apiError}
            onBack={handleStartNewAnalysis}
            severityFilter={severityFilter}
            onToggleSeverityFilter={toggleSeverityFilter}
            onExportReport={handleExportReport}
            onApplyCorrection={handleApplyCorrection}
            onRejectCorrection={handleRejectCorrection}
            onSuggestionEdit={handleSuggestionEdit}
            onRevertCorrection={handleRevertCorrection}
            onDownloadCorrected={handleDownloadCorrected}
            sourceFile={sourceFile}
            targetFile={targetFile}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={handleCategoryFilterChange}
            uniqueCategories={uniqueCategories}
            historyEntryId={activeHistoryEntryId || undefined}
            onShareSuccess={handleShareSuccess}
          />
        );

      case 'history':
        return (
          <HistoryPage
            history={entries}
            onViewReport={handleViewReport}
            onClearHistory={handleClearHistory}
            onDeleteEntry={handleDeleteEntry}
            onStartNew={handleStartNewAnalysis}
            hasActiveReport={hasActiveReport}
            onReturnToResults={handleReturnToResults}
            onSyncSharedReportStatus={syncSharedReportStatus}
          />
        );

      default:
        return (
          <UploadPage
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
          />
        );
    }
  };

  // Loading state
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

  // Not authenticated
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
        <EasterEgg />
      </div>
    </ErrorBoundary>
  );
}

// AuthWrapper component
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

// Main App component
export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<AuthWrapper />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/shared-report/:reportId" element={<SharedReportView />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
