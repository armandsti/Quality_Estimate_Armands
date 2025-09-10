import { QAError, SharedReportData, WorkflowStatus, UserRole } from '../types';
import saveAs from 'file-saver';
import JSZip from 'jszip';

export const exportToExcel = (errors: QAError[]) => {
  console.log('📊 Export function called with', errors.length, 'errors');

  if (!errors || errors.length === 0) {
    alert('No errors to export. Please run an analysis first.');
    return;
  }

  // Use CSV export since XLSX is not available
  try {
    console.log('🔄 Using CSV export');
    exportToCSV(errors);
  } catch (csvError) {
    console.error('❌ CSV export failed:', csvError);
    alert('Failed to export report. Please try again.');
  }
};

export const exportToCSV = (errors: QAError[]) => {
  if (!errors || errors.length === 0) {
    alert('No errors to export. Please run an analysis first.');
    return;
  }

  const csvContent = [
    ['Severity', 'Category', 'Error Type', 'Source Segment', 'Target Segment', 'Suggested Correction', 'Description'],
    ...errors.map(error => [
      error.severity,
      error.errorCategory,
      error.errorType,
      `"${error.sourceSegment.replace(/"/g, '""')}"`,
      `"${error.targetSegment.replace(/"/g, '""')}"`,
      `"${error.description.replace(/"/g, '""')}"`
    ])
  ].map(row => row.join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, 'Translation_QA_Report.csv');
};

export const exportToDocx = async (errors: QAError[], sourceFile?: File, targetFile?: File) => {
  if (!errors || errors.length === 0) {
    alert('No errors to export. Please run an analysis first.');
    return;
  }

  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Create the document content
    let content = `Translation QA Report\n`;
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    if (sourceFile) content += `Source File: ${sourceFile.name}\n`;
    if (targetFile) content += `Target File: ${targetFile.name}\n`;
    content += `Total Issues: ${errors.length}\n\n`;

    errors.forEach((error, index) => {
      content += `Issue ${index + 1}:\n`;
      content += `Severity: ${error.severity}\n`;
      content += `Category: ${error.errorCategory}\n`;
      content += `Error Type: ${error.errorType}\n`;
      content += `Source Segment: ${error.sourceSegment}\n`;
      content += `Target Segment: ${error.targetSegment}\n`;
      content += `Suggested Correction: ${error.suggestedCorrection}\n`;
      content += `Description: ${error.description}\n\n`;
    });

    // Add content to zip
    zip.file('QA_Report.txt', content);

    // Generate and download zip file
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'Translation_QA_Report.zip');
  } catch (error) {
    console.error('Failed to export to DOCX:', error);
    alert('Failed to export report. Please try again.');
  }
};

// Generate a unique report ID
function generateReportId(): string {
  return crypto.randomUUID(); // Use proper UUID instead of timestamp-based ID
}

