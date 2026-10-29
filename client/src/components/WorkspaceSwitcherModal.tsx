import React from 'react';
import { Building2, Check, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkspaceSwitcherModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, workspaces, activeWorkspace, switchWorkspace } = useAuth();

  if (!isOpen) return null;

  const handleSelect = async (orgId: string | null) => {
    await switchWorkspace(orgId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Switch Workspace</h3>
            <p className="text-xs text-slate-500">Select an active clinical or administrative organization context</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-2">
          {/* Personal workspace */}
          <button
            onClick={() => handleSelect(null)}
            className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between transition-all ${
              !user?.activeWorkspaceId
                ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900">{user?.name}</div>
                <div className="text-xs text-slate-500 capitalize">Personal Account ({user?.role.replace(/_/g, ' ')})</div>
              </div>
            </div>
            {!user?.activeWorkspaceId && <Check className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Affiliated workspaces */}
          {workspaces.map((ws) => {
            const isCurrent = user?.activeWorkspaceId === ws.organizationId;
            return (
              <button
                key={ws.organizationId}
                onClick={() => handleSelect(ws.organizationId)}
                className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                  isCurrent
                    ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900">{ws.organizationName}</div>
                    <div className="text-xs text-slate-500 capitalize">
                      Role: <span className="font-medium text-slate-700">{ws.role.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                </div>
                {isCurrent && <Check className="w-4 h-4 text-indigo-600" />}
              </button>
            );
          })}

          {workspaces.length === 0 && (
            <div className="text-center py-4 text-xs text-slate-400">
              No organization memberships found. You can request provider onboarding or accept an invitation.
            </div>
          )}
        </div>

        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
