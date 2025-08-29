import { QAError } from '../types';
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
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `report_${timestamp}_${randomStr}`;
}

// Generate a shareable link for a QA report
export async function generateShareableLink(
  errors: QAError[],
  sourceFile?: File,
  targetFile?: File,
  metadata?: any,
  creator?: any
): Promise<string> {
  try {
    const reportId = generateReportId();
    const reportData = {
      id: reportId,
      timestamp: new Date().toISOString(),
      errors: errors,
      sourceFileName: sourceFile?.name || 'Unknown',
      targetFileName: targetFile?.name || 'Unknown',
      metadata: metadata || {},
      creator: creator || {
        id: 'unknown',
        email: 'unknown@example.com',
        name: 'Unknown User'
      },
      viewers: [],
      decisions: {}, // Initialize decisions object
      summary: {
        totalIssues: errors.length,
        criticalCount: errors.filter(e => e.severity === 'Critical').length,
        majorCount: errors.filter(e => e.severity === 'Major').length,
        minorCount: errors.filter(e => e.severity === 'Minor').length,
      }
    };
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    storedReports[reportId] = reportData;
    localStorage.setItem('sharedReports', JSON.stringify(storedReports));
    const baseUrl = window.location.origin;
    const shareableUrl = `${baseUrl}/shared-report/${reportId}`;
    return shareableUrl;
  } catch (error) {
    console.error('Failed to generate shareable link:', error);
    throw new Error('Failed to generate shareable link');
  }
}

export function getSharedReport(reportId: string): any | null {
  try {
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    return storedReports[reportId] || null;
  } catch (error) {
    console.error('Failed to retrieve shared report:', error);
    return null;
  }
}

export async function updateReportViewers(reportId: string, viewer: {
  id: string;
  email: string;
  name?: string;
  viewedAt: string;
}): Promise<void> {
  try {
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    const report = storedReports[reportId];

    if (report) {
      if (!report.viewers) {
        report.viewers = [];
      }
      const existingViewerIndex = report.viewers.findIndex((v: any) => v.id === viewer.id);
      if (existingViewerIndex >= 0) {
        report.viewers[existingViewerIndex].viewedAt = viewer.viewedAt;
      } else {
        report.viewers.push(viewer);
      }
      storedReports[reportId] = report;
      localStorage.setItem('sharedReports', JSON.stringify(storedReports));
    }
  } catch (error) {
    console.error('Failed to update report viewers:', error);
  }
}

export async function updateReportDecisions(reportId: string, errorId: number, decision: {
  accepted: boolean;
  rejected: boolean;
  decidedBy: string;
  decidedAt: string;
  comment?: string;
}): Promise<void> {
  try {
    const storedReports = JSON.parse(localStorage.getItem('sharedReports') || '{}');
    const report = storedReports[reportId];

    if (report) {
      if (!report.decisions) {
        report.decisions = {};
      }
      report.decisions[errorId] = decision;
      storedReports[reportId] = report;
      localStorage.setItem('sharedReports', JSON.stringify(storedReports));
    }
  } catch (error) {
    console.error('Failed to update report decisions:', error);
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
        const sortedErrors = [...errorsToApply].sort((a, b) => a.id - b.id);

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