// Generate a shareable link for a QA report
// SHARING FEATURE DISABLED - Function preserved but returns error
export async function generateShareableLink(
  errors: QAError[],
  sourceFile?: File,
  targetFile?: File,
  metadata?: any,
  creator?: any,
  historyEntryId?: string
): Promise<string> {
  // SHARING FEATURE DISABLED - Return error instead of processing
  console.log('generateShareableLink called but feature is disabled');
  throw new Error('Sharing feature is temporarily disabled for maintenance');
}
    console.log('Generated report ID:', reportId);

    // Convert creator's decisions from errors array to decisions object
    const decisions: Record<string, any> = {};
    errors.forEach(error => {
      if (error.resolved || error.rejected) {
        decisions[error.id.toString()] = {
          errorId: error.id.toString(),
          accepted: error.resolved || false,
          rejected: error.rejected || false,
          decidedBy: creator?.name || creator?.email || 'Creator',
          decidedAt: new Date().toISOString(),
          comment: undefined
        };
      }
    });

    // If this is a shared report being re-shared, include existing decisions and latest suggestion edits
    if (historyEntryId) {
      const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
      const existingSharedReportId = Object.keys(storedReports).find(key => 
        storedReports[key].historyEntryId === historyEntryId
      );
      
      if (existingSharedReportId) {
        const existingReport = storedReports[existingSharedReportId];
        if (existingReport.decisions) {
          // Merge existing decisions with new ones (existing decisions take precedence)
          Object.assign(decisions, existingReport.decisions);
          console.log('Merged existing decisions from shared report:', existingReport.decisions);
        }
        
        // Merge latest suggestion edits from existing report
        if (existingReport.errors) {
          errors = errors.map(error => {
            const existingError = existingReport.errors.find((e: any) => e.id === error.id);
            if (existingError) {
              return {
                ...error,
                suggestedCorrection: existingError.suggestedCorrection || error.suggestedCorrection,
                suggestionHighlight: existingError.suggestionHighlight || error.suggestionHighlight
              };
            }
            return error;
          });
          console.log('Merged latest suggestion edits from existing report');
        }
      }
    }

    console.log('Final decisions object:', decisions);

    // Update errors array with current decisions
    const updatedErrors = errors.map(error => {
      const decision = decisions[error.id.toString()];
      if (decision) {
        return {
          ...error,
          resolved: decision.accepted || false,
          rejected: decision.rejected || false
        };
      }
      return error;
    });

    const reportData: SharedReportData = {
      id: reportId,
      historyEntryId: historyEntryId || reportId, // Link back to history entry
      timestamp: new Date().toISOString(),
      errors: updatedErrors, // Use updated errors with decisions
      sourceFileName: sourceFile?.name || 'Unknown',
      targetFileName: targetFile?.name || 'Unknown',
      metadata: metadata || {},
      workflowStatus: WorkflowStatus.Shared,
      creator: creator || {
        id: 'unknown',
        email: 'unknown@example.com',
        name: 'Unknown User'
      },
      reviewers: [], // Will be populated when shared with specific users
      viewers: [],
      decisions: decisions, // Include all decisions
      summary: {
        totalIssues: errors.length,
        criticalCount: errors.filter(e => e.severity === 'Critical').length,
        majorCount: errors.filter(e => e.severity === 'Major').length,
        minorCount: errors.filter(e => e.severity === 'Minor').length,
      }
    };

    console.log('Report data created with decisions:', reportData);

    // Store in localStorage for the creator's browser
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    storedReports[reportId] = reportData;
    localStorage.setItem('sharedReports', JSON.stringify(storedReports));
    console.log('Stored in localStorage');

    // Note: History updates are handled by React state management in App.tsx
    // This prevents conflicts with localStorage and ensures data consistency
    if (historyEntryId) {
      console.log('History entry ID provided:', historyEntryId, '- updates will be handled by React state');
    }

    // Also encode the data in the URL for cross-browser sharing
    const baseUrl = window.location.origin;
    // Use a Unicode-safe encoding method instead of btoa()
    const encodedData = encodeURIComponent(JSON.stringify(reportData));
    const shareableUrl = `${baseUrl}/shared-report/${reportId}?data=${encodedData}`;

    console.log('Generated shareable URL:', shareableUrl);
    return shareableUrl;
  } catch (error) {
    console.error('Failed to generate shareable link:', error);
    throw new Error('Failed to generate shareable link');
  }
}

