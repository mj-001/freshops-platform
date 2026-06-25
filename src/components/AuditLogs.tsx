import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  ShieldCheck, Search, RefreshCw, Download, ChevronDown, ChevronUp, 
  User as UserIcon, Calendar, Filter, Database, Key, CheckCircle, 
  ArrowLeftRight, HelpCircle, FileText, AlertTriangle 
} from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogsProps {
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const downloadAsXLSX = (
  rows: (string | number | null)[][],
  filename: string
) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export default function AuditLogs({ triggerToast }: AuditLogsProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch('/api/v1/audit-logs');
      const payload = await res.json();
      if (payload.success && payload.data) {
        setLogs(payload.data);
      } else {
        triggerToast('Failed to retrieve compliance audit logs', 'error');
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      triggerToast('Unable to connect to the compliance ledger API', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchLogs(true);
    triggerToast('Compliance log ledger synchronized', 'info');
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      triggerToast('No compliance logs available to export', 'error');
      return;
    }

    try {
      const headers = ['Log ID', 'Timestamp', 'User ID', 'Actor Name', 'Actor Email', 'Actor Role', 'Action', 'Entity Type', 'Entity ID', 'Description'];
      const rows = filteredLogs.map(log => [
        log.id,
        log.timestamp,
        log.user_id || 'SYSTEM',
        log.user_name || 'System Scheduler',
        log.user_email || 'system@wms.local',
        log.user_role || 'system',
        log.action,
        log.entity_type,
        log.entity_id || '',
        log.description.replace(/"/g, '""')
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `WMS_Compliance_Audit_Logs_${new Date().toISOString().substring(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      triggerToast('Compliance audit report downloaded successfully', 'success');
    } catch (err) {
      triggerToast('Failed to generate CSV export', 'error');
    }
  };

  const handleExportXLSX = () => {
    if (logs.length === 0) {
      triggerToast('No compliance logs available to export', 'error');
      return;
    }

    try {
      const headers = ['Log ID', 'Timestamp', 'User ID', 'Actor Name', 'Actor Email', 'Actor Role', 'Action', 'Entity Type', 'Entity ID', 'Description'];
      const rows = filteredLogs.map(log => [
        log.id,
        log.timestamp,
        log.user_id || 'SYSTEM',
        log.user_name || 'System Scheduler',
        log.user_email || 'system@wms.local',
        log.user_role || 'system',
        log.action,
        log.entity_type,
        log.entity_id || '',
        log.description
      ]);

      const dataRows = [headers, ...rows];
      downloadAsXLSX(dataRows, `WMS_Compliance_Audit_Logs_${new Date().toISOString().substring(0, 10)}`);
      triggerToast('Compliance audit report downloaded successfully', 'success');
    } catch (err) {
      triggerToast('Failed to generate XLSX export', 'error');
    }
  };

  // Extract unique filter populations
  const actionTypes = Array.from(new Set(logs.map(l => l.action).filter(Boolean)));
  const entityTypes = Array.from(new Set(logs.map(l => l.entity_type).filter(Boolean)));
  const userRoles = Array.from(new Set(logs.map(l => l.user_role).filter(Boolean)));

  const filteredLogs = logs.filter(log => {
    const text = `${log.id} ${log.description} ${log.user_name || ''} ${log.user_email || ''} ${log.entity_id || ''}`.toLowerCase();
    const matchesSearch = text.includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    const matchesRole = roleFilter === 'all' || log.user_role === roleFilter;

    return matchesSearch && matchesAction && matchesEntity && matchesRole;
  });

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'USER_LOGIN':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ROLE_SESSION_SWITCHED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'GOODS_RECEIPT_COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'TRANSFER_CREATED':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'TRANSFER_APPROVED':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'EOD_CHECK_COMPLETED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'USER_LOGIN':
      case 'ROLE_SESSION_SWITCHED':
        return <UserIcon className="h-4 w-4 text-blue-500" />;
      case 'GOODS_RECEIPT_COMPLETED':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'TRANSFER_CREATED':
      case 'TRANSFER_APPROVED':
        return <ArrowLeftRight className="h-4 w-4 text-teal-500" />;
      case 'EOD_CHECK_COMPLETED':
        return <ShieldCheck className="h-4 w-4 text-amber-500" />;
      default:
        return <FileText className="h-4 w-4 text-slate-500" />;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString() + ' (UTC)';
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-teal-400" />
            <h2 className="text-xl font-bold tracking-tight">System Compliance Audit Ledger</h2>
          </div>
          <p className="text-slate-400 text-xs mt-1 leading-normal">
            Cryptographically trace actions, user state updates, and critical system alerts of the WMS platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium rounded-xl flex items-center gap-1.5 text-xs transition duration-150 cursor-pointer border border-slate-750 min-h-[44px] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-teal-400' : ''}`} />
            <span>Sync Trail</span>
          </button>
          
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-teal-505 bg-teal-500 hover:bg-teal-450 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition duration-150 cursor-pointer shadow-lg shadow-teal-500/10 min-h-[44px]"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV Report</span>
          </button>
          <button
            type="button"
            onClick={handleExportXLSX}
            className="px-4 py-2.5 bg-teal-505 bg-teal-500 hover:bg-teal-450 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition duration-150 cursor-pointer shadow-lg shadow-teal-500/10 min-h-[44px]"
          >
            <Download className="h-4 w-4" />
            <span>Export XLSX Report</span>
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3 text-slate-650 text-xs leading-normal">
        <Database className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
        <p>
          <strong>Compliance Protocol Status: Active.</strong> The logs shown below are stored in an append-only transaction format inside our secure database repository. These trails cannot be modified or cleared by standard tenants or operators to fulfill the compliance requirements of regulatory agricultural bodies.
        </p>
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Search & Ledger Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Text input filter */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, email, desc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-xs rounded-xl text-slate-800 transition placeholder-slate-400 outline-none h-[40px]"
            />
          </div>

          {/* Action type Filter selector */}
          <div className="flex flex-col gap-1.5">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white text-xs rounded-xl text-slate-700 transition outline-none h-[40px] cursor-pointer"
            >
              <option value="all">Any Action Event (All)</option>
              {actionTypes.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          {/* Entity type Filter selector */}
          <div className="flex flex-col gap-1.5">
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white text-xs rounded-xl text-slate-700 transition outline-none h-[40px] cursor-pointer"
            >
              <option value="all">Any Entity (All)</option>
              {entityTypes.map(entity => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
          </div>

          {/* Role Filter selector */}
          <div className="flex flex-col gap-1.5">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 focus:bg-white text-xs rounded-xl text-slate-705 transition outline-none h-[40px] cursor-pointer"
            >
              <option value="all">Any Operator Role (All)</option>
              {userRoles.map(role => {
                const roleStr = String(role || '');
                return (
                  <option key={roleStr} value={roleStr}>
                    {roleStr ? roleStr.toUpperCase() : 'SYSTEM'}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Clear filters label */}
        {(searchQuery || actionFilter !== 'all' || entityFilter !== 'all' || roleFilter !== 'all') && (
          <div className="flex items-center justify-between text-xs border-t border-slate-50 pt-3">
            <span className="text-slate-500 font-medium">
              Filtered <strong>{filteredLogs.length}</strong> compliance events out of total <strong>{logs.length}</strong>
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setActionFilter('all');
                setEntityFilter('all');
                setRoleFilter('all');
              }}
              className="text-teal-650 hover:text-teal-500 font-semibold cursor-pointer underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-450 flex flex-col items-center justify-center gap-2.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <RefreshCw className="h-8 w-8 animate-spin text-teal-500" />
          <span className="text-xs">Loading agricultural security ledger audit logs...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-16 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 shadow-xs">
          <ShieldCheck className="h-12 w-12 mx-auto text-slate-300 mb-2.5" />
          <p className="text-xs font-bold leading-normal">No logs found matching selected compliance criteria</p>
          <p className="text-slate-400 text-xs leading-normal mt-1 max-w-sm mx-auto">
            Try adjusting your search query, selecting different resource entity parameters, or perform some actions (login, PO receive, Stock Transfers) to record new entries.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          {/* Logs stream list */}
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const isExpanded = expandedId === log.id;
              
              return (
                <div 
                  key={log.id} 
                  className={`transition duration-150 ${isExpanded ? 'bg-slate-50/40' : 'hover:bg-slate-50/20'}`}
                >
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex gap-3.5 items-start shrink-0 min-w-0 md:max-w-[70%]">
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-slate-500 shrink-0 mt-0.5">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-slate-505 uppercase">
                            {log.id}
                          </span>
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                            {log.entity_type} Reference: <strong className="text-slate-600 font-mono">{log.entity_id || 'N/A'}</strong>
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 font-semibold leading-normal break-words">
                          {log.description}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-450">
                          <UserIcon className="h-3 w-3" />
                          <span className="text-slate-600 font-semibold">{log.user_name || 'System'}</span>
                          <span className="text-slate-450">({log.user_email || 'system@wms.local'} — <span className="uppercase text-[9px] font-bold bg-slate-100 px-1 py-0.5 rounded-sm">{log.user_role || 'system'}</span>)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full md:w-auto md:justify-end gap-3.5 select-none text-right">
                      <div className="text-left md:text-right space-y-1">
                        <div className="flex items-center gap-1 md:justify-end text-[11px] text-slate-400">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(log.timestamp)}</span>
                        </div>
                        {log.details && (
                          <div className="text-[10px] text-teal-650 hover:text-teal-500 font-bold flex items-center justify-start md:justify-end gap-1">
                            <span>Details Available</span>
                          </div>
                        )}
                      </div>
                      
                      {log.details ? (
                        <div className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      ) : (
                        <div className="w-6" /> // spacer
                      )}
                    </div>
                  </div>

                  {/* Expanded block exhibiting audit log details (JSON metadata) */}
                  {isExpanded && log.details && (
                    <div className="px-5 pb-5 pt-1.5 border-t border-slate-100/60 bg-slate-50/70">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <Database className="h-3.5 w-3.5 text-slate-400" />
                          <span>Log Metadata Variables Payload</span>
                        </div>
                        <pre className="bg-slate-900 text-teal-400 text-[11px] p-4 rounded-xl border border-slate-800 font-mono overflow-x-auto shadow-inner leading-relaxed">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
