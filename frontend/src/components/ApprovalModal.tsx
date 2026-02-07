import { useState } from 'react';
import { X, FileText, Check, XCircle, AlertTriangle } from 'lucide-react';
import type { ApprovalRequest } from '@shared/types';

interface ApprovalModalProps {
  request: ApprovalRequest;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export default function ApprovalModal({
  request,
  onClose,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: ApprovalModalProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const getActionTypeIcon = (actionType: ApprovalRequest['actionType']) => {
    switch (actionType) {
      case 'planning':
        return <FileText className="w-5 h-5 text-cyan-400" />;
      case 'architecture':
        return <FileText className="w-5 h-5 text-purple-400" />;
      case 'git_push':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'large_edit':
        return <FileText className="w-5 h-5 text-orange-400" />;
    }
  };

  const getActionTypeLabel = (actionType: ApprovalRequest['actionType']) => {
    switch (actionType) {
      case 'planning':
        return 'Planning Decision';
      case 'architecture':
        return 'Architecture Decision';
      case 'git_push':
        return 'Git Push Request';
      case 'large_edit':
        return 'Large Scale Edit';
    }
  };

  const getActionTypeDescription = (actionType: ApprovalRequest['actionType']) => {
    switch (actionType) {
      case 'planning':
        return 'The Controller wants to create an implementation plan for this task.';
      case 'architecture':
        return 'The Controller wants to make architectural decisions that may affect the codebase structure.';
      case 'git_push':
        return 'The Controller wants to push changes to a remote repository.';
      case 'large_edit':
        return 'The Controller wants to make significant changes across multiple files.';
    }
  };

  const handleReject = () => {
    if (showRejectInput) {
      onReject(rejectReason || undefined);
    } else {
      setShowRejectInput(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {getActionTypeIcon(request.actionType)}
            <div>
              <h3 className="text-lg font-semibold text-white">
                {getActionTypeLabel(request.actionType)}
              </h3>
              <p className="text-sm text-slate-400">{request.taskTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Context */}
          <div className="bg-slate-900 rounded-lg p-4">
            <p className="text-sm text-slate-300">{getActionTypeDescription(request.actionType)}</p>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2">Summary</h4>
            <p className="text-white">{request.description}</p>
          </div>

          {/* Details/Plan */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2">Proposed Plan</h4>
            <div className="bg-slate-900 rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                {request.details}
              </pre>
            </div>
          </div>

          {/* Reject reason input */}
          {showRejectInput && (
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">Rejection Reason (optional)</h4>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why you're rejecting this action..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 resize-none"
                rows={3}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700">
          <div className="text-xs text-slate-500">
            Requested {new Date(request.createdAt).toLocaleString()}
          </div>
          <div className="flex items-center gap-3">
            {!showRejectInput && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleReject}
              disabled={isRejecting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <XCircle className="w-4 h-4" />
              {showRejectInput ? 'Confirm Reject' : 'Reject'}
            </button>
            {showRejectInput && (
              <button
                onClick={() => setShowRejectInput(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Back
              </button>
            )}
            {!showRejectInput && (
              <button
                onClick={onApprove}
                disabled={isApproving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