// SHARING FEATURE DISABLED - Function preserved but returns null
export function getSharedReport(reportId: string, userId?: string): SharedReportData | null {
  // SHARING FEATURE DISABLED - Return null instead of processing
  console.log('getSharedReport called but feature is disabled');
  return null;
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    const storedReport = storedReports[reportId];

    if (storedReport) {
      // Check if user has access to this report
      if (userId && !hasAccessToReport(storedReport, userId)) {
        console.log('User does not have access to this report');
        return null;
      }
      return storedReport;
    }

    // If not in localStorage, try to get from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');

    if (encodedData) {
      try {
        // Use decodeURIComponent instead of atob for Unicode-safe decoding
        const decodedData = JSON.parse(decodeURIComponent(encodedData));
        // Verify the report ID matches
        if (decodedData.id === reportId) {
          // Check if user has access to this report
          if (userId && !hasAccessToReport(decodedData, userId)) {
            console.log('User does not have access to this report from URL');
            return null;
          }
          return decodedData;
        }
      } catch (decodeError) {
        console.error('Failed to decode URL data:', decodeError);
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to retrieve shared report:', error);
    return null;
  }
}

// Helper function to check if a user has access to a shared report
function hasAccessToReport(report: SharedReportData, userId: string): boolean {
  // Creator always has access
  if (report.creator.id === userId) {
    return true;
  }

  // Check if user is in the reviewers list
  const isReviewer = report.reviewers?.some(reviewer => reviewer.id === userId);
  if (isReviewer) {
    return true;
  }

  // Check legacy viewers list for backward compatibility
  const isViewer = report.viewers?.some(viewer => viewer.id === userId);
  if (isViewer) {
    return true;
  }

  return false;
}

// SHARING FEATURE DISABLED - Function preserved but does nothing
export async function updateReportViewers(reportId: string, viewer: {
  id: string;
  email: string;
  name?: string;
  viewedAt: string;
}): Promise<void> {
  // SHARING FEATURE DISABLED - Function disabled
  console.log('updateReportViewers called but feature is disabled');
  return;
  try {
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    const report = storedReports[reportId];

    if (report) {
      // Update legacy viewers list for backward compatibility
      if (!report.viewers) {
        report.viewers = [];
      }
      const existingViewerIndex = report.viewers.findIndex((v: any) => v.id === viewer.id);
      if (existingViewerIndex >= 0) {
        report.viewers[existingViewerIndex].viewedAt = viewer.viewedAt;
      } else {
        report.viewers.push(viewer);
      }

      // Also update reviewers list if the viewer is a reviewer
      if (report.reviewers) {
        const reviewerIndex = report.reviewers.findIndex((r: any) => r.id === viewer.id);
        if (reviewerIndex >= 0) {
          report.reviewers[reviewerIndex].lastViewedAt = viewer.viewedAt;
        }
      }

      storedReports[reportId] = report;
      localStorage.setItem('sharedReports', JSON.stringify(storedReports));
    }

    // Also update the URL data if it exists
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');

    if (encodedData) {
      try {
        const decodedData = JSON.parse(decodeURIComponent(encodedData));
        if (decodedData.id === reportId) {
          // Update legacy viewers list
          if (!decodedData.viewers) {
            decodedData.viewers = [];
          }
          const existingViewerIndex = decodedData.viewers.findIndex((v: any) => v.id === viewer.id);
          if (existingViewerIndex >= 0) {
            decodedData.viewers[existingViewerIndex].viewedAt = viewer.viewedAt;
          } else {
            decodedData.viewers.push(viewer);
          }

          // Update reviewers list if the viewer is a reviewer
          if (decodedData.reviewers) {
            const reviewerIndex = decodedData.reviewers.findIndex((r: any) => r.id === viewer.id);
            if (reviewerIndex >= 0) {
              decodedData.reviewers[reviewerIndex].lastViewedAt = viewer.viewedAt;
            }
          }

          // Update the URL with new data
          const newEncodedData = encodeURIComponent(JSON.stringify(decodedData));
          const newUrl = `${window.location.pathname}?data=${newEncodedData}`;
          window.history.replaceState({}, '', newUrl);
        }
      } catch (decodeError) {
        console.error('Failed to update URL viewer data:', decodeError);
      }
    }
  } catch (error) {
    console.error('Failed to update report viewers:', error);
  }
}

// SHARING FEATURE DISABLED - Function preserved but does nothing
export async function updateReportDecisions(reportId: string, errorId: string, decision: {
  accepted: boolean;
  rejected: boolean;
  decidedBy: string;
  decidedAt: string;
  comment?: string;
}): Promise<void> {
  // SHARING FEATURE DISABLED - Function disabled
  console.log('updateReportDecisions called but feature is disabled');
  return;

    if (report) {
      if (!report.decisions) {
        report.decisions = {};
      }
      report.decisions[errorId] = decision;
      storedReports[reportId] = report;
      localStorage.setItem('sharedReports', JSON.stringify(storedReports));
      
      // Sync changes back to original shared report
      await syncChangesToOriginalReport(reportId, report);
    }

    // Also update the URL data if it exists
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');

    if (encodedData) {
      try {
        // Use decodeURIComponent instead of atob for Unicode-safe decoding
        const decodedData = JSON.parse(decodeURIComponent(encodedData));
        if (decodedData.id === reportId) {
          if (!decodedData.decisions) {
            decodedData.decisions = {};
          }
          decodedData.decisions[errorId] = decision;

          // Update the URL with new data
          const newEncodedData = encodeURIComponent(JSON.stringify(decodedData));
          const newUrl = `${window.location.pathname}?data=${newEncodedData}`;
          window.history.replaceState({}, '', newUrl);
        }
      } catch (decodeError) {
        console.error('Failed to update URL data:', decodeError);
      }
    }
  } catch (error) {
    console.error('Failed to update report decisions:', error);
  }
}

