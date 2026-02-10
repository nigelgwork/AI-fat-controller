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
    <div className={`flex items-center gap-3 ${className}`}>
      {dataUpdatedAt ? (
        <span className="text-xs text-slate-500">Updated {timeAgo(dataUpdatedAt)}</span>
      ) : null}
      <button
        onClick={onRefresh}
        disabled={isFetching}
        className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors disabled:opacity-50"
      >
        <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>
  );
}
