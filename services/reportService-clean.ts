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

// SHARING FEATURE DISABLED - All sharing functions preserved but disabled

// Generate a shareable link for a QA report
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

// Get shared report data
export function getSharedReport(reportId: string, userId?: string): SharedReportData | null {
  // SHARING FEATURE DISABLED - Return null instead of processing
  console.log('getSharedReport called but feature is disabled');
  return null;
}

// Update report viewers
export async function updateReportViewers(reportId: string, viewer: {
  id: string;
  email: string;
  name?: string;
  viewedAt: string;
}): Promise<void> {
  // SHARING FEATURE DISABLED - Function disabled
  console.log('updateReportViewers called but feature is disabled');
  return;
}

// Update report decisions
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
}

// Sync creator decisions to shared reports
export async function syncCreatorDecisionsToSharedReport(historyEntryId: string, errorId: string, resolved: boolean, rejected: boolean): Promise<void> {
  // SHARING FEATURE DISABLED - Function disabled
  console.log('syncCreatorDecisionsToSharedReport called but feature is disabled');
  return;
}

// Sync shared decisions back to creator's view
export async function syncSharedDecisionsToCreator(historyEntryId: string): Promise<Record<string, any>> {
  // SHARING FEATURE DISABLED - Return empty decisions
  console.log('syncSharedDecisionsToCreator called but feature is disabled');
  return {};
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
  // SHARING FEATURE DISABLED - Function disabled
  console.log('trackEditorDecision called but feature is disabled');
  return;
}

// Sync changes back to original report
export async function syncChangesToOriginalReport(currentReportId: string, updatedReport: SharedReportData): Promise<void> {
  // SHARING FEATURE DISABLED - Function disabled
  console.log('syncChangesToOriginalReport called but feature is disabled');
  return;
}

// Update report workflow status
export async function updateReportWorkflowStatus(reportId: string, status: WorkflowStatus): Promise<void> {
  // SHARING FEATURE DISABLED - Function disabled
  console.log('updateReportWorkflowStatus called but feature is disabled');
  return;
}

// Mark report as completed
export async function markReportCompleted(reportId: string, userId: string): Promise<void> {
  // SHARING FEATURE DISABLED - Function disabled
  console.log('markReportCompleted called but feature is disabled');
  return;
}

// Get user reports
export function getUserReports(userId: string): SharedReportData[] {
  // SHARING FEATURE DISABLED - Return empty array
  console.log('getUserReports called but feature is disabled');
  return [];
}

// Get all shared reports
export function getAllSharedReports(): Record<string, any> {
  // SHARING FEATURE DISABLED - Return empty object
  console.log('getAllSharedReports called but feature is disabled');
  return {};
}
