import React, { useState, useEffect } from 'react';
import { 
  Key, Plus, Eye, EyeOff, RotateCcw, Trash2, Clipboard, AlertTriangle, 
  Check, CheckCircle2, Loader2, X, AlertCircle
} from 'lucide-react';

interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
  expires_at: string | null;
  is_active: boolean;
}

interface ApiKeysProps {
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ApiKeys({ triggerToast }: ApiKeysProps) {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Creation State
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [keyName, setKeyName] = useState<string>('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [customExpiryDate, setCustomExpiryDate] = useState<string>('');
  const [neverExpires, setNeverExpires] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Fresh Key display Modal
  const [generatedRawKey, setGeneratedRawKey] = useState<string | null>(null);
  const [hasCopiedChecked, setHasCopiedChecked] = useState<boolean>(false);
  const [hasStoredChecked, setHasStoredChecked] = useState<boolean>(false);
  const [hasSecureChecked, setHasSecureChecked] = useState<boolean>(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/api-keys');
      const data = await res.json();
      if (data.data) {
        setKeys(data.data);
      }
    } catch (err) {
      triggerToast('Unable to fetch active API integrations keys', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleScopeToggle = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(prev => prev.filter(s => s !== scope));
    } else {
      setSelectedScopes(prev => [...prev, scope]);
    }
  };

  const handleSelectAllScopes = () => {
    if (selectedScopes.length === allScopes.length) {
      setSelectedScopes([]);
    } else {
      setSelectedScopes(allScopes.map(s => s.id));
    }
  };

  const handleCreateKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return triggerToast('An operational prefix name is required', 'error');
    if (selectedScopes.length === 0) return triggerToast('Please select at least one permission scope', 'error');

    setSubmitting(true);
    const payload = {
      name: keyName,
      scopes: selectedScopes,
      expires_at: neverExpires || !customExpiryDate ? null : new Date(customExpiryDate).toISOString()
    };

    try {
      const res = await fetch('/api/v1/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setGeneratedRawKey(data.data.raw_key);
        setIsCreateOpen(false);
        // Reset creating variables
        setKeyName('');
        setSelectedScopes([]);
        setCustomExpiryDate('');
        setNeverExpires(true);
        fetchKeys();
        triggerToast('Credential key created successfully', 'success');
      } else {
        triggerToast(data.error?.message || 'Error occurred formulating key credentials', 'error');
      }
    } catch (err) {
      triggerToast('Unable to establish secure tunnel to system core', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRotateKey = async (id: string) => {
    const isRot = window.confirm('This will invalidate the current token key immediately. Outstanding REST integrations will yield 401 Unauthorized.');
    if (!isRot) return;

    try {
      const res = await fetch(`/api/v1/admin/api-keys/${id}/rotate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.data) {
        setGeneratedRawKey(data.data.raw_key);
        fetchKeys();
        triggerToast('API Integration Secret Rotated', 'success');
      } else {
        triggerToast(data.error?.message || 'Error occurred rotating API target secret', 'error');
      }
    } catch (err) {
      triggerToast('Secure rotate pipeline failed. Verify permissions', 'error');
    }
  };

  const handleRevokeKey = async (id: string) => {
    const isRev = window.confirm('Revoke this key? Any integrations using it will stop working immediately and permanently.');
    if (!isRev) return;

    try {
      const res = await fetch(`/api/v1/admin/api-keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchKeys();
        triggerToast('API Key revoked successfully', 'success');
      } else {
        triggerToast('Error occurred during revocation of access token', 'error');
      }
    } catch (err) {
      triggerToast('Secure revocation request failed', 'error');
    }
  };

  const handleCopyToClipboard = () => {
    if (generatedRawKey) {
      navigator.clipboard.writeText(generatedRawKey);
      triggerToast('Raw API Key Copied into clipboard buffer', 'success');
    }
  };

  const allScopes = [
    { id: 'orders:read', label: 'orders:read', desc: 'View customer orders and pick lists' },
    { id: 'orders:write', label: 'orders:write', desc: 'Create orders and pick lists' },
    { id: 'inventory:read', label: 'inventory:read', desc: 'View stock, batches, bin locations' },
    { id: 'inventory:write', label: 'inventory:write', desc: 'Receive goods, write-offs, adjustments' },
    { id: 'ledger:read', label: 'ledger:read', desc: 'Access stock ledger and event stream' },
    { id: 'reports:read', label: 'reports:read', desc: 'Access all reports' },
    { id: 'webhooks:manage', label: 'webhooks:manage', desc: 'Configure outbound webhooks' },
    { id: 'admin', label: 'admin', desc: 'Full administration access (combines all capabilities)' }
  ];

  const getKeyStatus = (k: ApiKeyInfo) => {
    if (!k.is_active) return 'inactive';
    if (k.expires_at && new Date(k.expires_at) < new Date()) return 'expired';
    return 'active';
  };

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Key className="h-6 w-6 text-teal-400" />
            <h2 className="text-xl font-bold tracking-tight">API Key Management</h2>
          </div>
          <p className="text-slate-400 text-xs mt-1 leading-normal">
            Manage access for external integrations. Each key has defined scopes controlling what it can access.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 bg-teal-500 hover:bg-teal-450 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition duration-150 cursor-pointer shadow-lg shadow-teal-500/10 min-h-[44px]"
        >
          <Plus className="h-4 w-4" />
          <span>Create API Key</span>
        </button>
      </div>

      {/* Keys Lists Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-405 flex flex-col items-center justify-center gap-2.5">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
            <span className="text-xs">Gathering secure key descriptors and audits logs...</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Key className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold leading-normal">No API access keys have been allocated yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto text-[11px] sm:text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-bold tracking-wider text-[10px]">
                  <th className="p-4">Key Name & Prefix</th>
                  <th className="p-4">Active Scopes</th>
                  <th className="p-4">Timestamps</th>
                  <th className="p-4">Last Usage</th>
                  <th className="p-4 text-center">Expires</th>
                  <th className="p-4">Badge Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {keys.map((k) => {
                  const status = getKeyStatus(k);
                  return (
                    <tr key={k.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{k.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          Prefix:{' '}
                          <span className="bg-slate-100 px-1 py-0.2 rounded-md border text-slate-705">
                            {k.prefix}_***
                          </span>
                        </div>
                      </td>
                      <td className="p-4 max-w-sm">
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((s) => (
                            <span
                              key={s}
                              className="bg-slate-100 border border-slate-200 text-slate-750 px-1.5 py-0.5 text-[9px] font-semibold rounded-md font-mono"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-[10px] text-slate-500">
                          Created:{' '}
                          <span className="font-semibold text-slate-700">
                            {new Date(k.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-750">
                          {k.last_used_at ? (
                            <>
                              <div className="font-semibold">{new Date(k.last_used_at).toLocaleDateString()}</div>
                              <div className="text-[9px] text-slate-400 font-medium">Qty: {k.usage_count} entries</div>
                            </>
                          ) : (
                            <span className="text-slate-400 italic">Never used</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center font-medium font-mono text-[11px] text-slate-600">
                        {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="p-4">
                        {status === 'active' && (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase tracking-wider">
                            Active
                          </span>
                        )}
                        {status === 'inactive' && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-650 px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase tracking-wider">
                            Inactive
                          </span>
                        )}
                        {status === 'expired' && (
                          <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase tracking-wider">
                            Expired
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2 text-slate-400">
                          <button
                            onClick={() => handleRotateKey(k.id)}
                            className="p-1 px-2.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-bold flex items-center gap-1 transition text-[11px] min-h-[36px] cursor-pointer"
                            title="Rotate Key"
                          >
                            <RotateCcw className="h-3 w-3 shrink-0" />
                            <span>Rotate</span>
                          </button>
                          <button
                            onClick={() => handleRevokeKey(k.id)}
                            className="p-1 px-2.5 border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-rose-750 hover:text-rose-900 rounded-lg font-bold flex items-center gap-1 transition text-[11px] min-h-[36px] cursor-pointer"
                            title="Revoke Key"
                          >
                            <Trash2 className="h-3 w-3 shrink-0" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation Modal Form */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateKeySubmit}
            className="bg-white rounded-2xl w-full max-w-xl shadow-2xl p-6 md:p-8 space-y-5 text-slate-800 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-teal-650" />
                <h3 className="font-bold text-slate-900 leading-none">Register New Integration Key</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-450 hover:bg-slate-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-black tracking-wider text-slate-450 mb-1.5">
                  Integration Identifier Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WooCommerce Integration, Android Field Scanner"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full bg-white border border-slate-250 rounded-xl px-3.5 py-2.5 shadow-2xs"
                />
              </div>

              {/* Scopes Selection list checkboxes with details */}
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border">
                  <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">
                    Scopes Permissions *
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllScopes}
                    className="text-[10px] font-bold text-teal-650 cursor-pointer"
                  >
                    {selectedScopes.length === allScopes.length ? 'Clear selection' : 'Select all permission'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
                  {allScopes.map((scope) => {
                    const active = selectedScopes.includes(scope.id);
                    return (
                      <label
                        key={scope.id}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer leading-tight transition ${
                          active
                            ? 'bg-teal-50/15 border-teal-300 text-teal-950'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => handleScopeToggle(scope.id)}
                          className="mt-0.5 rounded-md text-teal-600 focus:ring-0 cursor-pointer h-4 w-4 shrink-0"
                        />
                        <div>
                          <span className="font-mono font-bold text-[10px] block text-slate-900">{scope.label}</span>
                          <span className="text-[10px] text-slate-450 block mt-0.5 leading-relaxed">{scope.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Expiry inputs */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={neverExpires}
                    onChange={(e) => setNeverExpires(e.target.checked)}
                    className="rounded-md border-slate-305 text-teal-600 focus:ring-0 cursor-pointer h-4 w-4"
                  />
                  <span>This key never expires</span>
                </label>

                {!neverExpires && (
                  <div className="animate-slideUp">
                    <label className="block text-[9px] uppercase font-bold text-slate-455 mb-1">
                      Expiration Date
                    </label>
                    <input
                      type="date"
                      required
                      value={customExpiryDate}
                      onChange={(e) => setCustomExpiryDate(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-150">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-teal-500 hover:bg-teal-450 text-slate-950 font-bold rounded-xl text-xs min-h-[44px] disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Generating secret...' : 'Generate New Key'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fresh Generated raw API Key show off modal ONLY */}
      {generatedRawKey && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-lg p-6 md:p-8 space-y-6">
            
            <div className="text-center space-y-2">
              <div className="mx-auto h-12 w-12 bg-teal-500/10 text-teal-400 rounded-full flex items-center justify-center">
                <Key className="h-6 w-6" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-white">Your new API key</h3>
              <p className="text-slate-400 text-xs">
                Copy this secure credential. You won't be able to retrieve it again.
              </p>
            </div>

            {/* Monospaced Key Banner */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono select-all">
              <span className="text-teal-400 font-black tracking-wide break-all mr-4">
                {generatedRawKey}
              </span>
              <button
                type="button"
                onClick={handleCopyToClipboard}
                className="p-1 px-3 bg-slate-905 hover:bg-slate-850 text-slate-300 rounded-lg flex items-center gap-1 font-bold border border-slate-800 transition min-h-[36px] cursor-pointer"
              >
                <Clipboard className="h-3.5 w-3.5 shrink-0" />
                <span>Copy</span>
              </button>
            </div>

            {/* Warning Banner */}
            <div className="p-3 bg-rose-950/20 border border-rose-900 rounded-lg text-rose-350 flex gap-2.5 items-start text-xs">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="leading-relaxed">
                <span className="font-bold">This key will not be shown again.</span> Copy it now and store it securely.
              </div>
            </div>

            {/* Mandatory Checkboxes Checklist */}
            <div className="space-y-2.5 border-t border-slate-800 pt-4 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCopiedChecked}
                  onChange={(e) => setHasCopiedChecked(e.target.checked)}
                  className="mt-0.5 rounded-md text-teal-600 focus:ring-0 cursor-pointer h-4 w-4 shrink-0"
                />
                <span className="text-slate-350 leading-tight">
                  I have copied the raw key credential token successfully
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasStoredChecked}
                  onChange={(e) => setHasStoredChecked(e.target.checked)}
                  className="mt-0.5 rounded-md text-teal-600 focus:ring-0 cursor-pointer h-4 w-4 shrink-0"
                />
                <span className="text-slate-350 leading-tight">
                  I will store it securely in my integration's environment variables
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSecureChecked}
                  onChange={(e) => setHasSecureChecked(e.target.checked)}
                  className="mt-0.5 rounded-md text-teal-600 focus:ring-0 cursor-pointer h-4 w-4 shrink-0"
                />
                <span className="text-slate-350 leading-tight">
                  I understand that I must never commit it into public source code repositories
                </span>
              </label>
            </div>

            {/* Finish action */}
            <button
              onClick={() => setGeneratedRawKey(null)}
              disabled={!hasCopiedChecked || !hasStoredChecked || !hasSecureChecked}
              className="w-full py-3 bg-teal-500 hover:bg-teal-450 disabled:opacity-30 disabled:hover:bg-teal-500 text-slate-950 font-black rounded-xl text-xs transition duration-150 min-h-[44px] cursor-pointer shadow-lg shadow-teal-500/5"
            >
              I've copied the key, close this
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
