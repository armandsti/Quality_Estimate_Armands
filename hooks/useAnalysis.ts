import { useCallback, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { QAError, Severity } from '../types';
import { parseFile, parseBilingualFile } from '../services/fileParserService';

export const useAnalysis = () => {
  const {
    // State
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
    activeHistoryEntryId,
    
    // Actions
    setErrors,
    setLoading,
    setApiError,
    setSourceFile,
    setTargetFile,
    setGlossaryFile,
    setReferenceFile,
    setSourceText,
    setTargetText,
    setGlossaryText,
    setReferenceText,
    setWebsiteText,
    setSourceWordCount,
    setTotalAnalyzedWords,
    setSeverityFilter,
    setCategoryFilter,
    setActiveHistoryEntryId,
    analyzeDocument,
    applyCorrection,
    rejectCorrection,
    revertCorrection,
    editSuggestion,
    saveToHistory,
    resetAnalysis,
  } = useAppStore();

  // Computed values
  const canAnalyze = useMemo(() => {
    return sourceText.trim().length > 0 && targetText.trim().length > 0 && !isLoading;
  }, [sourceText, targetText, isLoading]);

  const filteredErrors = useMemo(() => {
    return errors.filter(error => {
      const matchesSeverity = severityFilter.length === 0 || severityFilter.includes(error.severity);
      const matchesCategory = categoryFilter === 'All' || error.errorCategory === categoryFilter;
      return matchesSeverity && matchesCategory;
    });
  }, [errors, severityFilter, categoryFilter]);

  const stats = useMemo(() => {
    const totalIssues = errors.length;
    if (totalIssues === 0) {
      return { totalIssues, confirmedCount: 0, rejectedCount: 0, progressPercentage: 0 };
    }
    const confirmedCount = errors.filter(e => e.resolved).length;
    const rejectedCount = errors.filter(e => e.rejected).length;
    const processedCount = confirmedCount + rejectedCount;
    const progressPercentage = Math.round((processedCount / totalIssues) * 100);
    return { totalIssues, confirmedCount, rejectedCount, progressPercentage };
  }, [errors]);

  const uniqueCategories = useMemo(() => {
    const categories = errors.map(error => error.errorCategory);
    return ['All', ...Array.from(new Set(categories))];
  }, [errors]);

  // File handling functions
  const handleFileChange = useCallback(async (
    file: File | null,
    type: 'source' | 'target' | 'glossary' | 'reference'
  ) => {
    if (!file) {
      switch (type) {
        case 'source':
          setSourceFile(null);
          setSourceText('');
          setSourceWordCount(0);
          break;
        case 'target':
          setTargetFile(null);
          setTargetText('');
          break;
        case 'glossary':
          setGlossaryFile(null);
          setGlossaryText('');
          break;
        case 'reference':
          setReferenceFile(null);
          setReferenceText('');
          break;
      }
      return;
    }

    try {
      setLoading(true);
      setApiError(null);

      let parsedText = '';
      if (type === 'source' && file.name.toLowerCase().match(/\.(xliff|xlf|sdlxliff|tmx)$/)) {
        // Bilingual file
        const result = await parseBilingualFile(file);
        setSourceText(result.sourceText);
        setTargetText(result.targetText);
        setSourceWordCount(result.sourceWordCount);
        setSourceFile(file);
        setTargetFile(file); // Use same file for both
      } else {
        // Single file
        parsedText = await parseFile(file);
        
        switch (type) {
          case 'source':
            setSourceText(parsedText);
            setSourceWordCount(parsedText.trim().split(/\s+/).filter(Boolean).length);
            setSourceFile(file);
            break;
          case 'target':
            setTargetText(parsedText);
            setTargetFile(file);
            break;
          case 'glossary':
            setGlossaryText(parsedText);
            setGlossaryFile(file);
            break;
          case 'reference':
            setReferenceText(parsedText);
            setReferenceFile(file);
            break;
        }
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  }, [setSourceFile, setSourceText, setSourceWordCount, setTargetFile, setTargetText, setGlossaryFile, setGlossaryText, setReferenceFile, setReferenceText, setLoading, setApiError]);

  // Filter functions
  const toggleSeverityFilter = useCallback((severity: Severity) => {
    setSeverityFilter(prev => 
      prev.includes(severity) 
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    );
  }, [setSeverityFilter]);

  const handleCategoryFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
  }, [setCategoryFilter]);

  // Analysis functions
  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze) return;
    
    try {
      await analyzeDocument();
      await saveToHistory();
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  }, [canAnalyze, analyzeDocument, saveToHistory]);

  // Error action functions
  const handleApplyCorrection = useCallback(async (errorId: string) => {
    await applyCorrection(errorId);
  }, [applyCorrection]);

  const handleRejectCorrection = useCallback(async (errorId: string) => {
    await rejectCorrection(errorId);
  }, [rejectCorrection]);

  const handleRevertCorrection = useCallback(async (errorId: string) => {
    await revertCorrection(errorId);
  }, [revertCorrection]);

  const handleSuggestionEdit = useCallback(async (errorId: string, suggestion: string) => {
    await editSuggestion(errorId, suggestion);
  }, [editSuggestion]);

  // Reset function
  const handleResetTotalWords = useCallback(() => {
    setTotalAnalyzedWords(0);
  }, [setTotalAnalyzedWords]);

  return {
    // State
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
    activeHistoryEntryId,
    
    // Computed values
    canAnalyze,
    filteredErrors,
    stats,
    uniqueCategories,
    
    // Actions
    handleFileChange,
    toggleSeverityFilter,
    handleCategoryFilterChange,
    handleAnalyze,
    handleApplyCorrection,
    handleRejectCorrection,
    handleRevertCorrection,
    handleSuggestionEdit,
    handleResetTotalWords,
    resetAnalysis,
    
    // Setters
    setSourceText,
    setTargetText,
    setGlossaryText,
    setReferenceText,
    setWebsiteText,
    setErrors,
    setActiveHistoryEntryId,
  };
};