// Sync creator decisions to shared reports
// SHARING FEATURE DISABLED - Function preserved but does nothing
export async function syncCreatorDecisionsToSharedReport(historyEntryId: string, errorId: string, resolved: boolean, rejected: boolean): Promise<void> {
  // SHARING FEATURE DISABLED - Function disabled
  console.log('syncCreatorDecisionsToSharedReport called but feature is disabled');
  return;
    // Find ALL shared reports for this history entry (all levels in the chain)
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    const allRelatedReportIds = Object.keys(storedReports).filter(key => 
      storedReports[key].historyEntryId === historyEntryId
    );
    
    console.log(`Found ${allRelatedReportIds.length} related reports for creator sync: ${historyEntryId}`);
    
    // Update ALL reports in the chain with the creator's decision
    allRelatedReportIds.forEach(reportId => {
      const report = storedReports[reportId];
      if (!report.decisions) {
        report.decisions = {};
      }
      
      // Update the decision
      report.decisions[errorId] = {
        errorId: errorId.toString(),
        accepted: resolved,
        rejected: rejected,
        decidedBy: 'Creator', // We'll get the actual creator name from the report
        decidedAt: new Date().toISOString(),
        comment: undefined
      };
      
      storedReports[reportId] = report;
      console.log(`Synced creator decision to report ${reportId}: error ${errorId} - resolved: ${resolved}, rejected: ${rejected}`);
    });
    
    localStorage.setItem('sharedReports', JSON.stringify(storedReports));
    console.log(`Successfully synced creator decision to all ${allRelatedReportIds.length} related reports`);
  } catch (error) {
    console.error('Failed to sync creator decisions to shared reports:', error);
  }
}

// Sync shared decisions back to creator's view
// SHARING FEATURE DISABLED - Function preserved but returns empty object
export async function syncSharedDecisionsToCreator(historyEntryId: string): Promise<Record<string, any>> {
  // SHARING FEATURE DISABLED - Return empty decisions
  console.log('syncSharedDecisionsToCreator called but feature is disabled');
  return {};
  try {
    // Find the shared report for this history entry
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    const sharedReportId = Object.keys(storedReports).find(key => storedReports[key].historyEntryId === historyEntryId);
    
    if (sharedReportId) {
      const report = storedReports[sharedReportId];
      if (report.decisions) {
        console.log(`Syncing shared decisions to creator for history ${historyEntryId}:`, report.decisions);
        return report.decisions;
      }
    }
    return {};
  } catch (error) {
    console.error('Failed to sync shared decisions to creator:', error);
    return {};
  }
}

// Track editor decisions and update shared report with editor info
// SHARING FEATURE DISABLED - Function preserved but does nothing
export async function trackEditorDecision(reportId: string, errorId: string, decision: {
  accepted: boolean;
  rejected: boolean;
  decidedBy: string;
  decidedAt: string;
  comment?: string;
}, editorInfo: {
  id: string;
  email: string;
  name?: string;
}): Promise<void> {
  // SHARING FEATURE DISABLED - Function disabled
  console.log('trackEditorDecision called but feature is disabled');
  return;
      // Update decisions
      if (!report.decisions) {
        report.decisions = {};
      }
      report.decisions[errorId] = decision;

      // Add or update editor in reviewers list
      if (!report.reviewers) {
        report.reviewers = [];
      }

      const existingReviewerIndex = report.reviewers.findIndex((r: any) => r.id === editorInfo.id);
      if (existingReviewerIndex >= 0) {
        // Update existing reviewer
        report.reviewers[existingReviewerIndex] = {
          ...report.reviewers[existingReviewerIndex],
          lastViewedAt: new Date().toISOString(),
          lastDecisionAt: new Date().toISOString()
        };
      } else {
        // Add new reviewer
        report.reviewers.push({
          id: editorInfo.id,
          email: editorInfo.email,
          name: editorInfo.name || editorInfo.email,
          role: 'reviewer',
          invitedAt: new Date().toISOString(),
          lastViewedAt: new Date().toISOString(),
          lastDecisionAt: new Date().toISOString()
        });
      }

      storedReports[reportId] = report;
      localStorage.setItem('sharedReports', JSON.stringify(storedReports));

      // Sync changes back to original shared report if this is a re-shared report
      await syncChangesToOriginalReport(reportId, report);

      console.log(`Tracked editor decision for report ${reportId}:`, {
        editor: editorInfo,
        decision: decision,
        reviewers: report.reviewers
      });
    }
  } catch (error) {
    console.error('Failed to track editor decision:', error);
  }
}

