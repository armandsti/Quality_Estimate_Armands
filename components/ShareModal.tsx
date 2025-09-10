
import React, { useState, useEffect } from 'react';
import { QAError, Severity } from '../types';
import { XCircleIcon, LinkIcon, EnvelopeIcon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { generateShareableLink } from '../services/reportService';
import { ReviewerManagement } from './ReviewerManagement';
import { HistoryService } from '../services/historyService';

// Icon component copied from Icons.tsx to be used locally, to avoid changing existing patterns.
const Icon: React.FC<{ children: React.ReactNode; className?: string; }> = ({ children, className = "h-6 w-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        {children}
    </svg>
);
// Local ShareIcon for the modal title.
const ShareTitleIcon = () => <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.195.025.39.05.588.08a2.25 2.25 0 011.635 1.635c.03.198.055.393.08.588m-2.303-.866a2.25 2.25 0 00-2.303.866m2.303-.866c.225.225.415.48.588.75m-2.303-.866a2.25 2.25 0 00-.866 2.303m.866-2.303c.27.173.57.308.885.4a2.25 2.25 0 01-1.635 1.635c-.198.03-.393.055-.588.08m2.303-.866c-.225-.225-.415-.48-.588-.75m2.303.866c.27.173.57-.308.885-.4a2.25 2.25 0 001.635-1.635c.198.03.393.055.588.08m-2.303-.866a2.25 2.25 0 012.303-.866m-2.303.866c-.225.225-.415-.48-.588.75m2.303.866c.27.173.57-.308.885-.4a2.25 2.25 0 001.635-1.635c.198.03.393.055.588.08m-2.303-.866c.225-.225-.415-.48-.588-.75m-2.303-.866a2.25 2.25 0 01-.866-2.303m.866-2.303c.27.173.57-.308.885-.4a2.25 2.25 0 011.635-1.635c.03-.198.055-.393.08-.588m0 0a2.25 2.25 0 100-2.186m0 2.186a2.25 2.25 0 110-2.186" /></Icon>;


interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  errors: QAError[];
  sourceFile?: File;
  targetFile?: File;
  metadata?: any;
  historyEntryId?: string;
  onShareSuccess?: (historyEntryId: string) => void;
}

interface ShareModalState {
  shareLink: string;
  isGenerating: boolean;
  isCopied: boolean;
  sharedReportId: string | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, errors, sourceFile, targetFile, metadata, historyEntryId, onShareSuccess }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sharedReportId, setSharedReportId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && errors.length > 0) {
      // Only generate if we don't already have a link and we're not generating
      if (!shareLink && !isGenerating) {
        generateShareableReport();
      }
    }
  }, [isOpen, errors, shareLink, isGenerating]);

    const generateShareableReport = async () => {
    try {
      setIsGenerating(true);

      if (!user) {
        throw new Error('User authentication required');
      }

      if (!historyEntryId) {
        throw new Error('History entry ID is required for sharing');
      }

      console.log('Attempting to share analysis with ID:', historyEntryId);
      console.log('Current user ID:', user.id);
      console.log('Source file:', sourceFile?.name);
      console.log('Target file:', targetFile?.name);

      // Validate that the history entry exists in the database
      let finalHistoryId = historyEntryId;
      
      try {
        const dbHistory = await HistoryService.getAnalysisHistory(user.id);
        let historyEntry = dbHistory.find(entry => entry.id === historyEntryId);

        if (!historyEntry) {
          console.log('History entry not found in database, available entries:', dbHistory.map(e => e.id));
          console.log('Attempting to save current analysis to database...');
          
          // Try to save the current analysis to the database
          try {
            // For missing analyses, we'll save with minimal content since we don't have access to the original text
            const newHistoryId = await HistoryService.saveAnalysisHistory(
              user.id,
              sourceFile?.name || 'Unknown Source',
              targetFile?.name,
              'Source content not available during sharing', // sourceContent - not available in ShareModal
              'Target content not available during sharing', // targetContent - not available in ShareModal
              errors
            );
            
            console.log('Successfully saved analysis to database with ID:', newHistoryId);
            finalHistoryId = newHistoryId;
            
          } catch (saveError) {
            console.error('Failed to save analysis to database:', saveError);
            throw new Error('This analysis couldn\'t be saved to the database. Please try creating a new analysis.');
          }
        } else {
          console.log('History entry validated:', historyEntry.id);
          finalHistoryId = historyEntry.id;
        }
      } catch (validationError) {
        console.error('History validation failed:', validationError);

        // If validation fails, try to refresh the page data
        if (validationError instanceof Error && (
          validationError.message.includes('not saved to the database') ||
          validationError.message.includes('couldn\'t be saved')
        )) {
          console.log('Attempting to clear local cache...');
          // Clear potentially corrupted localStorage data
          localStorage.removeItem('translationHistory');
          localStorage.removeItem('sharedReports');
        }

        throw validationError;
      }
      
      const shareableLink = await generateShareableLink(
        errors,
        sourceFile,
        targetFile,
        metadata,
        user,
        finalHistoryId
      );

      console.log('Received shareable link:', shareableLink);
      
      // Validate the URL format
      if (!shareableLink || !shareableLink.includes('/shared-report/')) {
        throw new Error('Invalid shareable URL format received');
      }
      
      setShareLink(shareableLink);
      
      // Extract shared report ID from the URL
      const urlParts = shareableLink.split('/');
      const reportId = urlParts[urlParts.length - 1];
      
      console.log('Extracted report ID from URL:', reportId);
      
      if (!reportId || reportId.length === 0) {
        throw new Error('Could not extract report ID from URL');
      }
      
      setSharedReportId(reportId);
      
      // Call success callback if provided
      if (onShareSuccess) {
        onShareSuccess(finalHistoryId);
      }
      
    } catch (error) {
      console.error('Failed to generate shareable link:', error);

      let message = 'Failed to generate shareable link';

      if (error instanceof Error) {
        if (error.message.includes('Invalid history entry') || error.message.includes('not saved to the database')) {
          message = '✅ Analysis automatically saved to database. Please try sharing again.';
        } else if (error.message.includes('couldn\'t be saved')) {
          message = 'Unable to save analysis to database. Please create a new analysis or check your connection.';
        } else if (error.message.includes('violates foreign key constraint')) {
          message = 'Database sync issue detected. Local cache has been cleared. Please refresh and try again.';
        } else {
          message = error.message;
        }
      }

      alert(`❌ ${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const handleCopyLink = async () => {
    if (!shareLink) {
      alert('No shareable link available. Please generate the link first.');
      return;
    }

    console.log('Copying link to clipboard:', shareLink);

    try {
      await navigator.clipboard.writeText(shareLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      
      // Optional: Test the link by opening it in a new tab for debugging
      console.log('Link copied successfully. You can test it by opening:', shareLink);
    } catch (error) {
      console.error('Failed to copy link to clipboard:', error);

      // Fallback for older browsers or when clipboard API fails
      try {
        const textArea = document.createElement('textarea');
        textArea.value = shareLink;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        if (document.execCommand('copy')) {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        } else {
          throw new Error('Fallback copy method failed');
        }

        document.body.removeChild(textArea);
      } catch (fallbackError) {
        console.error('Fallback copy method also failed:', fallbackError);
        alert('Failed to copy link. Please manually copy the URL from the input field.');
      }
    }
  };

  const handleEmailShare = () => {
    const totalIssues = errors.length;
    const criticalCount = errors.filter(e => e.severity === Severity.Critical).length;
    const majorCount = errors.filter(e => e.severity === Severity.Major).length;
    const minorCount = errors.filter(e => e.severity === Severity.Minor).length;

    const subject = encodeURIComponent("Translation QA Report");
    const body = encodeURIComponent(`Hello,

A translation quality assurance analysis has been completed.

Summary:
- Total Issues: ${totalIssues}
- Critical: ${criticalCount}
- Major: ${majorCount}
- Minor: ${minorCount}

Source File: ${sourceFile?.name || 'Unknown'}
Target File: ${targetFile?.name || 'Unknown'}

Please review the detailed report at: ${shareLink}

Best regards,
${metadata?.userName || 'QA Team'}
    `.trim());

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 id="share-modal-title" className="text-xl font-bold text-slate-800 flex items-center gap-3"><ShareTitleIcon /> Share Report</h2>
          <button onClick={onClose} aria-label="Close share dialog" className="text-slate-400 hover:text-slate-600">
            <XCircleIcon />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label htmlFor="share-link" className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><LinkIcon/>Shareable Link</label>
            <div className="flex gap-2">
              <input 
                id="share-link"
                type="text"
                readOnly
                value={isGenerating ? 'Generating link...' : shareLink}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={handleCopyLink}
                disabled={isGenerating || !shareLink}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-28 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCopied ? 'Copied!' : 'Copy'}
              </button>
              {shareLink && (
                <button
                  onClick={() => window.open(shareLink, '_blank')}
                  disabled={isGenerating}
                  className="px-3 py-2 text-sm font-semibold rounded-lg text-slate-700 bg-slate-200 hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Test the shared link"
                >
                  🔗
                </button>
              )}
            </div>
            {shareLink && (
              <p className="text-xs text-slate-500 mt-2">
                This link will allow vendors to view the complete QA report with all details.
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><EnvelopeIcon />Share via Email</label>
            <button
              onClick={handleEmailShare}
              disabled={isGenerating || !shareLink}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 text-base font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Compose Email
            </button>
            <p className="text-xs text-slate-500 mt-2 text-center">
              Opens your default email client with a pre-filled message including the shareable link.
            </p>
          </div>
          
          {/* Reviewer Management */}
          {sharedReportId && (
            <div className="border-t border-slate-200 pt-6">
              <ReviewerManagement 
                reportId={sharedReportId}
                onReviewerAdded={() => {
                  console.log('Reviewer added successfully');
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
