import React, { useEffect, useState } from 'react';
import { GitBranch, Cloud, RefreshCw, CheckCircle2, AlertCircle, Loader2, Clock } from 'lucide-react';

interface OKFStatus {
  last_export: {
    triggered_at: string;
    triggered_by: string;
    status: 'running' | 'success' | 'error';
    files_written: number;
    error?: string;
  } | null;
  gcs_bucket: string | null;
  github_repo_url: string | null;
  exporter_enabled: boolean;
}

interface OKFStatusCardProps {
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function OKFStatusCard({ triggerToast }: OKFStatusCardProps) {
  const [status, setStatus] = useState<OKFStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const fetchStatus = async () => {
    try {
      const r = await fetch('/api/v1/admin/okf/status');
      if (!r.ok) return; // not admin — hide card
      const d = await r.json();
      setStatus(d.data);
    } catch {
      // Not an admin — silently skip
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const r = await fetch('/api/v1/admin/okf/trigger', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) {
        triggerToast(d.error?.message || 'Export failed to start', 'error');
        return;
      }
      triggerToast('OKF export triggered — runs in background', 'success');
      setTimeout(fetchStatus, 2000);
    } catch {
      triggerToast('Failed to trigger export', 'error');
    } finally {
      setTriggering(false);
    }
  };

  if (loading || !status) return null;

  const lastExport = status.last_export;
  const statusIcon = () => {
    if (!lastExport) return <Clock className="h-5 w-5 text-slate-400" />;
    if (lastExport.status === 'running') return <Loader2 className="h-5 w-5 text-teal-500 animate-spin" />;
    if (lastExport.status === 'success') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    return <AlertCircle className="h-5 w-5 text-rose-500" />;
  };

  const statusLabel = () => {
    if (!lastExport) return 'Never exported';
    if (lastExport.status === 'running') return 'Export running…';
    if (lastExport.status === 'success') return `Exported ${new Date(lastExport.triggered_at).toLocaleString()}`;
    return `Failed: ${lastExport.error || 'unknown error'}`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-teal-600" />
          <h3 className="font-bold text-slate-900">OKF Digital Twin</h3>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">v0.1</span>
        </div>
        <button
          onClick={handleTrigger}
          disabled={triggering || lastExport?.status === 'running'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${triggering ? 'animate-spin' : ''}`} />
          {triggering ? 'Starting…' : 'Export Now'}
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-sm">
        {statusIcon()}
        <span className={`font-medium ${lastExport?.status === 'error' ? 'text-rose-600' : 'text-slate-700'}`}>
          {statusLabel()}
        </span>
        {lastExport?.status === 'success' && lastExport.files_written > 0 && (
          <span className="text-slate-400">({lastExport.files_written} files)</span>
        )}
      </div>

      {/* Destinations */}
      <div className="space-y-1.5">
        {status.gcs_bucket ? (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Cloud className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="font-mono truncate">gs://{status.gcs_bucket}/okf/</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Cloud className="h-3.5 w-3.5 flex-shrink-0" />
            <span>No GCS bucket configured (set <code className="bg-slate-100 px-1 rounded">GCS_BUCKET</code>)</span>
          </div>
        )}
        {status.github_repo_url ? (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <GitBranch className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="font-mono truncate">{status.github_repo_url}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <GitBranch className="h-3.5 w-3.5 flex-shrink-0" />
            <span>No Git repo configured (set <code className="bg-slate-100 px-1 rounded">GITHUB_REPO_URL</code>)</span>
          </div>
        )}
      </div>

      {!status.exporter_enabled && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Configure <code>GCS_BUCKET</code> or <code>GITHUB_REPO_URL</code> environment variables to enable automatic publishing.
        </p>
      )}
    </div>
  );
}
