
import React, { useState } from 'react';
import { HistoryEntry, Severity } from '../types';
import { HistoryIcon, DocumentIcon, CalendarIcon, AnalyzeIcon, ShareIcon, TrashIcon } from './Icons';
import { ShareModal } from './ShareModal';

interface HistoryPageProps {
  history: HistoryEntry[];
  onViewReport: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
  onDeleteEntry: (entryId: string) => void;
  onStartNew: () => void;
  hasActiveReport: boolean;
  onReturnToResults: () => void;
}

const SeverityPill: React.FC<{ label: string, count: number, color: string }> = ({ label, count, color }) => {
    if (count === 0) return null;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
            {count} {label}
        </span>
    );
};

export const HistoryPage: React.FC<HistoryPageProps> = ({ history, onViewReport, onClearHistory, onDeleteEntry, onStartNew, hasActiveReport, onReturnToResults }) => {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedEntryForSharing, setSelectedEntryForSharing] = useState<HistoryEntry | null>(null);

  const handleOpenShareModal = (entry: HistoryEntry) => {
    setSelectedEntryForSharing(entry);
    setIsShareModalOpen(true);
  };

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
    setSelectedEntryForSharing(null);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 pb-6 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-700 flex items-center gap-2">
          <HistoryIcon />
          Analysis History
        </h2>
        <button
          onClick={onClearHistory}
          disabled={history.length === 0}
          className="px-4 py-2 text-sm font-semibold rounded-lg text-red-600 border border-red-300 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear All History
        </button>
      </div>

      {hasActiveReport && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-indigo-600"><AnalyzeIcon /></div>
            <div>
              <p className="font-semibold text-indigo-800">You have a report open.</p>
              <p className="text-sm text-indigo-700">You can return to your current analysis results.</p>
            </div>
          </div>
          <button onClick={onReturnToResults} className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 flex-shrink-0">
            Return to Report
          </button>
        </div>
      )}

      {history.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto h-16 w-16 text-slate-400">
            <DocumentIcon />
          </div>
          <h3 className="mt-4 text-xl font-bold text-slate-800">No History Found</h3>
          <p className="mt-2 text-slate-500">
            Your past analysis reports will appear here once you've run a QA check.
          </p>
          <button
            onClick={onStartNew}
            className="mt-6 flex items-center justify-center gap-2 mx-auto px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <AnalyzeIcon />
            Start a New Analysis
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map(entry => {
            const total = entry.errorCount;
            const confirmed = entry.confirmedCount || 0;
            const rejected = entry.rejectedCount || 0;
            const processed = confirmed + rejected;
            const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
            
            return (
              <div key={entry.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-grow space-y-3">
                        <div className="flex items-center text-sm text-slate-500 gap-3">
                            <div className="flex items-center gap-1.5">
                                <CalendarIcon />
                                <span>{new Date(entry.date).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="font-semibold text-slate-800 space-y-1">
                            <div className="flex items-center gap-2">
                                <DocumentIcon />
                                <span>{entry.sourceFileName}</span>
                            </div>
                            {entry.targetFileName && (
                                <div className="flex items-center gap-2">
                                    <DocumentIcon />
                                    <span>{entry.targetFileName}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-600">{entry.errorCount} Issues:</span>
                        <SeverityPill label="Critical" count={entry.severityCounts.Critical} color="bg-red-100 text-red-800"/>
                        <SeverityPill label="Major" count={entry.severityCounts.Major} color="bg-orange-100 text-orange-800"/>
                        <SeverityPill label="Minor" count={entry.severityCounts.Minor} color="bg-yellow-100 text-yellow-800"/>
                        </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-stretch gap-2">
                        <button
                            onClick={() => onViewReport(entry)}
                            className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                        >
                            View Report
                        </button>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleOpenShareModal(entry)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors"
                            >
                                <ShareIcon /> Share
                            </button>
                            <button
                                onClick={() => onDeleteEntry(entry.id)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-red-600 bg-red-100 hover:bg-red-200 transition-colors"
                                title="Delete this report"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    </div>
                  </div>

                  {entry.errorCount > 0 && (
                     <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-4 text-xs">
                        <div className="flex-grow flex items-center gap-2">
                            <span className="font-semibold text-slate-600">Progress:</span>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                            </div>
                            <span className="font-bold text-slate-700 w-10 text-right">{progress}%</span>
                        </div>
                        <div className="flex-shrink-0 flex gap-4">
                            <span className="font-semibold text-green-600">Accepted: {confirmed}</span>
                            <span className="font-semibold text-red-600">Rejected: {rejected}</span>
                        </div>
                    </div>
                  )}

              </div>
            )
          })}
        </div>
      )}

      {selectedEntryForSharing && (
        <ShareModal 
            isOpen={isShareModalOpen}
            onClose={handleCloseShareModal}
            errors={selectedEntryForSharing.errors}
        />
      )}
    </div>
  );
};
