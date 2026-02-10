import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  onRefresh: () => void;
  isFetching?: boolean;
  dataUpdatedAt?: number;
  className?: string;
}

function timeAgo(timestamp: number): string {
  if (!timestamp) return 'never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m ago`;
}

export default function RefreshButton({ onRefresh, isFetching, dataUpdatedAt, className = '' }: RefreshButtonProps) {
  return (
    <div className={`flex items-center gap-2 text-xs text-slate-500 ${className}`}>
      {dataUpdatedAt ? (
        <span>Updated {timeAgo(dataUpdatedAt)}</span>
      ) : null}
      <button
        onClick={onRefresh}
        disabled={isFetching}
        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
        title="Refresh"
      >
        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
