"use client"

import { useEffect, useRef, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { currentConfig } from '@/app/config'

const getApiUrl = () => currentConfig.apiUrl;

// Helper functions
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

interface UploadProgressProps {
  currentRow: number
  totalRows: number
  startTime: number
  uploadedBytes: number
  totalBytes: number
  isVisible: boolean
  currentBatch?: number
  totalBatches?: number
  useSSE?: boolean
  onSSEComplete?: (data: any) => void
  onSSEError?: (error: string) => void
}

interface SSEProgressState {
  current: number
  total: number
  percent: number
  recordsPerSecond: number
  elapsedSeconds: number
  status: string
  logs: Array<{ timestamp: string; message: string }>
}

export function UploadProgress({ 
  currentRow, 
  totalRows, 
  startTime, 
  uploadedBytes, 
  totalBytes,
  isVisible,
  currentBatch = 0,
  totalBatches = 1,
  useSSE = false,
  onSSEComplete,
  onSSEError
}: UploadProgressProps) {
  const [sseProgress, setSSEProgress] = useState<SSEProgressState>({
    current: 0,
    total: 0,
    percent: 0,
    recordsPerSecond: 0,
    elapsedSeconds: 0,
    status: 'Connecting to server...',
    logs: []
  });
  const [sseError, setSSEError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // Set up SSE connection if useSSE is true
  useEffect(() => {
    if (!useSSE || !isVisible) return;
    
    const connectSSE = () => {
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      // Create a new SSE connection
      eventSourceRef.current = new EventSource(`${getApiUrl()}/api/ingested-data/progress`);
      
      // Handle connection open
      eventSourceRef.current.onopen = () => {
        console.log('SSE connection established');
        addLog('Connected to server for real-time updates');
      };
      
      // Handle regular messages
      eventSourceRef.current.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle progress updates
          if (data.type === 'progress') {
            setSSEProgress(prev => ({
              ...prev,
              current: data.current,
              total: data.total,
              percent: data.percent,
              recordsPerSecond: data.recordsPerSecond,
              elapsedSeconds: data.elapsedSeconds,
              status: `Processing records: ${data.current}/${data.total}`
            }));
          } 
          // Handle regular status messages
          else if (data.message) {
            addLog(data.message);
            setSSEProgress(prev => ({
              ...prev,
              status: data.message
            }));
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };
      
      // Handle specific events
      eventSourceRef.current.addEventListener('start', (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        addLog('Ingestion process started');
        setSSEProgress(prev => ({
          ...prev,
          status: data.message || 'Starting ingestion process'
        }));
      });
      
      eventSourceRef.current.addEventListener('complete', (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        addLog(`Ingestion completed: ${data.records_processed} records processed`);
        setSSEProgress(prev => ({
          ...prev,
          status: 'Ingestion completed successfully'
        }));
        
        // Call the onComplete callback if provided
        if (onSSEComplete) {
          onSSEComplete(data);
        }
        
        // Close the connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      });
      
      eventSourceRef.current.addEventListener('error', (event: MessageEvent) => {
        let errorData = { error: 'Unknown error occurred' };
        
        try {
          errorData = JSON.parse(event.data);
        } catch (err) {
          console.error('Error parsing error data:', err);
        }
        
        const errorMessage = errorData.error || 'Error during ingestion process';
        setSSEError(errorMessage);
        addLog(`ERROR: ${errorMessage}`);
        
        // Call the onError callback if provided
        if (onSSEError) {
          onSSEError(errorMessage);
        }
        
        // Close the connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      });
      
      // Handle ping events to keep connection alive
      eventSourceRef.current.addEventListener('ping', () => {
        console.log('Ping received from server');
      });
      
      // Handle connection errors
      eventSourceRef.current.onerror = (err) => {
        console.error('SSE connection error:', err);
        addLog('Connection error - attempting to reconnect...');
        
        // Close the connection and try to reconnect after a delay
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setTimeout(connectSSE, 5000);
      };
    };
    
    // Start the SSE connection
    connectSSE();
    
    // Cleanup function to close the connection when the component unmounts
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [useSSE, isVisible, onSSEComplete, onSSEError]);
  
  // Helper function to add a log entry with timestamp
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSSEProgress(prev => ({
      ...prev,
      logs: [...prev.logs, { timestamp, message }]
    }));
  };

  if (!isVisible) return null;

  // If using SSE, show SSE progress
  if (useSSE) {
    const progress = sseProgress.percent;
    
    return (
      <div className="w-full space-y-2 p-4 border rounded-lg bg-background">
        {sseError ? (
          <div className="text-red-500 font-medium mb-2">
            Error: {sseError}
          </div>
        ) : null}
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{sseProgress.status}</span>
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
        
        {sseProgress.total > 0 && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p>Processing Speed: {Math.round(sseProgress.recordsPerSecond)} rows/sec</p>
              <p>Records Processed: {sseProgress.current} / {sseProgress.total}</p>
            </div>
            <div>
              <p>Time Elapsed: {formatTime(sseProgress.elapsedSeconds)}</p>
              <p>
                Estimated Remaining: {
                  sseProgress.recordsPerSecond > 0 
                    ? formatTime((sseProgress.total - sseProgress.current) / sseProgress.recordsPerSecond)
                    : 'Calculating...'
                }
              </p>
            </div>
          </div>
        )}
        
        {sseProgress.logs.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Activity Log</h4>
            <div className="h-[150px] overflow-auto rounded-md border p-2 bg-muted/20 text-xs">
              {sseProgress.logs.map((log, index) => (
                <div key={index} className="py-1">
                  <span className="text-muted-foreground">{log.timestamp}</span>
                  {' - '}
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Regular progress display (non-SSE)
  const progress = (currentRow / totalRows) * 100;
  const elapsedTime = Date.now() - startTime;
  const rate = elapsedTime > 0 ? currentRow / (elapsedTime / 1000) : 0; // rows per second
  
  // Calculate estimated time for entire file
  const remainingRows = totalRows - currentRow;
  const estimatedSecondsRemaining = rate > 0 ? remainingRows / rate : 0;

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