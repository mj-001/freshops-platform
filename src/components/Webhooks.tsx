import React, { useState, useEffect } from 'react';
import { 
  Radio, Plus, X, Globe, MessageSquare, ShieldAlert, CheckCircle2, AlertCircle, 
  ChevronDown, ChevronUp, Play, Trash2, Loader2, Sparkles, AlertTriangle
} from 'lucide-react';

interface WebhookDelivery {
  id: string;
  timestamp: string;
  event: string;
  status: 'success' | 'failed';
  http_code: number;
  response_time_ms: number;
}

interface WebhookInfo {
  id: string;
  name: string;
  channel: 'slack' | 'teams' | 'google_chat' | 'custom';
  url: string;
  events: string[];
  is_active: boolean;
  deliveries?: WebhookDelivery[];
}

interface WebhooksProps {
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function Webhooks({ triggerToast }: WebhooksProps) {
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [channel, setChannel] = useState<'slack' | 'teams' | 'google_chat' | 'custom'>('custom');
  const [url, setUrl] = useState<string>('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);

  // Testing states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/notification-webhooks');
      const data = await res.json();
      if (data.data) {
        setWebhooks(data.data);
      }
    } catch (err) {
      triggerToast('Unable to fetch webhook endpoints', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (hook: WebhookInfo) => {
    try {
      const res = await fetch(`/api/v1/notification-webhooks/${hook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !hook.is_active })
      });
      if (res.ok) {
        setWebhooks(prev => prev.map(w => w.id === hook.id ? { ...w, is_active: !w.is_active } : w));
        triggerToast(`Webhook state toggled to ${!hook.is_active ? 'active' : 'inactive'}`, 'success');
      }
    } catch (err) {
      triggerToast('Failed to patch webhook state', 'error');
    }
  };

  const handleDeleteWebhook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const conf = window.confirm('Permanently delete this webhook registration?');
    if (!conf) return;

    try {
      const res = await fetch(`/api/v1/notification-webhooks/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setWebhooks(prev => prev.filter(w => w.id !== id));
        triggerToast('Webhook deleted successfully', 'success');
      }
    } catch (err) {
      triggerToast('Failed to delete webhook subscription', 'error');
    }
  };

  const handleEventToggle = (evt: string) => {
    if (selectedEvents.includes(evt)) {
      setSelectedEvents(prev => prev.filter(x => x !== evt));
    } else {
      setSelectedEvents(prev => [...prev, evt]);
    }
  };

  const handleGroupSelect = (evts: string[]) => {
    const allSelected = evts.every(e => selectedEvents.includes(e));
    if (allSelected) {
      setSelectedEvents(prev => prev.filter(e => !evts.includes(e)));
    } else {
      setSelectedEvents(prev => {
        const added = evts.filter(e => !prev.includes(e));
        return [...prev, ...added];
      });
    }
  };

  const handleSendTestEvent = async (hookId?: string) => {
    const targetId = hookId || 'form-test';
    setTestingId(targetId);
    setTestResult(null);

    const targetUrl = hookId ? webhooks.find(w => w.id === hookId)?.url : url;
    if (!targetUrl) {
      setTestingId(null);
      return triggerToast('URL is required to send test trigger', 'error');
    }

    try {
      const res = await fetch('/api/v1/notification-webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, channel: hookId ? undefined : channel })
      });
      const data = await res.json();
      if (res.ok && data.data?.success) {
        setTestResult({ success: true, msg: 'Test delivery dispatched. Status Code 200 OK.' });
        triggerToast('Test webhook successfully consumed', 'success');
        if (hookId) {
          fetchWebhooks(); // Refresh history
        }
      } else {
        setTestResult({ success: false, msg: data.error?.message || 'Delivery returned error response' });
        triggerToast('Target test endpoint rejected delivery', 'error');
      }
    } catch (err) {
      setTestResult({ success: false, msg: 'Internal network route timeout' });
    } finally {
      setTestingId(null);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return triggerToast('Name identifier is required', 'error');
    if (!url.trim()) return triggerToast('Target url is required', 'error');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return triggerToast('Webhook URL must specify http or https protocol', 'error');
    }
    if (selectedEvents.length === 0) return triggerToast('Please listen to at least one system event', 'error');

    setSaving(true);
    const payload = {
      name,
      channel,
      url,
      events: selectedEvents,
      is_active: true
    };

    try {
      const res = await fetch('/api/v1/notification-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setWebhooks(prev => [...prev, data.data]);
        triggerToast('Webhook registered successfully', 'success');
        setIsFormOpen(false);
        // Reset Form
        setName('');
        setChannel('custom');
        setUrl('');
        setSelectedEvents([]);
        setTestResult(null);
      } else {
        triggerToast(data.error?.message || 'Error occurred registering webhook', 'error');
      }
    } catch (err) {
      triggerToast('Failed to connect to gateway api', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getDomainOnly = (fullUrl: string) => {
    try {
      const parsed = new URL(fullUrl);
      return parsed.hostname + (parsed.pathname === '/' ? '' : parsed.pathname.slice(0, 15) + '...');
    } catch (err) {
      return fullUrl.slice(0, 30) + '...';
    }
  };

  // Group configurations
  const EVENT_GROUPS = {
    'Stock Alerts': ['EXPIRY_ALERT', 'EXPIRED_STOCK_IN_BIN', 'REORDER_LEVEL_BREACHED', 'OVERSTOCKED_SKU'],
    'Fulfilment': ['DELIVERY_LATE', 'DELIVERY_LOCATION_MISMATCH'],
    'Replenishment': ['FPO_DISPATCHED', 'FPO_CLOSURE_READY'],
    'Inventory Control': ['WRITE_OFF_HIGH_VALUE', 'STOCK_TO_ZERO_ADJUSTMENT', 'DOUBLE_TRANSACTION'],
    'Assemblies & Kitchen': ['BOM_INSUFFICIENT_STOCK'],
    'Platform Security': ['PERMISSION_VIOLATION']
  };

  return (
    <div className="space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-teal-400" />
            <h2 className="text-xl font-bold tracking-tight">Webhooks Registrations</h2>
          </div>
          <p className="text-slate-400 text-xs mt-1 leading-normal">
            Send events to external systems when things happen in FreshOpsPlatform.
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="px-4 py-2.5 bg-teal-500 hover:bg-teal-450 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition duration-150 cursor-pointer shadow-lg shadow-teal-500/10 min-h-[44px]"
        >
          <Plus className="h-4 w-4" />
          <span>New Webhook</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-450 flex flex-col items-center justify-center gap-2.5 bg-white border border-slate-200 rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          <span className="text-xs">Querying system callback hooks and channels diagnostics...</span>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-400">
          <Radio className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-bold leading-normal">No active webhook callbacks configured yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {webhooks.map((hook) => {
            const hasDeliveries = hook.deliveries && hook.deliveries.length > 0;
            const lastDelivery = hasDeliveries ? hook.deliveries![0] : null;

            // Simple status color calculation
            let statusDot = 'bg-slate-300';
            if (lastDelivery) {
              statusDot = lastDelivery.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500';
            }

            const isExpanded = expandedId === hook.id;

            return (
              <div 
                key={hook.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs hover:shadow-xs transition"
              >
                {/* Expandable summary Card block */}
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : hook.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50"
                >
                  <div className="flex gap-3.5 items-start">
                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-teal-400 shrink-0">
                      <Radio className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">{hook.name}</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          hook.channel === 'slack' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                          hook.channel === 'teams' ? 'bg-blue-105 bg-blue-100 text-blue-800 border-blue-200' :
                          hook.channel === 'google_chat' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          'bg-slate-100 text-slate-800 border-slate-200'
                        }`}>
                          {hook.channel}
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-xs font-mono text-slate-450 mt-1 flex items-center gap-1">
                        <Globe className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[280px] sm:max-w-md">{getDomainOnly(hook.url)}</span>
                      </div>
                      <div className="text-[9px] text-slate-450 font-bold mt-1">
                        Listening to {hook.events.length} system {hook.events.length === 1 ? 'event' : 'events'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto shrink-0 select-text" onClick={e=>e.stopPropagation()}>
                    
                    {/* Test Button */}
                    <button
                      type="button"
                      disabled={testingId !== null}
                      onClick={() => handleSendTestEvent(hook.id)}
                      className="px-2.5 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-[11px] flex items-center gap-1 transition cursor-pointer min-h-[36px]"
                    >
                      {testingId === hook.id ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          <span>Send Test</span>
                        </>
                      )}
                    </button>

                    {/* Active Toggle */}
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hook.is_active}
                        onChange={() => handleToggleActive(hook)}
                        className="rounded-md border-slate-300 text-teal-600 focus:ring-0 cursor-pointer h-4 w-4"
                      />
                      <span className="text-[11px] font-bold text-slate-650">Active</span>
                    </label>

                    {/* Trash */}
                    <button
                      onClick={(e) => handleDeleteWebhook(hook.id, e)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer"
                      title="Delete Webhook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    {/* Status Dot */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <div className={`h-2.5 w-2.5 rounded-full ${statusDot}`} title={lastDelivery ? `Last status: ${lastDelivery.status}` : 'No deliveries'} />
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Sub Delivery records history */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5 text-xs">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2.5 block">
                      Delivery logs (Recent 20 dispatches)
                    </span>

                    {!hasDeliveries ? (
                      <div className="p-6 text-center text-slate-400 border border-dashed rounded-xl bg-white">
                        <CheckCircle2 className="h-5 w-5 text-slate-300 mx-auto mb-1.5" />
                        <span>No historical deliveries logged on this callback. Fire a Test above!</span>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                        <table className="w-full text-left text-[11px] font-medium text-slate-750">
                          <thead>
                            <tr className="bg-slate-50 border-b text-[9px] font-extrabold uppercase text-slate-500">
                              <th className="p-3">Dispatch Time</th>
                              <th className="p-3">Observed Event</th>
                              <th className="p-3 text-center">Status</th>
                              <th className="p-3 text-center">HTTP Status</th>
                              <th className="p-3 text-right">Elapsed Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-650">
                            {hook.deliveries!.map((del) => (
                              <tr key={del.id}>
                                <td className="p-3 font-mono text-[10px]">
                                  {new Date(del.timestamp).toLocaleString()}
                                </td>
                                <td className="p-3 font-mono font-bold text-slate-900">{del.event}</td>
                                <td className="p-3 text-center">
                                  {del.status === 'success' ? (
                                    <span className="bg-emerald-55 bg-emerald-50 text-emerald-850 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider text-[8px]">
                                      Success
                                    </span>
                                  ) : (
                                    <span className="bg-rose-50 text-rose-850 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider text-[8px]">
                                      Failed
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center font-mono font-bold text-slate-800">
                                  {del.http_code}
                                </td>
                                <td className="p-3 text-right font-mono text-[10px] text-slate-500">
                                  {del.response_time_ms} ms
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Outbound Webhook creation Modal dialog */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleFormSubmit}
            className="bg-white rounded-2xl w-full max-w-xl shadow-2xl p-6 md:p-8 space-y-4 text-slate-800 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-teal-650 animate-pulse" />
                <h3 className="font-bold text-slate-900 leading-none">Formulate Callback Webhook</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-450 hover:bg-slate-50 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-xl border text-[11px] flex gap-2 items-start ${
                testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-250 text-rose-950'
              }`}>
                {testResult.success ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-rose-600" />}
                <span>{testResult.msg}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-450 tracking-wider mb-1.5">
                    Identifier Label *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Slack Ops Channel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-250 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-450 tracking-wider mb-1.5">
                    Integration Channel
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2.5 cursor-pointer"
                  >
                    <option value="custom">Standard HTTP Webhook URL</option>
                    <option value="slack">Slack incoming Webhook format</option>
                    <option value="teams">Microsoft Teams connector format</option>
                    <option value="google_chat">Google Chat webhook card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-slate-450 tracking-wider mb-1.5">
                  Destination Webhook URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://hooks.slack.com/services/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-white border border-slate-250 rounded-xl px-3.5 py-2.5 font-mono text-[11px]"
                />
              </div>

              {/* Multi group checkboxes event list */}
              <div className="space-y-2">
                <span className="block text-[10px] uppercase font-black text-slate-500 tracking-wider pb-1 border-b">
                  Subscribe to platform triggers *
                </span>

                <div className="space-y-3.5 max-h-[190px] overflow-y-auto pr-1">
                  {Object.entries(EVENT_GROUPS).map(([gName, list]) => {
                    const allSelected = list.every(e => selectedEvents.includes(e));
                    return (
                      <div key={gName} className="space-y-1.5">
                        <div className="flex justify-between items-center bg-slate-50 px-2.5 py-1 rounded-md border">
                          <span className="font-bold text-slate-700 text-[10px]">{gName}</span>
                          <button
                            type="button"
                            onClick={() => handleGroupSelect(list)}
                            className="text-[9px] font-black text-teal-650"
                          >
                            {allSelected ? 'De-select All' : 'Select All'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pl-1.5">
                          {list.map((evt) => (
                            <label key={evt} className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedEvents.includes(evt)}
                                onChange={() => handleEventToggle(evt)}
                                className="rounded-md border-slate-300 text-teal-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                              />
                              <span className="font-mono mt-0.5">{evt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-150">
              <button
                type="button"
                disabled={testingId !== null}
                onClick={() => handleSendTestEvent()}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1 min-h-[44px] cursor-pointer"
              >
                {testingId === 'form-test' ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                    <span>Ping Testing...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 text-slate-500" />
                    <span>Send Test Event</span>
                  </>
                )}
              </button>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-450 text-slate-950 font-bold rounded-xl text-xs min-h-[44px] disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Creating hook...' : 'Activate Webhook'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
