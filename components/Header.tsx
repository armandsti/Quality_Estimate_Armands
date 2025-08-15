
import React from 'react';
import { TranslayLogo, HistoryIcon, UserIcon, ChatBubbleIcon, AnalyzeIcon } from './Icons';
import { Loader } from './Loader';

interface HeaderProps {
    wordsUsed: number;
    onAnalyzeDocument: () => void;
    onShowHistory: () => void;
    onShowInProcess: () => void;
    isProcessing: boolean;
}


export const Header: React.FC<HeaderProps> = ({ wordsUsed, onAnalyzeDocument, onShowHistory, onShowInProcess, isProcessing }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <TranslayLogo />
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Translay
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
             <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2">
                    <div className="text-slate-500"><ChatBubbleIcon /></div>
                    <div>
                        <div className="text-xs text-slate-500">Words Used</div>
                        <div className="text-sm font-bold text-slate-800">{wordsUsed.toLocaleString()} / 5,000</div>
                    </div>
                </div>
                <button className="px-4 py-1.5 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                    Upgrade
                </button>
             </div>
             <button onClick={onAnalyzeDocument} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 transition-colors">
                <AnalyzeIcon />
                New Analysis
             </button>
            {isProcessing && (
                <button
                    onClick={onShowInProcess}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-400 transition-colors animate-pulse"
                    aria-live="polite"
                >
                    <Loader />
                    In Process
                </button>
             )}
             <button onClick={onShowHistory} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 transition-colors">
                <HistoryIcon />
                History
             </button>
             <button className="h-10 w-10 flex items-center justify-center rounded-full text-slate-600 bg-slate-200 hover:bg-slate-300">
                <UserIcon />
             </button>
          </div>
        </div>
      </div>
    </header>
  );
};
