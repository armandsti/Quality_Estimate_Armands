
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TranslayLogo, HistoryIcon, UserIcon, ChatBubbleIcon, AnalyzeIcon } from './Icons';
import { Loader } from './Loader';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
    wordsUsed: number;
    onAnalyzeDocument: () => void;
    onShowHistory: () => void;
    onShowInProcess: () => void;
    isProcessing: boolean;
}

export const Header: React.FC<HeaderProps> = ({ wordsUsed, onAnalyzeDocument, onShowHistory, onShowInProcess, isProcessing }) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      console.log('🔍 DEBUG Header: Starting sign out process...');
      setIsUserMenuOpen(false); // Close dropdown
      
      console.log('🔍 DEBUG Header: Calling signOut()...');
      await signOut();
      console.log('🔍 DEBUG Header: Sign out successful, redirecting to login...');
      
      // Force redirect to login page after successful sign out
      console.log('🔍 DEBUG Header: Navigating to /auth...');
      navigate('/auth', { replace: true });
      
      // Force page reload to ensure clean state
      setTimeout(() => {
        console.log('🔍 DEBUG Header: Force reloading page...');
        window.location.href = '/auth';
      }, 100);
      
    } catch (error) {
      console.error('🔍 DEBUG Header: Sign out error:', error);
      // Even if there's an error, try to redirect
      navigate('/auth', { replace: true });
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <TranslayLogo />
            </div>
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
                <button className="px-4 py-1.5 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm">
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
             
             {/* User Menu */}
             <div className="relative">
               <button 
                 onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                 className="h-10 w-10 flex items-center justify-center rounded-full text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors"
               >
                 <UserIcon />
               </button>
               
               {/* Dropdown Menu */}
               {isUserMenuOpen && (
                 <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50" ref={userMenuRef}>
                   <div className="py-3">
                     <div className="px-4 py-3 border-b border-slate-100">
                       <div className="text-sm font-semibold text-slate-900">
                         {profile?.full_name || user?.email}
                       </div>
                       <div className="text-xs text-slate-500 mt-1">
                         {user?.email}
                       </div>
                     </div>
                     <button
                       onClick={handleSignOut}
                       className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-200 rounded-lg mx-2"
                     >
                       Sign Out
                     </button>
                   </div>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </header>
  );
};
