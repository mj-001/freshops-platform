import React, { useState } from 'react';
import { User, Warehouse, TillSession } from '../types';
import POSHome from './POSHome';
import POSTill from './POSTill';
import POSSessionSummary from './POSSessionSummary';
import POSReports from './POSReports';
import { Store, TrendingUp, ListOrdered } from 'lucide-react';

type POSView = 'home' | 'till' | 'session' | 'reports';

interface POSProps {
  currentUser: User;
  warehouses: Warehouse[];
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function POS({ currentUser, warehouses, triggerToast }: POSProps) {
  const [view, setView] = useState<POSView>('home');
  const [activeSession, setActiveSession] = useState<TillSession | null>(null);
  const [viewSessionId, setViewSessionId] = useState<string | null>(null);

  const handleGoToTill = (session: TillSession) => {
    setActiveSession(session);
    setView('till');
  };

  const handleViewSession = (sessionId: string) => {
    setViewSessionId(sessionId);
    setView('session');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-nav */}
      {view !== 'till' && (
        <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200 flex-shrink-0">
          <button
            onClick={() => setView('home')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${view === 'home' ? 'bg-teal-50 text-teal-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Store className="h-4 w-4" /> Till Sessions
          </button>
          <button
            onClick={() => setView('reports')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${view === 'reports' ? 'bg-teal-50 text-teal-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <TrendingUp className="h-4 w-4" /> Reports
          </button>
          {view === 'session' && viewSessionId && (
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-teal-50 text-teal-700 font-bold cursor-pointer"
            >
              <ListOrdered className="h-4 w-4" /> Session {viewSessionId}
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {view === 'home' && (
          <POSHome
            currentUser={currentUser}
            warehouses={warehouses}
            triggerToast={triggerToast}
            onGoToTill={handleGoToTill}
          />
        )}
        {view === 'till' && activeSession && (
          <POSTill
            currentUser={currentUser}
            session={activeSession}
            triggerToast={triggerToast}
            onBack={() => setView('home')}
          />
        )}
        {view === 'session' && viewSessionId && (
          <POSSessionSummary
            currentUser={currentUser}
            sessionId={viewSessionId}
            triggerToast={triggerToast}
            onBack={() => setView('home')}
          />
        )}
        {view === 'reports' && (
          <POSReports
            currentUser={currentUser}
            warehouses={warehouses}
            triggerToast={triggerToast}
          />
        )}
      </div>
    </div>
  );
}
