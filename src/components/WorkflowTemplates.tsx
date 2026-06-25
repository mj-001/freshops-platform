import React, { useState, useEffect } from 'react';
import { User, WorkflowTemplate, WorkflowTemplateStage } from '../types';
import { 
  GitBranch, 
  ShieldAlert, 
  Trash2, 
  Plus, 
  Save, 
  X, 
  Edit2, 
  Check, 
  AlertCircle 
} from 'lucide-react';

interface WorkflowTemplatesProps {
  currentUser: User | null;
  triggerToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function WorkflowTemplates({ 
  currentUser, 
  triggerToast 
}: WorkflowTemplatesProps) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editStages, setEditStages] = useState<WorkflowTemplateStage[]>([]);

  const isAdmin = currentUser?.role === 'admin';

  const fetchTemplatesAndUsers = async () => {
    try {
      setLoading(true);
      const [templatesRes, usersRes] = await Promise.all([
        fetch('/api/v1/workflow-templates'),
        fetch('/api/v1/users')
      ]);

      if (templatesRes.ok && usersRes.ok) {
        const tData = await templatesRes.json();
        const uData = await usersRes.json();
        setTemplates(tData.data || []);
        setUsers(uData.data || []);
      } else {
        triggerToast?.('Failed to fetch data.', 'error');
      }
    } catch {
      triggerToast?.('Network error while loading configurations.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchTemplatesAndUsers();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center" id="wt-non-admin-screen">
        <div className="bg-white rounded-xl shadow-sm p-12 border border-gray-100 flex flex-col items-center">
          <ShieldAlert className="h-16 w-16 text-rose-500 mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold font-sans tracking-tight text-gray-800 mb-2">Access Restricted</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Workflow Templates configuration is restricted to administrators. Please contact your system administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  const handleToggleActive = async (template: WorkflowTemplate) => {
    try {
      const response = await fetch(`/api/v1/workflow-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !template.is_active })
      });

      if (response.ok) {
        const updated = await response.json();
        setTemplates(templates.map(t => t.id === template.id ? updated.data : t));
        triggerToast?.(
          `Template "${template.name}" ${!template.is_active ? 'enabled' : 'disabled'}.`, 
          'success'
        );
      } else {
        triggerToast?.('Failed to update template status.', 'error');
      }
    } catch {
      triggerToast?.('Network error updating status.', 'error');
    }
  };

  const startEditingStages = (template: WorkflowTemplate) => {
    setEditingTemplateId(template.id);
    // Deep clone stages for editing
    setEditStages(template.stages.map(s => ({ ...s })));
  };

  const handleStageChange = <K extends keyof WorkflowTemplateStage>(
    index: number, 
    field: K, 
    value: WorkflowTemplateStage[K]
  ) => {
    const updated = [...editStages];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setEditStages(updated);
  };

  const handleApproverTypeChange = (index: number, type: string) => {
    const updated = [...editStages];
    const current = updated[index];
    
    // Reset all approver fields
    current.required_user_id = null;
    current.required_role = null;
    current.required_permission = null;

    if (type === 'REPORTS_TO_CREATOR') {
      current.required_user_id = 'REPORTS_TO_CREATOR';
    } else if (type === 'specific_user') {
      // Default to first user or null
      current.required_user_id = users[0]?.id || null;
    } else if (type === 'role') {
      current.required_role = 'ops_manager';
    } else if (type === 'custom_permission') {
      current.required_permission = 'finance:approve';
    }
    setEditStages(updated);
  };

  const addStageRow = () => {
    const nextStageNum = editStages.length + 1;
    const newStage: WorkflowTemplateStage = {
      stage: nextStageNum,
      label: `Stage ${nextStageNum} Approval`,
      required_user_id: 'REPORTS_TO_CREATOR',
      required_role: null,
      required_permission: null
    };
    setEditStages([...editStages, newStage]);
  };

  const removeStageRow = (index: number) => {
    if (editStages.length <= 1) return;
    const updated = editStages
      .filter((_, i) => i !== index)
      .map((stage, i) => ({
        ...stage,
        stage: i + 1 // Re-index stages
      }));
    setEditStages(updated);
  };

  const cancelEditing = () => {
    setEditingTemplateId(null);
    setEditStages([]);
  };

  const saveTemplateStages = async (templateId: string) => {
    // Basic validation
    for (let i = 0; i < editStages.length; i++) {
      const s = editStages[i];
      if (!s.label.trim()) {
        triggerToast?.(`Stage ${s.stage} requires a label.`, 'error');
        return;
      }
      const hasUser = !!s.required_user_id;
      const hasRole = !!s.required_role;
      const hasPermission = !!s.required_permission;

      if (!hasUser && !hasRole && !hasPermission) {
        triggerToast?.(`Stage ${s.stage} must have an approver defined.`, 'error');
        return;
      }
    }

    try {
      const response = await fetch(`/api/v1/workflow-templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: editStages })
      });

      if (response.ok) {
        const updated = await response.json();
        setTemplates(templates.map(t => t.id === templateId ? updated.data : t));
        setEditingTemplateId(null);
        setEditStages([]);
        triggerToast?.('Workflow stages updated successfully!', 'success');
      } else {
        const err = await response.json();
        triggerToast?.(err.error?.message || 'Failed to save stages.', 'error');
      }
    } catch {
      triggerToast?.('Network error saving templates.', 'error');
    }
  };

  const getApproverType = (stage: WorkflowTemplateStage): string => {
    if (stage.required_user_id === 'REPORTS_TO_CREATOR') return 'REPORTS_TO_CREATOR';
    if (stage.required_user_id) return 'specific_user';
    if (stage.required_role) return 'role';
    if (stage.required_permission) return 'custom_permission';
    return 'REPORTS_TO_CREATOR';
  };

  const getApproverDescription = (stage: WorkflowTemplateStage): string => {
    if (stage.required_user_id === 'REPORTS_TO_CREATOR') {
      return 'Reports to workflow creator (dynamic runner manager)';
    }
    if (stage.required_user_id) {
      const found = users.find(u => u.id === stage.required_user_id);
      return `Specific user: ${found ? found.name : stage.required_user_id}`;
    }
    if (stage.required_role) {
      return `Required role: ${stage.required_role}`;
    }
    if (stage.required_permission) {
      return `Custom permission: ${stage.required_permission}`;
    }
    return 'Unknown approver';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" id="workflow-templates-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight text-gray-900 flex items-center gap-2">
            <GitBranch className="h-8 w-8 text-indigo-600" />
            Workflow Templates
          </h1>
          <p className="text-gray-500 mt-1">
            Configure approval templates and stages for pricing variances, new business partners, and other critical operations.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <span className="mt-4 text-gray-500 font-medium">Loading templates...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center shadow-sm">
          <GitBranch className="h-16 w-16 text-indigo-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-800">No Templates Found</h3>
          <p className="text-gray-500 max-w-sm mx-auto mt-2 text-sm">
            Templates are normally loaded on database initialization. Try resetting status if empty.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {templates.map(template => {
            const isEditing = editingTemplateId === template.id;

            return (
              <div 
                key={template.id} 
                className={`bg-white rounded-xl shadow-sm border transition-all duration-300 ${
                  isEditing ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 hover:shadow-md'
                }`}
                id={`template-card-${template.id}`}
              >
                {/* Card Header */}
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900">{template.name}</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 tracking-wider">
                        {template.type}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm max-w-2xl">{template.description}</p>
                  </div>

                  <div className="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                    <label className="inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={template.is_active} 
                        onChange={() => handleToggleActive(template)}
                        className="sr-only peer" 
                        disabled={isEditing}
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ms-2 text-sm font-medium text-gray-700">
                        {template.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </label>

                    {!isEditing && (
                      <button
                        onClick={() => startEditingStages(template)}
                        className="inline-flex items-center px-3.5 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-[44px]"
                      >
                        <Edit2 className="h-4 w-4 mr-2 text-gray-500" />
                        Edit Stages
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  {!isEditing ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-4">
                        Approval Stages ({template.stages.length})
                      </h3>
                      <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-6">
                        {template.stages.map((stage, sIdx) => (
                          <div key={sIdx} className="relative">
                            {/* Number circle */}
                            <span className="absolute -left-[37px] top-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-200">
                              {stage.stage}
                            </span>
                            <div>
                              <h4 className="font-semibold text-gray-900 text-base">{stage.label}</h4>
                              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                                <span className="font-medium text-gray-700">Required:</span> 
                                {getApproverDescription(stage)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6" id={`editor-${template.id}`}>
                      <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-5 w-5 text-indigo-600" />
                          <span className="text-sm font-semibold text-indigo-900">
                            Custom Stage Workflow Builder
                          </span>
                        </div>
                        <span className="text-xs text-indigo-700 bg-indigo-100 px-2 py-1 rounded font-medium">
                          Interactive Editor
                        </span>
                      </div>

                      <div className="space-y-4">
                        {editStages.map((stage, idx) => {
                          const appType = getApproverType(stage);

                          return (
                            <div 
                              key={idx} 
                              className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col lg:flex-row items-start lg:items-center gap-4 relative hover:border-gray-300 transition-colors"
                            >
                              {/* Stage Number Badge */}
                              <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold shadow-sm">
                                  {stage.stage}
                                </span>
                                <span className="lg:hidden text-sm font-bold text-gray-700">Stage {stage.stage} Details</span>
                              </div>

                              {/* Label Input */}
                              <div className="flex-1 w-full space-y-1">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                  Stage Label
                                </label>
                                <input
                                  type="text"
                                  value={stage.label}
                                  onChange={(e) => handleStageChange(idx, 'label', e.target.value)}
                                  placeholder="e.g. Finance Approval"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm h-[44px]"
                                />
                              </div>

                              {/* Selector for Type */}
                              <div className="w-full lg:w-48 space-y-1">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                  Approver Type
                                </label>
                                <select
                                  value={appType}
                                  onChange={(e) => handleApproverTypeChange(idx, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white h-[44px]"
                                >
                                  <option value="REPORTS_TO_CREATOR">Reports to Creator</option>
                                  <option value="specific_user">Specific User</option>
                                  <option value="role">Specific Role</option>
                                  <option value="custom_permission">Custom Permission</option>
                                </select>
                              </div>

                              {/* Dynamic Value Input */}
                              <div className="flex-1 w-full space-y-1">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                  Approver Assignment
                                </label>

                                {appType === 'REPORTS_TO_CREATOR' && (
                                  <div className="px-3 py-2 bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-medium rounded-lg flex items-center h-[44px]">
                                    Automatically routes to the direct manager of whoever raised the request
                                  </div>
                                )}

                                {appType === 'specific_user' && (
                                  <select
                                    value={stage.required_user_id || ''}
                                    onChange={(e) => handleStageChange(idx, 'required_user_id', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white h-[44px]"
                                  >
                                    {users.map(u => (
                                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                    ))}
                                  </select>
                                )}

                                {appType === 'role' && (
                                  <select
                                    value={stage.required_role || ''}
                                    onChange={(e) => handleStageChange(idx, 'required_role', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white h-[44px]"
                                  >
                                    <option value="admin">Admin</option>
                                    <option value="ops_manager">Operations Manager</option>
                                    <option value="receiver">Warehouse Receiver</option>
                                    <option value="picker">Picker</option>
                                    <option value="driver">Driver</option>
                                    <option value="auditor">Auditor</option>
                                  </select>
                                )}

                                {appType === 'custom_permission' && (
                                  <input
                                    type="text"
                                    value={stage.required_permission || ''}
                                    onChange={(e) => handleStageChange(idx, 'required_permission', e.target.value)}
                                    placeholder="e.g. finance:approve"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm h-[44px]"
                                  />
                                )}
                              </div>

                              {/* Remove Stage Button */}
                              <button
                                type="button"
                                onClick={() => removeStageRow(idx)}
                                disabled={editStages.length <= 1}
                                className="lg:mt-5 p-2 bg-white rounded-lg border border-gray-200 text-gray-500 hover:text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-center h-[44px] w-[44px] lg:self-center self-end"
                                title="Remove stage"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Editor Actions Footer */}
                      <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={addStageRow}
                          className="inline-flex justify-center items-center px-4 py-2 border border-dashed border-indigo-300 shadow-sm text-sm font-semibold rounded-lg text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-[44px]"
                        >
                          <Plus className="h-4 w-4 mr-1.5" />
                          Add Stage Row
                        </button>

                        <div className="flex gap-3 justify-end">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-[44px]"
                          >
                            <X className="h-4 w-4 mr-1.5" />
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveTemplateStages(template.id)}
                            className="inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-[44px]"
                          >
                            <Save className="h-4 w-4 mr-1.5" />
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