// Sync changes back to ALL levels in the sharing chain
// SHARING FEATURE DISABLED - Function preserved but does nothing
export async function syncChangesToOriginalReport(currentReportId: string, updatedReport: SharedReportData): Promise<void> {
  // SHARING FEATURE DISABLED - Function disabled
  console.log('syncChangesToOriginalReport called but feature is disabled');
  return;
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    
    // Find ALL reports with the same historyEntryId (all levels in the chain)
    const allRelatedReportIds = Object.keys(storedReports).filter(key => {
      const report = storedReports[key];
      return report.historyEntryId === updatedReport.historyEntryId;
    });

    console.log(`Found ${allRelatedReportIds.length} related reports for historyEntryId: ${updatedReport.historyEntryId}`);

    // Update ALL reports in the chain with the latest changes
    allRelatedReportIds.forEach(reportId => {
      if (reportId !== currentReportId) { // Don't update the current report
        const report = storedReports[reportId];
        console.log(`Syncing changes from ${currentReportId} to report ${reportId}`);
        
        // Update the report with the latest changes
        report.decisions = { ...report.decisions, ...updatedReport.decisions };
        report.errors = updatedReport.errors;
        report.reviewers = updatedReport.reviewers;
        report.workflowStatus = updatedReport.workflowStatus;
        
        storedReports[reportId] = report;
        console.log(`Successfully synced changes to report ${reportId}`);
      }
    });

    localStorage.setItem('sharedReports', JSON.stringify(storedReports));
    console.log(`Successfully synced changes to all ${allRelatedReportIds.length - 1} related reports`);
  } catch (error) {
    console.error('Failed to sync changes to related reports:', error);
  }
}

export async function addReviewerToReport(reportId: string, reviewer: {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
}): Promise<void> {
  try {
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    const report = storedReports[reportId];

    if (report) {
      if (!report.reviewers) {
        report.reviewers = [];
      }

      // Check if reviewer already exists
      const existingIndex = report.reviewers.findIndex(r => r.id === reviewer.id);
      if (existingIndex >= 0) {
        // Update existing reviewer
        report.reviewers[existingIndex] = {
          ...report.reviewers[existingIndex],
          ...reviewer,
          invitedAt: report.reviewers[existingIndex].invitedAt // Preserve original invite time
        };
      } else {
        // Add new reviewer
        report.reviewers.push({
          ...reviewer,
          invitedAt: new Date().toISOString()
        });
      }

      storedReports[reportId] = report;
      localStorage.setItem('sharedReports', JSON.stringify(storedReports));
    }
  } catch (error) {
    console.error('Failed to add reviewer to report:', error);
  }
}

export async function updateReportWorkflowStatus(reportId: string, status: WorkflowStatus): Promise<void> {
  try {
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    const report = storedReports[reportId];

    if (report) {
      report.workflowStatus = status;
      storedReports[reportId] = report;
      localStorage.setItem('sharedReports', JSON.stringify(storedReports));
    }

    // Also update the URL data if it exists
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');

    if (encodedData) {
      try {
        const decodedData = JSON.parse(decodeURIComponent(encodedData));
        if (decodedData.id === reportId) {
          decodedData.workflowStatus = status;

          // Update the URL with new data
          const newEncodedData = encodeURIComponent(JSON.stringify(decodedData));
          const newUrl = `${window.location.pathname}?data=${newEncodedData}`;
          window.history.replaceState({}, '', newUrl);
        }
      } catch (decodeError) {
        console.error('Failed to update URL workflow status:', decodeError);
      }
    }
  } catch (error) {
    console.error('Failed to update report workflow status:', error);
  }
}

