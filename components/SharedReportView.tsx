import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSharedReport, updateReportViewers, updateReportDecisions } from '../services/reportService';
import { QAError } from '../types';
import { QAIssuesIcon, AcceptIcon, RejectIcon } from './Icons';

interface SharedReportData {
  id: string;
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
  creator: {
    id: string;
    email: string;
    name?: string;
  };
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

  const loadReport = async (id: string) => {
    try {
      const reportData = getSharedReport(id);
      if (reportData) {
        setReport(reportData);
        setDecisions(reportData.decisions || {});
        
        // Track that this user has viewed the report
        if (user) {
          await updateReportViewers(id, {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email,
            viewedAt: new Date().toISOString()
          });
        }
      } else {
        setError('Report not found or has expired');
      }
    } catch (err) {
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (errorId: number, decision: 'accept' | 'reject') => {
    if (!user || !report) return;

    try {
      const decisionData = {
        accepted: decision === 'accept',
        rejected: decision === 'reject',
        decidedBy: user.email,
        decidedAt: new Date().toISOString(),
        comment: commentText || undefined
      };

      // Update local state
      setDecisions(prev => ({
        ...prev,
        [errorId]: decisionData
      }));

      // Update the report in storage
      await updateReportDecisions(report.id, errorId, decisionData);

      // Clear comment input
      setCommentText('');
      setShowCommentInput(null);

      // Update the report state
      setReport(prev => prev ? {
        ...prev,
        decisions: {
          ...prev.decisions,
          [errorId]: decisionData
        }
      } : null);

    } catch (error) {
      console.error('Failed to update decision:', error);
      alert('Failed to save decision. Please try again.');
    }
  };

  const getDecisionForError = (errorId: number) => {
    return decisions[errorId] || null;
  };

  const canEdit = () => {
    return user && report && user.id !== report.creator.id;
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

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <QAIssuesIcon />
              <h1 className="text-2xl font-bold text-slate-800">Shared QA Report</h1>
              {canEdit() && (
                <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  Editor Mode
                </span>
              )}
            </div>
            <div className="text-sm text-slate-500">
              Generated: {formatDate(report.timestamp)}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Report Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Report Summary</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{report.summary.criticalCount}</div>
                <div className="text-sm text-slate-600">Critical Issues</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{report.summary.majorCount}</div>
                <div className="text-sm text-slate-600">Major Issues</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{report.summary.minorCount}</div>
                <div className="text-sm text-slate-600">Minor Issues</div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Source File</label>
                  <p className="text-sm text-slate-600">{report.sourceFileName}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Target File</label>
                  <p className="text-sm text-slate-600">{report.targetFileName}</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Created By</label>
                    <p className="text-sm text-slate-600">{report.creator.name || report.creator.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Report ID</label>
                    <p className="text-sm text-slate-600 font-mono">{report.id}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Issues List */}
        {report.errors.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">QA Issues ({report.errors.length})</h2>
            </div>
            <div className="divide-y divide-slate-200">
              {report.errors.map((error, index) => {
                const decision = getDecisionForError(error.id);
                const isEditing = canEdit();
                
                return (
                  <div key={index} className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          error.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                          error.severity === 'Major' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {error.severity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-800 mb-2">Source Text</h4>
                            <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700">
                              {error.sourceSegment}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-800 mb-2">Target Text</h4>
                            <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700">
                              {error.targetSegment}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-slate-800 mb-2">Issue Description</h4>
                          <p className="text-sm text-slate-600">{error.description}</p>
                        </div>
                        
                        {error.suggestedCorrection && (
                          <div className="mt-4">
                            <h4 className="text-sm font-semibold text-slate-800 mb-2">Suggested Correction</h4>
                            <div className="bg-green-50 p-3 rounded-lg text-sm text-slate-700 border border-green-200">
                              {error.suggestedCorrection}
                            </div>
                          </div>
                        )}

                        {/* Decision Section */}
                        {isEditing && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <h4 className="text-sm font-semibold text-slate-800 mb-3">Review Decision</h4>
                            
                            {decision ? (
                              <div className="flex items-center gap-3 mb-3">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                  decision.accepted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {decision.accepted ? '✓ Accepted' : '✗ Rejected'}
                                </span>
                                <span className="text-sm text-slate-500">
                                  by {decision.decidedBy} on {formatDate(decision.decidedAt)}
                                </span>
                                {decision.comment && (
                                  <span className="text-sm text-slate-600 italic">
                                    "{decision.comment}"
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleDecision(error.id, 'accept')}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                  >
                                    <AcceptIcon />
                                    Accept Suggestion
                                  </button>
                                  <button
                                    onClick={() => handleDecision(error.id, 'reject')}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                  >
                                    <RejectIcon />
                                    Reject Suggestion
                                  </button>
                                </div>
                                
                                {/* Comment Input */}
                                <div className="space-y-2">
                                  <button
                                    onClick={() => setShowCommentInput(showCommentInput === error.id.toString() ? null : error.id.toString())}
                                    className="text-sm text-slate-600 hover:text-slate-800 underline"
                                  >
                                    {showCommentInput === error.id.toString() ? 'Hide Comment' : 'Add Comment'}
                                  </button>
                                  
                                  {showCommentInput === error.id.toString() && (
                                    <div className="space-y-2">
                                      <textarea
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Add a comment about your decision (optional)"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        rows={3}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Decision Display for Non-Editors */}
                        {!isEditing && decision && (
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <h4 className="text-sm font-semibold text-slate-800 mb-2">Decision</h4>
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                decision.accepted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {decision.accepted ? '✓ Accepted' : '✗ Rejected'}
                              </span>
                              <span className="text-sm text-slate-500">
                                by {decision.decidedBy} on {formatDate(decision.decidedAt)}
                              </span>
                              {decision.comment && (
                                <span className="text-sm text-slate-600 italic">
                                  "{decision.comment}"
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
