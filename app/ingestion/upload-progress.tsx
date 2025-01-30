"use client"

import { Progress } from "@/components/ui/progress"

interface UploadProgressProps {
  currentRow: number
  totalRows: number
  startTime: number
  uploadedBytes: number
  totalBytes: number
  isVisible: boolean
  currentBatch?: number
  totalBatches?: number
}

export function UploadProgress({ 
  currentRow, 
  totalRows, 
  startTime, 
  uploadedBytes, 
  totalBytes,
  isVisible,
  currentBatch = 0,
  totalBatches = 1
}: UploadProgressProps) {
  if (!isVisible) return null;

  const progress = (currentRow / totalRows) * 100;
  const elapsedTime = Date.now() - startTime;
  const rate = elapsedTime > 0 ? currentRow / (elapsedTime / 1000) : 0; // rows per second
  
  // Calculate estimated time for entire file
  const remainingRows = totalRows - currentRow;
  const estimatedSecondsRemaining = rate > 0 ? remainingRows / rate : 0;

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return 'Calculating...';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  };

  return (
    <div className="w-full space-y-2 p-4 border rounded-lg bg-background">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>
          Processing rows: {currentRow.toLocaleString()} / {totalRows.toLocaleString()}
          {totalBatches > 1 && ` (Batch ${currentBatch} of ${totalBatches})`}
        </span>
        <span>{progress.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
        <div 
          className="bg-primary h-full transform origin-left"
          style={{ 
            transform: `scaleX(${progress / 100})`,
            transition: 'transform 0.2s linear'
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p>Processing Speed: {Math.round(rate)} rows/sec</p>
          <p>Data Processed: {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}</p>
        </div>
        <div>
          <p>Time Elapsed: {formatTime(elapsedTime / 1000)}</p>
          <p>Estimated Remaining: {formatTime(estimatedSecondsRemaining)}</p>
        </div>
      </div>
    </div>
  );
} 