// SHARING FEATURE DISABLED - Function preserved but does nothing
export async function markReportCompleted(reportId: string, userId: string): Promise<void> {
  // SHARING FEATURE DISABLED - Function disabled
  console.log('markReportCompleted called but feature is disabled');
  return;

    if (report) {
      // Update reviewer's completion status
      if (report.reviewers) {
        const reviewerIndex = report.reviewers.findIndex(r => r.id === userId);
        if (reviewerIndex >= 0) {
          report.reviewers[reviewerIndex].completedAt = new Date().toISOString();
          report.reviewers[reviewerIndex].lastViewedAt = new Date().toISOString();
        }
      }

      // Update workflow status to completed
      report.workflowStatus = WorkflowStatus.Completed;
      storedReports[reportId] = report;
      localStorage.setItem('sharedReports', JSON.stringify(storedReports));
    }

    // Also update the URL data if it exists
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');

    if (encodedData) {
      try {
        const decodedData = JSON.parse(decodeURIComponent(encodedData));
        if (decodedData.id === reportId) {
          // Update reviewer's completion status
          if (decodedData.reviewers) {
            const reviewerIndex = decodedData.reviewers.findIndex((r: any) => r.id === userId);
            if (reviewerIndex >= 0) {
              decodedData.reviewers[reviewerIndex].completedAt = new Date().toISOString();
              decodedData.reviewers[reviewerIndex].lastViewedAt = new Date().toISOString();
            }
          }
          decodedData.workflowStatus = WorkflowStatus.Completed;

          // Update the URL with new data
          const newEncodedData = encodeURIComponent(JSON.stringify(decodedData));
          const newUrl = `${window.location.pathname}?data=${newEncodedData}`;
          window.history.replaceState({}, '', newUrl);
        }
      } catch (decodeError) {
        console.error('Failed to update URL completion status:', decodeError);
      }
    }
  } catch (error) {
    console.error('Failed to mark report as completed:', error);
  }
}

export function getUserReports(userId: string): SharedReportData[] {
  try {
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    const userReports: SharedReportData[] = [];

    for (const reportId in storedReports) {
      const report = storedReports[reportId];
      if (hasAccessToReport(report, userId)) {
        userReports.push(report);
      }
    }

    return userReports;
  } catch (error) {
    console.error('Failed to get user reports:', error);
    return [];
  }
}

export function getAllSharedReports(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem('sharedReports') || '{}');
  } catch (error) {
    console.error('Failed to retrieve shared reports:', error);
    return {};
  }
}

// Helper function to escape XML special characters.
function escapeXml(text: string) {
    return text.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
        return c;
    });
}

export const exportToCorrectedBilingualFile = async (
    originalFile: File,
    errorsToApply: QAError[],
    originalFilename: string
) => {
    try {
        const text = await originalFile.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "application/xml");

        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
            console.error("XML Parse Error:", parserError.textContent);
            throw new Error(`The file "${originalFilename}" is not a well-formed XML file.`);
        }
        
        const fileNameLower = originalFilename.toLowerCase();
        const isXliff = fileNameLower.endsWith('.xliff') || fileNameLower.endsWith('.xlf') || fileNameLower.endsWith('.sdlxliff');
        const isTmx = fileNameLower.endsWith('.tmx');

        if (isXliff) {
            const transUnits = Array.from(xmlDoc.getElementsByTagName('trans-unit'));
            const sourceMap = new Map<string, Element[]>();
            for (const unit of transUnits) {
                const sourceNode = unit.querySelector('source');
                if (sourceNode?.textContent) {
                    const key = sourceNode.textContent.trim();
                    if (!sourceMap.has(key)) {
                        sourceMap.set(key, []);
                    }
                    sourceMap.get(key)!.push(unit);
                }
            }
            for (const error of errorsToApply) {
                const sourceKey = error.sourceSegment.trim();
                const matchingUnits = sourceMap.get(sourceKey);
                if (matchingUnits) {
                    const unitToUpdate = matchingUnits.find(unit => {
                        const targetNode = unit.querySelector('target');
                        return targetNode?.textContent?.trim() === error.targetSegment.trim();
                    });
                    if (unitToUpdate) {
                        const targetNode = unitToUpdate.querySelector('target');
                        if (targetNode) {
                            // Find the innermost element to preserve inline tags instead of replacing the whole content
                            let nodeToUpdate: Node = targetNode;
                            while (nodeToUpdate.firstChild && nodeToUpdate.childNodes.length === 1 && nodeToUpdate.firstChild.nodeType === Node.ELEMENT_NODE) {
                                nodeToUpdate = nodeToUpdate.firstChild;
                            }
                            nodeToUpdate.textContent = error.suggestedCorrection;
                        }
                    }
                }
            }
        } else if (isTmx) {
            const transUnits = Array.from(xmlDoc.getElementsByTagName('tu'));
            const sourceMap = new Map<string, Element[]>();
            for (const unit of transUnits) {
                const tuvs = Array.from(unit.getElementsByTagName('tuv'));
                if (tuvs.length > 0) {
                    const sourceSeg = tuvs[0].querySelector('seg');
                    if (sourceSeg?.textContent) {
                         const key = sourceSeg.textContent.trim();
                        if (!sourceMap.has(key)) {
                            sourceMap.set(key, []);
                        }
                        sourceMap.get(key)!.push(unit);
                    }
                }
            }
            for (const error of errorsToApply) {
                 const sourceKey = error.sourceSegment.trim();
                 const matchingUnits = sourceMap.get(sourceKey);
                 if (matchingUnits) {
                     const unitToUpdate = matchingUnits.find(unit => {
                         const tuvs = Array.from(unit.getElementsByTagName('tuv'));
                         if (tuvs.length > 1) {
                            const targetSeg = tuvs[1].querySelector('seg');
                            return targetSeg?.textContent?.trim() === error.targetSegment.trim();
                         }
                         return false;
                     });
                     if (unitToUpdate) {
                         const targetSeg = unitToUpdate.getElementsByTagName('tuv')[1]?.querySelector('seg');
                         if (targetSeg) {
                             // Find the innermost element to preserve inline tags
                            let nodeToUpdate: Node = targetSeg;
                            while (nodeToUpdate.firstChild && nodeToUpdate.childNodes.length === 1 && nodeToUpdate.firstChild.nodeType === Node.ELEMENT_NODE) {
                                nodeToUpdate = nodeToUpdate.firstChild;
                            }
                             nodeToUpdate.textContent = error.suggestedCorrection;
                         }
                     }
                 }
             }
        }
        
        const serializer = new XMLSerializer();
        const newXmlString = serializer.serializeToString(xmlDoc);

        const blob = new Blob([newXmlString], { type: 'application/xml' });
        const newFilename = originalFilename.startsWith('Reviewed_') ? originalFilename : `Reviewed_${originalFilename}`;

        saveAs(blob, newFilename);

    } catch (e) {
        console.error("Error processing bilingual file:", e);
        const message = e instanceof Error ? e.message : "An unknown error occurred.";
        alert(`Could not generate the corrected bilingual file. ${message}`);
    }
};

