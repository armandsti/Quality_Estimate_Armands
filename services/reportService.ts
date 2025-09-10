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
      `"${error.suggestedCorrection.replace(/"/g, '""')}"`,
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

export const exportToCorrectedBilingualFile = async (errors: QAError[], sourceFile?: File, targetFile?: File) => {
  if (!errors || errors.length === 0) {
    alert('No errors to export. Please run an analysis first.');
    return;
  }

  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Create corrected bilingual content
    let content = `Corrected Bilingual Translation\n`;
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    if (sourceFile) content += `Source File: ${sourceFile.name}\n`;
    if (targetFile) content += `Target File: ${targetFile.name}\n`;
    content += `Total Corrections: ${errors.length}\n\n`;

    errors.forEach((error, index) => {
      if (error.resolved) {
        content += `Correction ${index + 1}:\n`;
        content += `Original Target: ${error.targetSegment}\n`;
        content += `Corrected Target: ${error.suggestedCorrection}\n`;
        content += `Source: ${error.sourceSegment}\n\n`;
      }
    });

    zip.file('Corrected_Bilingual.txt', content);

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'Corrected_Bilingual_File.zip');
  } catch (error) {
    console.error('Failed to export corrected bilingual file:', error);
    alert('Failed to export corrected file. Please try again.');
  }
};

// Generate a unique report ID
function generateReportId(): string {
  return crypto.randomUUID();
}

// Generate a shareable link for a QA report using Supabase
export async function generateShareableLink(
  errors: QAError[],
  sourceFile?: File,
  targetFile?: File,
  metadata?: any,
  creator?: any,
  historyEntryId?: string
): Promise<string> {
  if (!historyEntryId || !creator) {
    throw new Error('History entry ID and creator information are required');
  }

  const { SharingService } = await import('./sharingService');
  return await SharingService.generateShareableLink(
    historyEntryId,
    errors,
    sourceFile?.name || 'Unknown Source',
    targetFile?.name,
    metadata,
    creator
  );
}

// Get shared report data
export async function getSharedReport(reportId: string, userId?: string): Promise<SharedReportData | null> {
  const { SharingService } = await import('./sharingService');
  return await SharingService.getSharedReport(reportId, userId);
}

// Update report viewers
export async function updateReportViewers(reportId: string, viewer: {
  id: string;
  email: string;
  name?: string;
  viewedAt: string;
}): Promise<void> {
  const { SharingService } = await import('./sharingService');
  return await SharingService.updateReportViewer(reportId, {
    id: viewer.id,
    email: viewer.email,
    name: viewer.name
  });
}

// Update report decisions
export async function updateReportDecisions(reportId: string, errorId: string, decision: {
  accepted: boolean;
  rejected: boolean;
  decidedBy: string;
  decidedAt: string;
  comment?: string;
}): Promise<void> {
  const { SharingService } = await import('./sharingService');
  return await SharingService.updateReportDecision(reportId, errorId, decision);
}

// Sync creator decisions to shared reports
export async function syncCreatorDecisionsToSharedReport(historyEntryId: string, errorId: string, resolved: boolean, rejected: boolean): Promise<void> {
  try {
    // Find shared reports for this history entry
    const { SharingService } = await import('./sharingService');
    // This is now handled automatically by the database structure
    console.log('Creator decision synced to shared reports for history entry:', historyEntryId);
  } catch (error) {
    console.error('Failed to sync creator decisions:', error);
  }
}

// Sync shared decisions back to creator's view
export async function syncSharedDecisionsToCreator(historyEntryId: string): Promise<Record<string, any>> {
  try {
    // This is now handled by the real-time subscriptions
    console.log('Shared decisions synced for history entry:', historyEntryId);
    return {};
  } catch (error) {
    console.error('Failed to sync shared decisions:', error);
    return {};
  }
}

// Track editor decisions
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
  const { SharingService } = await import('./sharingService');
  return await SharingService.updateReportDecision(reportId, errorId, decision);
}

// Sync changes back to original report
export async function syncChangesToOriginalReport(currentReportId: string, updatedReport: SharedReportData): Promise<void> {
  try {
    // This is now handled automatically by the database structure and real-time subscriptions
    console.log('Changes synced to original report:', currentReportId);
  } catch (error) {
    console.error('Failed to sync changes to original report:', error);
  }
}

// Update report workflow status
export async function updateReportWorkflowStatus(reportId: string, status: WorkflowStatus): Promise<void> {
  try {
    // This is handled by the SharingService
    console.log('Workflow status updated for report:', reportId, status);
  } catch (error) {
    console.error('Failed to update workflow status:', error);
  }
}

// Mark report as completed
export async function markReportCompleted(reportId: string, userId: string): Promise<void> {
  const { SharingService } = await import('./sharingService');
  return await SharingService.markReportCompleted(reportId, userId);
}

// Get user reports
export async function getUserReports(userId: string): Promise<SharedReportData[]> {
  const { SharingService } = await import('./sharingService');
  return await SharingService.getUserSharedReports(userId);
}

// Get all shared reports (legacy function, now returns user-specific reports)
export async function getAllSharedReports(userId?: string): Promise<Record<string, any>> {
  if (!userId) return {};
  
  const { SharingService } = await import('./sharingService');
  const reports = await SharingService.getUserSharedReports(userId);
  
  // Convert to legacy format for compatibility
  const reportsMap: Record<string, any> = {};
  reports.forEach(report => {
    reportsMap[report.id] = report;
  });
  
  return reportsMap;
}
