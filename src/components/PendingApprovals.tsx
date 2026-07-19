import React, { useState, useEffect } from 'react';
import { User, WorkflowApproval } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  UserCheck, 
  GitPullRequest, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  MessageSquare,
  Sparkles,
  RefreshCw,
  ShoppingBag,
  DollarSign
} from 'lucide-react';

interface PendingApprovalsProps {
  currentUser: User | null;
  triggerToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function PendingApprovals({ 
  currentUser, 
  triggerToast 
}: PendingApprovalsProps) {
  const { format: formatMoney } = useCurrency();
  const [approvals, setApprovals] = useState<WorkflowApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Action state
  const [actionNotes, setActionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'pending' 
        ? '/api/v1/workflow-approvals?status=pending' 
        : '/api/v1/workflow-approvals';
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        let list = data.data || [];
        if (typeFilter !== 'all') {
          list = list.filter((a: any) => a.type === typeFilter);
        }
        setApprovals(list);
      } else {
        triggerToast?.('Failed to load workflow approvals.', 'error');
      }
    } catch {
      triggerToast?.('Network error loading approvals.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter, typeFilter, currentUser]);

  const handleAction = async (approvalId: string, action: 'approve' | 'reject') => {
    if (!actionNotes.trim() && action === 'reject') {
      triggerToast?.('Please provide rejection notes.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/v1/workflow-approvals/${approvalId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notes: actionNotes.trim() || `${action === 'approve' ? 'Approved' : 'Rejected'} via Pending Approvals Manager`
        })
      });

      if (response.ok) {
        const resData = await response.json();
        triggerToast?.(`Workflow ${action}d successfully.`, 'success');
        setActionNotes('');
        setExpandedId(null);
        fetchApprovals();
      } else {
        const err = await response.json();
        triggerToast?.(err.error?.message || `Failed to ${action} approval.`, 'error');
      }
    } catch {
      triggerToast?.('Network error actioning approval.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if current user is eligible to approve/reject the current stage
  const isEligibleToApprove = (approval: WorkflowApproval): boolean => {
    if (approval.status !== 'pending') return false;
    if (!currentUser) return false;

    const currentStage = approval.stages.find(s => s.stage === approval.current_stage);
    if (!currentStage) return false;

    // Check specific user id
    if (currentStage.required_user_id) {
      return currentStage.required_user_id === currentUser.id;
    }

    // Check role
    if (currentStage.required_role) {
      if (currentUser.role === 'admin') return true; // superuser fallback
      return currentStage.required_role === currentUser.role;
    }

    // Check permission
    if (currentStage.required_permission) {
      if (currentUser.role === 'admin') return true; // superuser
      // Check custom roles permissions (if exists) or standard permissions fallback
      const hasPerm = (currentUser as any).permissions?.includes(currentStage.required_permission) || false;
      return hasPerm;
    }

    return false;
  };

  const getStageActorDescription = (stage: any): string => {
    if (stage.required_user_id) {
      if (stage.required_user_id === 'REPORTS_TO_CREATOR') return 'Line Manager';
      return `User ID: ${stage.required_user_id}`;
    }
    if (stage.required_role) return `Role: ${stage.required_role}`;
    if (stage.required_permission) return `Permission: ${stage.required_permission}`;
    return 'Anyone';
  };

  const formatCurrency = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return formatMoney(0);
    return formatMoney(Number(val));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" id="pending-approvals-inbox">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight text-gray-900 flex items-center gap-2">
            <UserCheck className="h-8 w-8 text-emerald-600" />
            Approvals Manager
          </h1>
          <p className="text-gray-500 mt-1">
            Review and click to approve/reject workflow stages routed to your role, specific user ID, or permissions.
          </p>
        </div>
        <button
          onClick={fetchApprovals}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 text-gray-700 shadow-sm transition-colors h-[44px]"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Tabs for Pending vs All */}
        <div className="flex bg-gray-100 p-1 rounded-lg self-start">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              statusFilter === 'pending'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Pending Action ({approvals.filter(a => a.status === 'pending').length})
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            All History
          </button>
        </div>

        {/* Type Filter dropdown */}
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <span className="text-sm font-semibold text-gray-500 whitespace-nowrap">Workflow Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full md:w-56 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm h-[44px]"
          >
            <option value="all">All Types</option>
            <option value="PRICE_VARIANCE">Price Variance</option>
            <option value="NEW_SUPPLIER">New Supplier Onboarding</option>
            <option value="PRICE_CHANGE">Price Change</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          <span className="mt-4 text-gray-500 font-medium">Loading approval requests...</span>
        </div>
      ) : approvals.length === 0 ? (
        <div className="bg-white border rounded-xl p-16 text-center shadow-sm max-w-4xl mx-auto flex flex-col items-center">
          <div className="bg-emerald-50 text-emerald-600 rounded-full p-4 mb-4">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Your Inbox is Clear!</h3>
          <p className="text-gray-500 max-w-md mx-auto mt-2 text-sm">
            {statusFilter === 'pending' 
              ? 'No outstanding action approvals found matching your criteria.' 
              : 'No historical approvals found matching your criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map(approval => {
            const isExpanded = expandedId === approval.id;
            const eligible = isEligibleToApprove(approval);
            const currentStageObj = approval.stages.find(s => s.stage === approval.current_stage);
            
            // Calculate variance stats if PRICE_VARIANCE type
            let variancePercent = 0;
            let varianceAmt = 0;
            let actualUnitCost = 0;
            let poUnitCost = 0;
            let skuId = '';
            let poId = '';

            if (approval.type === 'PRICE_VARIANCE' && approval.entity_snapshot) {
              actualUnitCost = approval.entity_snapshot.actual_unit_cost_cents || 0;
              poUnitCost = approval.entity_snapshot.po_unit_cost_cents || 0;
              varianceAmt = actualUnitCost - poUnitCost;
              skuId = approval.entity_snapshot.sku_id || '';
              poId = approval.entity_snapshot.po_id || '';
              if (poUnitCost > 0) {
                variancePercent = (varianceAmt / poUnitCost) * 100;
              }
            }

            return (
              <div 
                key={approval.id}
                className={`bg-white rounded-xl shadow-sm border transition-all duration-300 ${
                  isExpanded ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-gray-200 hover:shadow-md'
                }`}
                id={`approval-item-${approval.id}`}
              >
                {/* Main Row / Header summary */}
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                  className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer select-none"
                >
                  <div className="flex flex-col md:flex-row items-start gap-4">
                    {/* Status badge & Icon */}
                    <div className="mt-1">
                      {approval.status === 'pending' ? (
                        <div className="bg-amber-50 text-amber-600 p-2.5 rounded-lg border border-amber-200">
                          <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                      ) : approval.status === 'approved' ? (
                        <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-lg border border-emerald-200">
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        </div>
                      ) : (
                        <div className="bg-rose-50 text-rose-600 p-2.5 rounded-lg border border-rose-200">
                          <XCircle className="h-5 w-5 text-rose-500" />
                        </div>
                      )}
                    </div>

                    {/* Metadata details */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          {approval.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-400">â€¢</span>
                        <span className="text-xs text-gray-500 font-mono tracking-tight">{approval.id}</span>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900">
                        {approval.type === 'PRICE_VARIANCE' 
                          ? `Price Variance: SKU ${skuId} on PO ${poId}`
                          : `${approval.type.replace('_', ' ')} Approval`}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                        <span>Raised by: <span className="font-semibold text-gray-700">{(approval as any).raised_by_name || approval.raised_by}</span></span>
                        <span>â€¢</span>
                        <span>Date: <span className="font-semibold text-gray-700">{new Date(approval.raised_at).toLocaleString()}</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Right side summary badges & actions */}
                  <div className="flex items-center gap-3 self-stretch md:self-auto justify-between border-t md:border-t-0 pt-4 md:pt-0">
                    <div className="text-right space-y-1">
                      <div className="flex flex-wrap gap-2 justify-end">
                        {approval.type === 'PRICE_VARIANCE' && (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            variancePercent > 0 
                              ? 'bg-rose-100 text-rose-800' 
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {variancePercent > 0 ? '+' : ''}{variancePercent.toFixed(1)}% Variance
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          approval.status === 'pending' 
                            ? 'bg-amber-100 text-amber-800' 
                            : approval.status === 'approved' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-rose-100 text-rose-800'
                        }`}>
                          {approval.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-indigo-600 mt-1">
                        {approval.status === 'pending' 
                          ? `Stage ${approval.current_stage} of ${approval.stages.length}: ${currentStageObj?.label}`
                          : `Workflow finished (${approval.stages.length} stages)`}
                      </p>
                    </div>

                    <div className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-6 bg-gray-50/50 space-y-6">
                    {/* Part 1: SNAPSHOT DETAILS if PRICE_VARIANCE */}
                    {approval.type === 'PRICE_VARIANCE' && (
                      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4" id={`snapshot-${approval.id}`}>
                        <div className="flex justify-between items-center border-b pb-3 border-gray-100">
                          <h4 className="font-bold text-gray-900 flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5 text-indigo-500" />
                            Entity Snapshot Specifications
                          </h4>
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-semibold tracking-wider uppercase">
                            GRN Capture Info
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-gray-500 uppercase">Product SKU</span>
                            <p className="font-semibold text-gray-800">{skuId}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-gray-500 uppercase">Purchase Order</span>
                            <p className="font-semibold text-gray-800">{poId}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-gray-500 uppercase">Goods Receipt Date</span>
                            <p className="font-semibold text-gray-800">
                              {approval.entity_snapshot?.grn_date ? new Date(approval.entity_snapshot.grn_date).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-gray-100">
                          <div className="bg-gray-50 p-3.5 rounded-lg border">
                            <span className="block text-xs font-semibold text-gray-500 uppercase">PO Expected Unit Cost</span>
                            <span className="text-lg font-bold text-gray-800">{formatCurrency(poUnitCost)}</span>
                          </div>
                          <div className="bg-amber-50 p-3.5 rounded-lg border border-amber-200">
                            <span className="block text-xs font-semibold text-amber-700 uppercase">Actual Received Unit Cost</span>
                            <span className="text-lg font-bold text-amber-900">{formatCurrency(actualUnitCost)}</span>
                          </div>
                          <div className="p-3.5 rounded-lg border flex flex-col justify-center bg-gray-50">
                            <span className="block text-xs font-semibold text-gray-500 uppercase">Variance Impact</span>
                            <span className={`text-lg font-extrabold ${varianceAmt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {varianceAmt > 0 ? '+' : ''}{formatCurrency(varianceAmt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Part 2: FLOW TIMELINE SHOWING STAGES */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <GitPullRequest className="h-5 w-5 text-emerald-500" />
                        Multi-Stage Sign-off Pipeline
                      </h4>

                      <div className="relative border-l-2 border-gray-200 pl-6 ml-4 space-y-6">
                        {approval.stages.map((stage, sIdx) => {
                          const isCurrent = approval.status === 'pending' && approval.current_stage === stage.stage;
                          const isPassed = approval.status === 'approved' || (approval.status === 'pending' && stage.stage < approval.current_stage);
                          const isRejected = stage.status === 'rejected';

                          return (
                            <div key={sIdx} className="relative">
                              {/* Pipeline state dot indicator */}
                              <span className={`absolute -left-[35px] top-1 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shadow-sm ${
                                isRejected 
                                  ? 'bg-rose-500 text-white border-2 border-rose-200'
                                  : isPassed 
                                    ? 'bg-emerald-500 text-white border-2 border-emerald-200' 
                                    : isCurrent 
                                      ? 'bg-amber-500 text-white border-2 border-amber-200 animate-pulse' 
                                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                              }`}>
                                {stage.stage}
                              </span>

                              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-bold text-gray-950 text-base">{stage.label}</h5>
                                    {isCurrent && (
                                      <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded border border-amber-300">
                                        Active Stage
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Determined Actor: <span className="font-semibold text-gray-700">{getStageActorDescription(stage)}</span>
                                  </p>
                                </div>

                                <div className="text-sm">
                                  {stage.status === 'approved' && (
                                    <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 self-start lg:self-auto font-medium">
                                      <CheckCircle className="h-4 w-4" />
                                      Approved by {stage.actioned_by} on {stage.actioned_at ? new Date(stage.actioned_at).toLocaleDateString() : ''}
                                    </div>
                                  )}
                                  {stage.status === 'rejected' && (
                                    <div className="text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 self-start lg:self-auto font-medium">
                                      <XCircle className="h-4 w-4" />
                                      Rejected by {stage.actioned_by} on {stage.actioned_at ? new Date(stage.actioned_at).toLocaleDateString() : ''}
                                    </div>
                                  )}
                                  {stage.status === 'pending' && !isCurrent && (
                                    <span className="text-gray-400 bg-gray-50 border px-3 py-1.5 rounded-lg inline-block font-semibold">
                                      Queued
                                    </span>
                                  )}
                                  {isCurrent && (
                                    <p className="text-xs bg-amber-50 text-amber-800 font-semibold px-3 py-1.5 rounded-lg border border-amber-200 inline-block">
                                      Waiting for sign-off
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Stage decision notes if exist */}
                              {stage.notes && (
                                <div className="mt-2 text-xs bg-gray-50 rounded-lg p-2.5 border text-gray-600 flex items-start gap-1.5">
                                  <MessageSquare className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <span>
                                    <strong className="text-gray-700">Decision Notes:</strong> {stage.notes}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Part 3: WORKFLOW RESOLUTION STATS (if approved/rejected) */}
                    {approval.status !== 'pending' && (
                      <div className="bg-white border rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className={`h-5 w-5 ${approval.status === 'approved' ? 'text-emerald-500' : 'text-rose-500'}`} />
                          <span className="text-sm font-semibold text-gray-800">
                            Workflow resolved as <strong className="uppercase">{approval.status}</strong>
                          </span>
                        </div>
                        {approval.resolved_at && (
                          <span className="text-xs text-gray-500">
                            Resolved date: {new Date(approval.resolved_at).toLocaleString()}
                          </span>
                        )}
                        {approval.resolution_notes && (
                          <div className="w-full text-xs bg-gray-100 p-2.5 rounded border">
                            <strong>Resolution notes:</strong> {approval.resolution_notes}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Part 4: THE ACTION PAD BOX (if pending & current user is authorized) */}
                    {approval.status === 'pending' && (
                      <div className="bg-white rounded-xl p-5 border border-indigo-200">
                        {eligible ? (
                          <div className="space-y-4" id={`decision-pad-${approval.id}`}>
                            <div className="flex items-center gap-2 border-b pb-2 border-gray-100">
                              <Sparkles className="h-5 w-5 text-indigo-500" />
                              <h4 className="font-bold text-gray-900">Sign-off Terminal</h4>
                            </div>

                            <p className="text-sm text-gray-500">
                              You are authorized to action this stage (<strong className="text-indigo-600">{currentStageObj?.label}</strong>). Please review the details above and supply any optional notes below.
                            </p>

                            <div className="space-y-1">
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                Decision Notes / Reason
                              </label>
                              <textarea
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                placeholder="e.g. Price Variance checked against local contracts, matches authorized adjustments."
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                              />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleAction(approval.id, 'reject')}
                                className="inline-flex items-center justify-center px-4 py-2 border border-rose-300 shadow-sm text-sm font-semibold rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 h-[44px] min-w-[124px]"
                              >
                                <XCircle className="h-4 w-4 mr-1.5" />
                                Reject Stage
                              </button>
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleAction(approval.id, 'approve')}
                                className="inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 h-[44px] min-w-[124px]"
                              >
                                <CheckCircle className="h-4 w-4 mr-1.5" />
                                Approve Stage
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-250 flex items-start gap-2.5">
                            <Clock className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-gray-700">Waiting for Stage {approval.current_stage} Review</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                You do not possess the required identity, role profile (<strong className="font-semibold text-gray-700">{currentStageObj?.required_role || 'N/A'}</strong>) or permission settings (<strong className="font-semibold text-gray-700">{currentStageObj?.required_permission || 'N/A'}</strong>) to approve this stage.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