export const exportToCorrectedDocx = async (
    originalFile: File,
    errorsToApply: QAError[],
    originalFilename: string
) => {
    try {
        console.log(`Starting DOCX correction process for ${errorsToApply.length} corrections`);
        console.log('Original file:', originalFile.name, 'Size:', originalFile.size, 'Type:', originalFile.type);
        
        // Validate file
        if (originalFile.size === 0) {
            throw new Error('File is empty');
        }
        
        if (!originalFile.name.toLowerCase().endsWith('.docx')) {
            throw new Error('File is not a .docx file');
        }
        
        const zip = await JSZip.loadAsync(originalFile);
        console.log('Successfully loaded ZIP file');
        
        // Check what files are in the ZIP
        const zipFiles = Object.keys(zip.files);
        console.log('ZIP contents:', zipFiles);
        
        const docFile = zip.file('word/document.xml');
        if (!docFile) {
            throw new Error('Invalid DOCX file: word/document.xml not found. Available files: ' + zipFiles.join(', '));
        }

        let docXml = await docFile.async('string');
        console.log('Successfully extracted XML content, length:', docXml.length);
        
        if (docXml.length === 0) {
            throw new Error('Document XML content is empty');
        }
        
        // Sort errors by their ID to apply them in the order they appear in the document.
        const sortedErrors = [...errorsToApply].sort((a, b) => a.id.localeCompare(b.id));

        let totalReplacements = 0;
        
        for (const error of sortedErrors) {
            console.log(`\n--- Processing correction ${error.id} ---`);
            console.log(`Target: "${error.targetSegment}"`);
            console.log(`Correction: "${error.suggestedCorrection}"`);
            
            // Try multiple approaches to find and replace the text
            
            // Approach 1: Direct text replacement
            let replacementMade = false;
            
            if (docXml.includes(error.targetSegment)) {
                console.log(`✅ Found exact match for: "${error.targetSegment}"`);
                docXml = docXml.replace(error.targetSegment, error.suggestedCorrection);
                replacementMade = true;
                totalReplacements++;
                console.log(`✅ Applied direct replacement`);
            } else {
                console.log(`❌ Exact text not found: "${error.targetSegment}"`);
                
                // Approach 2: Try with normalized spaces
                const normalizedTarget = error.targetSegment.replace(/\s+/g, ' ');
                if (docXml.includes(normalizedTarget)) {
                    console.log(`✅ Found normalized match: "${normalizedTarget}"`);
                    docXml = docXml.replace(normalizedTarget, error.suggestedCorrection);
                    replacementMade = true;
                    totalReplacements++;
                    console.log(`✅ Applied normalized replacement`);
                } else {
                    console.log(`❌ Normalized text not found either`);
                    
                    // Approach 3: Try word-by-word replacement for longer phrases
                    if (error.targetSegment.split(' ').length > 2) {
                        console.log(`Trying word-by-word approach for longer phrase`);
                        
                        // Split into words and try to find consecutive words
                        const words = error.targetSegment.split(/\s+/).filter(w => w.length > 0);
                        console.log(`Words to find:`, words);
                        
                        // Look for consecutive word sequences
                        for (let i = 0; i < words.length - 1; i++) {
                            const wordPair = `${words[i]} ${words[i + 1]}`;
                            if (docXml.includes(wordPair)) {
                                console.log(`Found word pair: "${wordPair}"`);
                                
                                // Try to replace the full phrase around this pair
                                const startIndex = docXml.indexOf(wordPair);
                                const endIndex = startIndex + wordPair.length;
                                
                                // Look for the full phrase in a reasonable range
                                const searchStart = Math.max(0, startIndex - 50);
                                const searchEnd = Math.min(docXml.length, endIndex + 50);
                                const searchRange = docXml.substring(searchStart, searchEnd);
                                
                                console.log(`Search range: "${searchRange}"`);
                                
                                // Try to find a close match in this range
                                if (searchRange.includes(error.targetSegment.substring(0, Math.min(20, error.targetSegment.length)))) {
                                    console.log(`Found partial match in search range`);
                                    // Replace the full phrase
                                    docXml = docXml.replace(error.targetSegment, error.suggestedCorrection);
                                    replacementMade = true;
                                    totalReplacements++;
                                    console.log(`✅ Applied phrase replacement`);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            if (!replacementMade) {
                console.log(`❌ All replacement approaches failed for: "${error.targetSegment}"`);
                
                // Show what's actually in the XML around expected locations
                console.log(`Debug: Looking for text in XML...`);
                
                // Search for key words that should be in the document
                const keyWords = ['Zemgale', 'District', 'Court', 'Adgre', 'Hosea', 'Josh', 'Masih', 'Aaster'];
                for (const word of keyWords) {
                    const index = docXml.indexOf(word);
                    if (index !== -1) {
                        const start = Math.max(0, index - 100);
                        const end = Math.min(docXml.length, index + 100);
                        console.log(`Found "${word}" at position ${index}: "${docXml.substring(start, end)}"`);
                    } else {
                        console.log(`Word "${word}" not found in XML`);
                    }
                }
            }
        }

        console.log(`\n--- Summary ---`);
        console.log(`Total replacements made: ${totalReplacements}`);
        console.log(`Final XML length: ${docXml.length}`);

        // Update the zip with the modified XML
        zip.file('word/document.xml', docXml);
        console.log('Updated ZIP file with modified XML');

        // Generate the new file
        const blob = await zip.generateAsync({ 
            type: 'blob', 
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        console.log('Generated blob, size:', blob.size);
        
        const newFilename = originalFilename.startsWith('Reviewed_') ? 
            originalFilename : `Reviewed_${originalFilename}`;

        console.log(`📄 Saving corrected file as: ${newFilename}`);
        saveAs(blob, newFilename);
        console.log('File saved successfully!');

    } catch (e) {
        console.error('=== DOCX Processing Error ===');
        console.error('Error type:', typeof e);
        console.error('Error message:', e.message);
        console.error('Error stack:', e.stack);
        console.error('Full error object:', e);
        
        // Provide more helpful error messages
        if (e.message.includes('File is empty')) {
            alert("The uploaded file is empty. Please check the file and try again.");
        } else if (e.message.includes('not a .docx file')) {
            alert("The file is not a valid .docx file. Please upload a Word document.");
        } else if (e.message.includes('word/document.xml not found')) {
            alert("The .docx file structure is invalid or corrupted. Please try a different file.");
        } else if (e.message.includes('Document XML content is empty')) {
            alert("The .docx file appears to be empty or corrupted. Please try a different file.");
        } else if (e.message.includes('ZIP')) {
            alert("The file could not be processed as a ZIP archive. It may not be a valid .docx file.");
        } else {
            alert(`Could not generate the corrected .docx file: ${e.message}`);
        }
    }
};
