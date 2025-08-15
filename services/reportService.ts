import { QAError } from '../types';
import saveAs from 'file-saver';
import JSZip from 'jszip';


// xlsx is loaded from a CDN in index.html
declare const XLSX: any;

export const exportToExcel = (errors: QAError[]) => {
  if (!errors || errors.length === 0) {
    alert('No errors to export. Please run an analysis first.');
    return;
  }
  
  try {
    const worksheetData = errors.map(error => ({
      Severity: error.severity,
      Category: error.errorCategory,
      'Error Type': error.errorType,
      'Source Segment': error.sourceSegment,
      'Target Segment': error.targetSegment,
      'Suggested Correction': error.suggestedCorrection,
      Description: error.description,
    }));
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'QA Report');
  
  // Define column widths
  if (worksheetData.length > 0) {
    const colA_width = Math.max('Severity'.length, ...worksheetData.map(r => r.Severity?.length ?? 0)) + 2;
    const colB_width = Math.max('Category'.length, ...worksheetData.map(r => r.Category?.length ?? 0)) + 2;
    const colC_width = Math.max('Error Type'.length, ...worksheetData.map(r => r['Error Type']?.length ?? 0)) + 2;
    
    worksheet['!cols'] = [
        { wch: colA_width }, // A: Severity
        { wch: colB_width }, // B: Category
        { wch: colC_width }, // C: Error Type
        { wch: 70 }, // D: Source Segment
        { wch: 70 }, // E: Target Segment
        { wch: 70 }, // F: Suggested Correction
        { wch: 70 }, // G: Description
    ];
  }
  
  // Apply text wrapping and alignment to specific columns
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  // Start from R=1 to skip the header row.
  for (let R = 1; R <= range.e.r; ++R) {
    // Columns D, E, F, G correspond to indices 3, 4, 5, 6.
    for (let C = 3; C <= 6; ++C) {
      const cell_address = XLSX.utils.encode_cell({c: C, r: R});
      const cell = worksheet[cell_address];
      
      if (cell) {
        if (!cell.s) {
          cell.s = {};
        }
        cell.s.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
      }
    }
  }
  
    XLSX.writeFile(workbook, 'Translation_QA_Report.xlsx');
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Failed to export Excel file. Please try again.');
  }
};


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

export const exportToDocx = async (
    originalFile: File,
    errorsToApply: QAError[],
    originalFilename: string
) => {
    try {
        console.log(`Starting DOCX correction process for ${errorsToApply.length} corrections`);
        console.log('Original file:', originalFile.name, 'Size:', originalFile.size);
        
        const zip = await JSZip.loadAsync(originalFile);
        console.log('Successfully loaded ZIP file');
        
        const docFile = zip.file('word/document.xml');
        if (!docFile) {
            throw new Error('Invalid DOCX file: word/document.xml not found.');
        }

        let docXml = await docFile.async('string');
        console.log('Successfully extracted XML content, length:', docXml.length);
        
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
        if (e.message.includes('Invalid DOCX file')) {
            alert("The uploaded file is not a valid .docx file. Please check the file format.");
        } else if (e.message.includes('word/document.xml not found')) {
            alert("The .docx file structure is invalid or corrupted.");
        } else if (e.message.includes('ZIP')) {
            alert("The file could not be opened as a ZIP archive. It may not be a valid .docx file.");
        } else {
            alert(`Could not generate the corrected .docx file: ${e.message}`);
        }
    }
};