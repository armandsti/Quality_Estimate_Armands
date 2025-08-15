
import React from 'react';
import { FileUpload } from './FileUpload';
import { Loader } from './Loader';
import { AnalyzeIcon, DocumentTextIcon, LinkIcon, SparklesIcon } from './Icons';

interface UploadPageProps {
  onFileChange: (setter: React.Dispatch<React.SetStateAction<File | null>>, textSetter: React.Dispatch<React.SetStateAction<string>>, role: 'source' | 'target' | 'glossary' | 'reference') => (file: File | null) => Promise<void>;
  sourceFile: File | null;
  targetFile: File | null;
  glossaryFile: File | null;
  referenceFile: File | null;
  setSourceFile: React.Dispatch<React.SetStateAction<File | null>>;
  setSourceText: React.Dispatch<React.SetStateAction<string>>;
  setTargetFile: React.Dispatch<React.SetStateAction<File | null>>;
  setTargetText: React.Dispatch<React.SetStateAction<string>>;
  setGlossaryFile: React.Dispatch<React.SetStateAction<File | null>>;
  setGlossaryText: React.Dispatch<React.SetStateAction<string>>;
  setReferenceFile: React.Dispatch<React.SetStateAction<File | null>>;
  referenceText: string;
  setReferenceText: React.Dispatch<React.SetStateAction<string>>;
  websiteText: string;
  setWebsiteText: React.Dispatch<React.SetStateAction<string>>;
  onAnalyze: () => void;
  canAnalyze: boolean;
  isLoading: boolean;
  apiError: string | null;
  sourceWordCount: number;
  totalAnalyzedWords: number;
  onResetTotalWords: () => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({
  onFileChange,
  sourceFile,
  targetFile,
  glossaryFile,
  referenceFile,
  setSourceFile,
  setSourceText,
  setTargetFile,
  setTargetText,
  setGlossaryFile,
  setGlossaryText,
  setReferenceFile,
  referenceText,
  setReferenceText,
  websiteText,
  setWebsiteText,
  onAnalyze,
  canAnalyze,
  isLoading,
  apiError,
  sourceWordCount,
  totalAnalyzedWords,
  onResetTotalWords,
}) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 pb-6 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-700 flex items-center gap-2 flex-shrink-0">
          <SparklesIcon />
          1. Provide Content for Analysis
        </h2>
        <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 w-full sm:w-auto sm:min-w-[280px]">
            <h3 className="text-base font-semibold text-slate-600 mb-2">Word Count</h3>
            <div className="space-y-1 text-sm">
                <div className="flex justify-between items-center gap-4">
                    <span className="text-slate-500">Current source:</span>
                    <span className="font-medium text-slate-800" aria-live="polite">{sourceWordCount.toLocaleString()} words</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                    <span className="text-slate-500">Session total:</span>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-indigo-600" aria-live="polite">{totalAnalyzedWords.toLocaleString()} words</span>
                        <button
                            onClick={onResetTotalWords}
                            title="Reset session word count"
                            className="text-xs text-slate-500 hover:text-red-600 hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
                            disabled={totalAnalyzedWords === 0}
                        >
                            (reset)
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FileUpload label="Source Document" required file={sourceFile} onFileChange={onFileChange(setSourceFile, setSourceText, 'source')} />
            <FileUpload label="Target Document" required file={targetFile} onFileChange={onFileChange(setTargetFile, setTargetText, 'target')} />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-600 mb-3">Optional References</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: File Uploads */}
                <div className="space-y-4">
                    <FileUpload 
                        label="Glossary File" 
                        file={glossaryFile} 
                        onFileChange={onFileChange(setGlossaryFile, setGlossaryText, 'glossary')} 
                        compact
                    />
                    <FileUpload 
                        label="Previous Translations File" 
                        file={referenceFile} 
                        onFileChange={onFileChange(setReferenceFile, setReferenceText, 'reference')} 
                        compact
                    />
                </div>
                {/* Right Column: Text Inputs */}
                <div className="space-y-4">
                     <div className="relative h-full flex flex-col">
                        <label htmlFor="website-text" className="block text-sm font-medium text-slate-600 mb-1">Reference Websites (URLs)</label>
                        <div className="absolute top-8 left-3 text-slate-400"><LinkIcon /></div>
                        <textarea
                          id="website-text"
                          value={websiteText}
                          onChange={(e) => setWebsiteText(e.target.value)}
                          placeholder="Paste URLs (one per line) for style and terminology reference..."
                          className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition flex-grow"
                          rows={2}
                        />
                      </div>
                </div>
            </div>
          </div>


          <div className="pt-4">
            <button
              onClick={onAnalyze}
              disabled={!canAnalyze}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <Loader /> : <AnalyzeIcon />}
              {isLoading ? 'Analyzing...' : 'Run QA Analysis'}
            </button>
            {apiError && <p className="text-red-600 mt-4 text-center">{apiError}</p>}
          </div>
        </div>
        
        {/* Placeholder/Info Section */}
        <div className="hidden lg:flex flex-col items-center justify-center h-full bg-slate-100/50 rounded-2xl border-2 border-dashed border-slate-300 p-8">
            <div className="text-center">
                <div className="mx-auto h-16 w-16 text-indigo-400">
                    <DocumentTextIcon />
                </div>
                <h3 className="mt-4 text-xl font-bold text-slate-800">Your QA Report is moments away</h3>
                <p className="mt-2 text-slate-500">
                  1. Upload your source and target documents.
                </p>
                 <p className="text-slate-500">
                  (Or a single bilingual XLIFF/TMX/SDLXLIFF file in the source slot).
                </p>
                <p className="mt-1 text-slate-500">
                  2. (Optional) Provide a glossary or other references.
                </p>
                <p className="mt-1 text-slate-500">
                  3. Click "Run QA Analysis" to start the process.
                </p>
                 <p className="mt-4 text-sm text-slate-400 italic">
                  The analysis results will be displayed on the next page.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};