import React, { useState, useEffect } from 'react';
import { 
  Wifi, WifiOff, RefreshCw, Layers, CheckCircle2, 
  Trash2, AlertCircle, Ban, Play, ChevronDown, ChevronUp, Database
} from 'lucide-react';
import { 
  getQueue, isSimulatedOffline, setSimulatedOffline, 
  syncOfflineQueue, subscribeToQueue, clearQueue, OfflineAction 
} from '../utils/offlineQueue';

interface OfflineSyncHubProps {
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  triggerRefresh?: () => void;
}

export default function OfflineSyncHub({ triggerToast, triggerRefresh }: OfflineSyncHubProps) {
  const [queue, setQueue] = useState<OfflineAction[]>([]);
  const [offlineMode, setOfflineMode] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    // Subscribe to state changes of the queue
    const unsubscribe = subscribeToQueue((updatedQueue, isOffline) => {
      setQueue(updatedQueue);
      setOfflineMode(isOffline);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const toggleOfflineMode = () => {
    const nextVal = !offlineMode;
    setSimulatedOffline(nextVal);
    
    if (nextVal) {
      triggerToast('Simulated Offline Mode Activated: active user actions will be stored local storage queue.', 'info');
    } else {
      triggerToast('Simulated Offline Mode Deactivated: attempt automatic synchronization.', 'info');
      // Trigger auto-sync immediately when connection is restored
      triggerImmediateSync();
    }
  };

  const triggerImmediateSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    triggerToast('Synchronizing offline transaction logs with master ledger...', 'info');
    
    try {
      const result = await syncOfflineQueue(triggerToast);
      if (result.successCount > 0) {
        triggerToast(`Successfully synchronized ${result.successCount} offline operations!`, 'success');
        if (triggerRefresh) triggerRefresh();
      } else if (result.failureCount > 0) {
        triggerToast(`Intermittent connectivity remains. ${result.failureCount} operations pending retry.`, 'error');
      } else {
        triggerToast('No offline actions pending synchronization.', 'info');
      }
    } catch (err) {
      triggerToast('Synchronization failed', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearQueue = () => {
    if (window.confirm('Are you sure you want to clear all queued operations? This might lead to data loss.')) {
      clearQueue();
      triggerToast('Offline queue cleared successfully.', 'info');
    }
  };

  const pendingCount = queue.filter(a => a.status === 'pending').length;
  const failedCount = queue.filter(a => a.status === 'failed').length;
  const syncingCount = queue.filter(a => a.status === 'syncing').length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
      {/* Header bar component */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition select-none"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${offlineMode ? 'bg-red-50 text-red-650 border-red-200' : 'bg-emerald-50 text-emerald-650 border-emerald-200'}`}>
            {offlineMode ? <WifiOff className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Intermittent Network Resiliency Hub</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${offlineMode ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {offlineMode ? 'Simulating Offline' : 'Online System Connected'}
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              {queue.length > 0 
                ? `${queue.length} operation(s) cached in browser LocalStorage queue.` 
                : 'All stock write-offs and cycle counts synchronized with WMS.'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {/* Simulated Offline Toggle */}
          <button
            onClick={toggleOfflineMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer min-h-[36px] ${
              offlineMode 
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-xs' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-200'
            }`}
          >
            {offlineMode ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
            <span>{offlineMode ? 'Go Online' : 'Simulate Offline Drop'}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }} 
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 text-slate-600 cursor-pointer"
          >
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded operations queue view list */}
      {isOpen && (
        <div className="border-t border-slate-100 p-4 sm:p-5 bg-slate-50/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3.5">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Database className="h-3.5 w-3.5 text-slate-400" />
                Queue: <strong>{queue.length}</strong> transactions
              </span>
              {pendingCount > 0 && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  {pendingCount} Pending
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-[10px] font-bold text-red-650 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                  {failedCount} Retry Failures
                </span>
              )}
              {syncingCount > 0 && (
                <span className="text-[10px] font-bold text-teal-605 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <RefreshCw className="h-2.5 w-2.5 animate-spin text-teal-500" />
                  Syncing...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {queue.length > 0 && (
                <button
                  onClick={handleClearQueue}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-red-650 text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer min-h-[36px]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Queue</span>
                </button>
              )}

              <button
                onClick={triggerImmediateSync}
                disabled={isSyncing || offlineMode}
                className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-450 disabled:bg-slate-200 text-slate-950 disabled:text-slate-400 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed shadow-sm min-h-[36px]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Process sync queue now</span>
              </button>
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="bg-white border border-slate-250 p-8 rounded-xl text-center shadow-2xs">
              <CheckCircle2 className="h-8 w-8 text-emerald-450 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-slate-705">Transaction Logs Synced Satisfactorily</h4>
              <p className="text-slate-400 text-[11px] mt-1 max-w-sm mx-auto leading-normal">
                There are no user actions queued in your browser storage. Go ahead and drop the network simulation to perform offline transactions.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[250px] overflow-y-auto divide-y divide-slate-100">
              {queue.map((action) => (
                <div key={action.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50/50 transition">
                  <div className="space-y-1 pr-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-slate-505 px-1.5 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                        {action.id}
                      </span>
                      <span className="font-bold text-slate-850 truncate">{action.description}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span>Endpoint: <strong className="font-mono text-slate-500">{action.endpoint}</strong></span>
                      <span>•</span>
                      <span>Method: <strong className="font-mono text-slate-500">{action.method}</strong></span>
                      <span>•</span>
                      <span>Retries: <strong className="text-slate-650">{action.retryCount}</strong></span>
                    </div>
                    {action.error && (
                      <div className="text-[10px] text-red-655 bg-red-50/50 border border-red-100 px-2 py-1 rounded-lg flex items-center gap-1 mt-1 max-w-lg">
                        <AlertCircle className="h-3 w-3 shrink-0 text-red-400" />
                        <span className="truncate">Last error: {action.error}</span>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    {action.status === 'syncing' ? (
                      <span className="text-[10px] font-bold text-teal-650 flex items-center gap-1 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                        <RefreshCw className="h-3 w-3 animate-spin text-teal-500" />
                        <span>Syncing</span>
                      </span>
                    ) : action.status === 'failed' ? (
                      <span className="text-[10px] font-bold text-red-650 bg-red-50 px-2.5 py-1 rounded-full border border-red-200 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        <span>Failed retry</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                        <span>Queued offline</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
