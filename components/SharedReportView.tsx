import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSharedReport, updateReportViewers, updateReportDecisions, markReportCompleted, trackEditorDecision, syncChangesToOriginalReport } from '../services/reportService';
import { QAError, SharedReportData, UserRole, WorkflowStatus, Severity } from '../types';
import { QAIssuesIcon, AcceptIcon, RejectIcon, CheckCircleIcon, ChevronDownIcon } from './Icons';
import { ResultsList } from './ResultsTable';

export const SharedReportView: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [report, setReport] = useState<SharedReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, any>>({});
  const [showCommentInput, setShowCommentInput] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [canComplete, setCanComplete] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<Severity[]>([Severity.Critical, Severity.Major, Severity.Minor]);
  const [categoryFilter, setCategoryFilter] = useState('All');

  useEffect(() => {
    if (reportId && !authLoading) {
      if (!user) {
        // Redirect to login if not authenticated
        navigate(`/auth?redirect=/shared-report/${reportId}`);
        return;
      }
      loadReport(reportId);
    }
  }, [reportId, user, authLoading, navigate]);

  // Sync decisions from URL data and localStorage, set up real-time synchronization
  useEffect(() => {
    if (report) {
      const syncFromAllSources = () => {
        // First, try to sync from URL data
        const urlParams = new URLSearchParams(window.location.search);
        const encodedData = urlParams.get('data');
        
        if (encodedData) {
          try {
            const decodedData = JSON.parse(decodeURIComponent(encodedData));
            if (decodedData.decisions && Object.keys(decodedData.decisions).length > 0) {
              setDecisions(decodedData.decisions);
              console.log('Synced decisions from URL:', decodedData.decisions);
            }
          } catch (error) {
            console.error('Failed to parse URL data:', error);
          }
        }

        // Also check localStorage for updated reports with the same historyEntryId
        try {
          const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
          const relatedReports = Object.values(storedReports).filter((storedReport: any) => 
            (storedReport as SharedReportData).historyEntryId === report.historyEntryId
          ) as SharedReportData[];

          if (relatedReports.length > 0) {
            // Find the most up-to-date report (one with the most decisions)
            const mostUpdatedReport = relatedReports.reduce((latest: SharedReportData, current: SharedReportData) => {
              const latestDecisions = latest.decisions ? Object.keys(latest.decisions).length : 0;
              const currentDecisions = current.decisions ? Object.keys(current.decisions).length : 0;
              return currentDecisions > latestDecisions ? current : latest;
            });

            if (mostUpdatedReport.decisions && Object.keys(mostUpdatedReport.decisions).length > 0) {
              setDecisions(mostUpdatedReport.decisions);
              console.log('Synced decisions from localStorage:', mostUpdatedReport.decisions);
            }
          }
        } catch (error) {
          console.error('Failed to sync from localStorage:', error);
        }
      };

      // Initial sync
      syncFromAllSources();

      // Set up polling for real-time updates (every 2 seconds)
      const interval = setInterval(syncFromAllSources, 2000);

      return () => clearInterval(interval);
    }
  }, [report]);

  const loadReport = async (id: string) => {
    try {
      if (!id) {
        throw new Error('Report ID is missing');
      }

      if (!user) {
        throw new Error('User authentication is required');
      }

      const reportData = getSharedReport(id, user.id);

      if (!reportData) {
        setError('Report not found, has expired, or you do not have access to it. Please check the link or contact the report creator.');
        return;
      }

      // Validate report structure
      if (!reportData.errors || !Array.isArray(reportData.errors)) {
        throw new Error('Report data is corrupted or incomplete');
      }

      if (!reportData.creator || !reportData.creator.id) {
        throw new Error('Report creator information is missing');
      }

      console.log('Loading report data:', {
        id: reportData.id,
        errorsCount: reportData.errors?.length,
        decisionsCount: Object.keys(reportData.decisions || {}).length,
        errors: reportData.errors
      });
      
      setReport(reportData);
      setDecisions(reportData.decisions || {});

      // Determine user role with validation
      let role: UserRole = UserRole.Reviewer;
      if (user.id === reportData.creator.id) {
        role = UserRole.Creator;
      } else if (reportData.reviewers && Array.isArray(reportData.reviewers)) {
        const reviewer = reportData.reviewers.find(r => r.id === user.id);
        if (reviewer) {
          role = reviewer.role || UserRole.Reviewer;
        } else {
          // User is not in reviewers list - they shouldn't have access
          setError('You do not have permission to view this report.');
          return;
        }
      } else {
        // No reviewers list - legacy report, allow access but as reviewer
        role = UserRole.Reviewer;
      }
      setUserRole(role);

      // Check if user can complete the report (reviewer who hasn't completed yet)
      const canCompleteReport = role === UserRole.Reviewer &&
        reportData.workflowStatus !== WorkflowStatus.Completed &&
        (!reportData.reviewers?.find(r => r.id === user.id)?.completedAt);
      setCanComplete(canCompleteReport);

      // Track that this user has viewed the report
      try {
        await updateReportViewers(id, {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email,
          viewedAt: new Date().toISOString()
        });
      } catch (viewerError) {
        console.warn('Failed to track report view:', viewerError);
        // Don't fail the whole load for this
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load report:', error);
      setError(error instanceof Error ? error.message : 'Failed to load report');
      setLoading(false);
    }
  };

  const getDecisionForError = (errorId: string) => {
    return decisions[errorId.toString()] || null;
  };

  const handleDecision = async (errorId: string, decision: 'accept' | 'reject') => {
    if (!user || !report) return;

    try {
      const decisionData = {
        errorId: errorId.toString(),
        accepted: decision === 'accept',
        rejected: decision === 'reject',
        decidedBy: user.user_metadata?.full_name || user.email,
        decidedAt: new Date().toISOString(),
        comment: commentText.trim() || undefined
      };

      await updateReportDecisions(report.id, errorId, decisionData);
      
      // Track editor decision if user is not the creator
      if (userRole === UserRole.Reviewer) {
        await trackEditorDecision(report.id, errorId, decisionData, {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email
        });
      }
      
      // Update local state immediately for UI responsiveness
      setDecisions(prev => ({
        ...prev,
        [errorId.toString()]: decisionData
      }));

      // Update URL data for real-time synchronization across instances
      const urlParams = new URLSearchParams(window.location.search);
      const encodedData = urlParams.get('data');
      
      if (encodedData) {
        try {
          const decodedData = JSON.parse(decodeURIComponent(encodedData));
          if (decodedData.id === report.id) {
            // Update the decisions in the URL data
            if (!decodedData.decisions) decodedData.decisions = {};
            decodedData.decisions[errorId.toString()] = decisionData;
            
            // Update the errors array to reflect the decision
            decodedData.errors = decodedData.errors.map((error: any) => 
              error.id === errorId 
                ? { ...error, resolved: decisionData.accepted, rejected: decisionData.rejected }
                : error
            );
            
            // Encode and update URL
            const newEncodedData = encodeURIComponent(JSON.stringify(decodedData));
            const newUrl = `${window.location.pathname}?data=${newEncodedData}`;
            window.history.replaceState({}, '', newUrl);
            
            console.log(`Updated URL data for real-time sync: decision ${decision} for error ${errorId}`);
          }
        } catch (error) {
          console.error('Failed to update URL data for sync:', error);
        }
      }

      // Clear comment input
      setCommentText('');
      setShowCommentInput(null);

      console.log(`Decision ${decision} saved for error ${errorId}`);
    } catch (error) {
      console.error('Failed to save decision:', error);
      alert('Failed to save your decision. Please try again.');
    }
  };

  const canEdit = () => {
    // Allow both creator and reviewers to edit decisions
    const canEditResult = user && report;
    console.log('canEdit check:', {
      user: !!user,
      report: !!report,
      userRole,
      canEdit: canEditResult
    });
    return canEditResult;
  };

  const getUserRole = () => {
    if (!userRole) return '';
    return userRole === UserRole.Creator ? 'Creator' : 'Reviewer';
  };

  const getUserRoleColor = () => {
    return userRole === UserRole.Creator ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
  };

  const handleCompleteReport = async () => {
    if (!user || !report || !canComplete) {
      console.warn('Cannot complete report: missing user, report, or permission');
      return;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      'Are you sure you want to mark this report as completed? This action cannot be undone and will notify the report creator.'
    );

    if (!confirmed) return;

    try {
      setCanComplete(false); // Disable button immediately to prevent double-clicks
      await markReportCompleted(report.id, user.id);

      // Update local report state
      setReport(prev => prev ? {
        ...prev,
        workflowStatus: WorkflowStatus.Completed,
        reviewers: prev.reviewers?.map(r =>
          r.id === user.id ? { ...r, completedAt: new Date().toISOString() } : r
        )
      } : null);

      // Show success message
      alert('✅ Report marked as completed successfully! The report creator has been notified.');
    } catch (error) {
      console.error('Failed to complete report:', error);
      setCanComplete(true); // Re-enable button on failure

      // Show more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('network')) {
          alert('Network error. Please check your connection and try again.');
        } else if (error.message.includes('permission')) {
          alert('You do not have permission to complete this report.');
        } else {
          alert(`Failed to complete report: ${error.message}`);
        }
      } else {
        alert('An unexpected error occurred. Please try again.');
      }
    }
  };

  const getDecisionStats = () => {
    if (!report || !report.decisions) return { accepted: 0, rejected: 0, pending: 0 };
    
    const decisions = Object.values(report.decisions);
    const accepted = decisions.filter((d: any) => d.accepted).length;
    const rejected = decisions.filter((d: any) => d.rejected).length;
    const pending = report.errors.length - accepted - rejected;
    
    return { accepted, rejected, pending };
  };

  const stats = {
    totalIssues: report?.errors.length || 0,
    confirmedCount: getDecisionStats().accepted,
    rejectedCount: getDecisionStats().rejected,
    progressPercentage: report?.errors.length ? Math.round(((getDecisionStats().accepted + getDecisionStats().rejected) / report.errors.length) * 100) : 0
  };

  const severityCounts = report?.errors.reduce((acc, error) => {
    acc[error.severity] = (acc[error.severity] || 0) + 1;
    return acc;
  }, {} as Record<Severity, number>) || {};

  const uniqueCategories = report?.errors.reduce((acc, error) => {
    if (!acc.includes(error.errorCategory)) {
      acc.push(error.errorCategory);
    }
    return acc;
  }, [] as string[]) || [];

  // Transform errors to include resolved/rejected status from decisions
  const transformedErrors = report?.errors.map(error => {
    const decision = decisions[error.id.toString()];
    const transformed = {
      ...error,
      resolved: decision?.accepted || false,
      rejected: decision?.rejected || false
    };
    console.log(`Transforming error ${error.id}:`, {
      original: { resolved: error.resolved, rejected: error.rejected },
      decision: decision,
      transformed: { resolved: transformed.resolved, rejected: transformed.rejected }
    });
    return transformed;
  }) || [];

  const filteredErrors = transformedErrors.filter(error => {
    const matchesSeverity = severityFilter.includes(error.severity);
    const matchesCategory = categoryFilter === 'All' || error.errorCategory === categoryFilter;
    return matchesSeverity && matchesCategory;
  });

  const onToggleSeverityFilter = (severity: Severity) => {
    setSeverityFilter(prev => 
      prev.includes(severity) 
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    );
  };

  const onCategoryFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
  };

  // Mock functions for ResultsList compatibility
  const onApplyCorrection = (errorId: string) => {
    handleDecision(errorId, 'accept');
  };

  const onRejectCorrection = (errorId: string) => {
    handleDecision(errorId, 'reject');
  };

  const onSuggestionEdit = async (errorId: string, newSuggestion: string) => {
    if (!user || !report) return;

    try {
      // Update the error in the shared report
      const updatedErrors = report.errors.map(error => 
        error.id === errorId 
          ? { ...error, suggestedCorrection: newSuggestion }
          : error
      );

      // Update local report state
      setReport(prev => prev ? { ...prev, errors: updatedErrors } : null);

      // Update the shared report in storage
      const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
      if (storedReports[report.id]) {
        storedReports[report.id].errors = updatedErrors;
        localStorage.setItem('sharedReports', JSON.stringify(storedReports));
        
        // Sync changes back to original shared report
        await syncChangesToOriginalReport(report.id, storedReports[report.id]);
      }

      // Update URL data if it exists
      const urlParams = new URLSearchParams(window.location.search);
      const encodedData = urlParams.get('data');
      if (encodedData) {
        try {
          const decodedData = JSON.parse(decodeURIComponent(encodedData));
          if (decodedData.id === report.id) {
            decodedData.errors = updatedErrors;
            const newEncodedData = encodeURIComponent(JSON.stringify(decodedData));
            const newUrl = `${window.location.pathname}?data=${newEncodedData}`;
            window.history.replaceState({}, '', newUrl);
          }
        } catch (error) {
          console.error('Failed to update URL data:', error);
        }
      }

      console.log(`Suggestion edited for error ${errorId}: ${newSuggestion}`);
    } catch (error) {
      console.error('Failed to edit suggestion:', error);
      alert('Failed to save your edit. Please try again.');
    }
  };

  const onRevertCorrection = async (errorId: string) => {
    if (!user || !report) return;

    try {
      const decisionData = {
        errorId: errorId.toString(),
        accepted: false,
        rejected: false,
        decidedBy: user.user_metadata?.full_name || user.email,
        decidedAt: new Date().toISOString(),
        comment: undefined
      };

      await updateReportDecisions(report.id, errorId, decisionData);
      
      // Update local state immediately for UI responsiveness
      setDecisions(prev => ({
        ...prev,
        [errorId.toString()]: decisionData
      }));

      // Update URL data for real-time synchronization across instances
      const urlParams = new URLSearchParams(window.location.search);
      const encodedData = urlParams.get('data');
      
      if (encodedData) {
        try {
          const decodedData = JSON.parse(decodeURIComponent(encodedData));
          if (decodedData.id === report.id) {
            // Update the decisions in the URL data
            if (!decodedData.decisions) decodedData.decisions = {};
            decodedData.decisions[errorId.toString()] = decisionData;
            
            // Update the errors array to reflect the decision
            decodedData.errors = decodedData.errors.map((error: any) => 
              error.id === errorId 
                ? { ...error, resolved: false, rejected: false }
                : error
            );
            
            // Encode and update URL
            const newEncodedData = encodeURIComponent(JSON.stringify(decodedData));
            const newUrl = `${window.location.pathname}?data=${newEncodedData}`;
            window.history.replaceState({}, '', newUrl);
            
            console.log(`Updated URL data for real-time sync: reverted decision for error ${errorId}`);
          }
        } catch (error) {
          console.error('Failed to update URL data for sync:', error);
        }
      }

      console.log(`Decision reverted for error ${errorId}`);
    } catch (error) {
      console.error('Failed to revert decision:', error);
      alert('Failed to revert your decision. Please try again.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-blue-500 text-6xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Authentication Required</h1>
          <p className="text-slate-600 mb-6">You need to sign in to view this shared report.</p>
          <button
            onClick={() => navigate(`/auth?redirect=/shared-report/${reportId}`)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Report Not Available</h1>
          <p className="text-slate-600 mb-6">{error || 'The requested report could not be found.'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <QAIssuesIcon />
              <h1 className="text-2xl font-bold text-slate-800">QA Analysis ({stats.totalIssues} issues)</h1>
              <span className={`text-sm px-2 py-1 rounded-full ${getUserRoleColor()}`}>
                {getUserRole()}
              </span>
              {report?.workflowStatus && (
                <span className={`text-sm px-2 py-1 rounded-full ${
                  report.workflowStatus === WorkflowStatus.Completed
                    ? 'bg-green-100 text-green-700'
                    : report.workflowStatus === WorkflowStatus.InReview
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {report.workflowStatus.replace('_', ' ').toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {canComplete && (
                <button
                  onClick={handleCompleteReport}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700 transition-colors"
                >
                  <CheckCircleIcon />
                  Mark as Completed
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {/* File Information */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-sm text-slate-600 flex items-center gap-x-6 gap-y-2 flex-wrap">
            <div className="flex items-center gap-2">
              <strong className="font-semibold text-slate-800">Source File:</strong>
              <span>{report.sourceFileName}</span>
            </div>
            <div className="flex items-center gap-2">
              <strong className="font-semibold text-slate-800">Target File:</strong>
              <span>{report.targetFileName}</span>
            </div>
            <div className="flex items-center gap-2">
              <strong className="font-semibold text-slate-800">Created By:</strong>
              <span>{report.creator.name || report.creator.email}</span>
            </div>
          </div>

          {/* Review Progress */}
          {stats.totalIssues > 0 && (
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-700">Review Progress:</span>
                  <div className="w-40 bg-slate-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${stats.progressPercentage}%` }}></div>
                  </div>
                  <span className="font-bold text-slate-800 w-10">{stats.progressPercentage}%</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600 font-semibold">✔ {stats.confirmedCount} Accepted</span>
                  <span className="text-red-600 font-semibold">✗ {stats.rejectedCount} Rejected</span>
                  <span className="text-slate-600 font-semibold">{stats.totalIssues} Total Issues</span>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          {stats.totalIssues > 0 && (
            <div className="p-6 bg-slate-50/50">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <label htmlFor="category-filter" className="text-sm font-medium text-slate-600 mr-2">Category:</label>
                    <select id="category-filter" value={categoryFilter} onChange={onCategoryFilterChange} className="appearance-none bg-white border border-slate-300 rounded-md py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="All">All</option>
                      {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <ChevronDownIcon />
                  </div>
                  <div className="relative">
                    <label htmlFor="severity-filter" className="text-sm font-medium text-slate-600 mr-2">Severity:</label>
                    {([Severity.Critical, Severity.Major, Severity.Minor]).map(s => (
                      <button
                        key={s}
                        onClick={() => onToggleSeverityFilter(s)}
                        className={`px-3 py-1 text-sm font-semibold rounded-md ml-1 ${
                          severityFilter.includes(s)
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {s} ({severityCounts[s] || 0})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <ResultsList 
                errors={filteredErrors} 
                onApplyCorrection={onApplyCorrection} 
                onRejectCorrection={onRejectCorrection} 
                onSuggestionEdit={onSuggestionEdit} 
                onRevertCorrection={onRevertCorrection} 
              />
            </div>
          )}

          {/* No Issues Found */}
          {stats.totalIssues === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 rounded-b-xl">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 text-green-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <h3 className="mt-2 text-lg font-medium text-slate-800">No Errors Found</h3>
                <p className="mt-1 text-slate-500">The AI analysis completed successfully and found no issues.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
