
import React, { useState, useMemo } from 'react';
import { ResultsList } from './ResultsTable';
import { Loader } from './Loader';
import { ExcelIcon, DocxIcon, ShareIcon, QAIssuesIcon, ChevronDownIcon, AcceptIcon, RejectIcon } from './Icons';
import { QAError, Severity } from '../types';
import { ShareModal } from './ShareModal';

interface ResultsPageProps {
  allErrors: QAError[];
  errors: QAError[];
  isLoading: boolean;
  apiError: string | null;
  onBack: () => void;
  severityFilter: Severity[];
  onToggleSeverityFilter: (severity: Severity) => void;
  onExportExcel: () => void;
  onApplyCorrection: (errorId: number) => void;
  onRejectCorrection: (errorId: number) => void;
  onSuggestionEdit: (errorId: number, newSuggestion: string) => void;
  onRevertCorrection: (errorId: number) => void;
  onDownloadCorrected: () => void;
  sourceFile: File | null;
  targetFile: File | null;
  categoryFilter: string;
  onCategoryFilterChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  uniqueCategories: string[];
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  allErrors,
  errors,
  isLoading,
  apiError,
  onBack,
  severityFilter,
  onToggleSeverityFilter,
  onExportExcel,
  onApplyCorrection,
  onRejectCorrection,
  onSuggestionEdit,
  onRevertCorrection,
  onDownloadCorrected,
  sourceFile,
  targetFile,
  categoryFilter,
  onCategoryFilterChange,
  uniqueCategories
}) => {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  const stats = useMemo(() => {
    const totalIssues = allErrors.length;
    if (totalIssues === 0) {
      return { totalIssues, confirmedCount: 0, rejectedCount: 0, progressPercentage: 0 };
    }
    const confirmedCount = allErrors.filter(e => e.resolved).length;
    const rejectedCount = allErrors.filter(e => e.rejected).length;
    const processedCount = confirmedCount + rejectedCount;
    const progressPercentage = Math.round((processedCount / totalIssues) * 100);
    return { totalIssues, confirmedCount, rejectedCount, progressPercentage };
  }, [allErrors]);
  
  const severityCounts = useMemo(() => {
    return allErrors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<Severity, number>);
  }, [allErrors]);

  const canDownloadCorrected = (
      targetFile?.name.toLowerCase().endsWith('.docx') ||
      (sourceFile && ['.xliff', '.xlf', '.sdlxliff', '.tmx'].some(ext => sourceFile.name.toLowerCase().endsWith(ext)))
  );

  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 rounded-b-xl">
                <Loader />
                <p className="mt-4 text-slate-600 font-semibold">AI is reviewing the documents...</p>
                <p className="text-sm text-slate-500">This may take a moment for large files.</p>
            </div>
        );
    }

    if (apiError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] bg-red-50 rounded-b-xl border-t border-red-200 text-red-700">
                <h3 className="text-lg font-medium">Analysis Failed</h3>
                <p className="mt-1 max-w-md text-center text-sm">{apiError}</p>
            </div>
        );
    }
    
    if (stats.totalIssues === 0) {
        return (
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
        )
    }

    return (
        <div className="p-6 bg-slate-50/50 rounded-b-xl">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                  <div className="relative">
                      <label htmlFor="category-filter" className="text-sm font-medium text-slate-600 mr-2">Category:</label>
                      <select id="category-filter" value={categoryFilter} onChange={onCategoryFilterChange} className="appearance-none bg-white border border-slate-300 rounded-md py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <ChevronDownIcon />
                  </div>
                  <div className="relative">
                      <label htmlFor="severity-filter" className="text-sm font-medium text-slate-600 mr-2">Severity:</label>
                      {/* This could also be a multi-select dropdown, for now using buttons */}
                       {(['Critical', 'Major', 'Minor'] as Severity[]).map(s => (
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
            <ResultsList errors={errors} onApplyCorrection={onApplyCorrection} onRejectCorrection={onRejectCorrection} onSuggestionEdit={onSuggestionEdit} onRevertCorrection={onRevertCorrection} />
        </div>
    );

  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-3 border-b border-slate-200 flex justify-between items-center">
             <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <QAIssuesIcon />
                <span>QA Analysis ({stats.totalIssues} issues)</span>
             </h2>
             <div className="flex items-center gap-2">
                <button onClick={() => setIsShareModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg text-white bg-slate-600 hover:bg-slate-700 transition-colors">
                    <ShareIcon /> Share
                </button>
                <button onClick={onExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700 transition-colors">
                    <ExcelIcon /> Report (.xlsx)
                </button>
                {canDownloadCorrected && (
                    <button onClick={onDownloadCorrected} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                        <DocxIcon /> Corrected file
                    </button>
                )}
                <button onClick={onBack} className="px-3 py-1.5 text-sm font-semibold rounded-lg text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors">
                    Start New
                </button>
             </div>
        </div>
        
        {(sourceFile || targetFile) && (
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-sm text-slate-600 flex items-center gap-x-6 gap-y-2 flex-wrap">
                {sourceFile && (
                    <div className="flex items-center gap-2">
                        <strong className="font-semibold text-slate-800">Source File:</strong>
                        <span>{sourceFile.name}</span>
                    </div>
                )}
                {targetFile && (
                    <div className="flex items-center gap-2">
                        <strong className="font-semibold text-slate-800">Target File:</strong>
                        <span>{targetFile.name}</span>
                    </div>
                )}
            </div>
        )}

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
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5 text-green-700">
                        <AcceptIcon className="h-5 w-5"/>
                        <span className="font-semibold">{stats.confirmedCount} Accepted</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-red-700">
                        <RejectIcon className="h-5 w-5"/>
                        <span className="font-semibold">{stats.rejectedCount} Rejected</span>
                    </div>
                    <div className="text-slate-500">
                        <span className="font-semibold text-slate-700">{stats.totalIssues}</span> Total Issues
                    </div>
                </div>
            </div>
          </div>
        )}

        {renderContent()}
        
        <ShareModal 
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            errors={allErrors}
        />
    </div>
  );
};
