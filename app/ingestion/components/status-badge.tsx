interface StatusBadgeProps {
  activity_status: 'active' | 'deleted';
  processing_status: 'processing' | 'completed' | 'failed';
}

export function StatusBadge({ activity_status, processing_status }: StatusBadgeProps) {
  const getStatusColor = () => {
    if (activity_status === 'deleted') return 'bg-gray-500';
    switch (processing_status) {
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-white text-sm ${getStatusColor()}`}>
      {activity_status === 'deleted' ? 'Deleted' : processing_status}
    </span>
  );
} 