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

export function UploadProgress({ 
  currentRow: initialCurrentRow, 
  totalRows, 
  startTime: initialStartTime, 
  uploadedBytes: initialUploadedBytes, 
  totalBytes,
  isVisible,
  currentBatch = 0,
  totalBatches = 1,
  useSSE = false,
  onSSEComplete,
  onSSEError
}: UploadProgressProps) {
  // State to track progress that can be updated from SSE
  const [currentRow, setCurrentRow] = useState(initialCurrentRow);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [uploadedBytes, setUploadedBytes] = useState(initialUploadedBytes);
  const [error, setError] = useState<string | null>(null);
  
  // Reference to the SSE connection
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // Set up SSE connection if useSSE is true
  useEffect(() => {
    if (!useSSE || !isVisible) return;
    
    // Update the start time if it's not set
    if (startTime === 0) {
      setStartTime(Date.now());
    }
    
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
      };
      
      // Handle regular messages
      eventSourceRef.current.onmessage = (event: MessageEvent) => {
        try {
          // Check if event.data is undefined or empty
          if (!event.data) {
            console.warn('Received empty SSE data');
            return;
          }
          
          const data = JSON.parse(event.data);
          
          // Handle progress updates
          if (data.type === 'progress') {
            setCurrentRow(data.current || 0);
            // Estimate uploaded bytes based on progress percentage
            const estimatedBytes = Math.floor(((data.current || 0) / totalRows) * totalBytes);
            setUploadedBytes(estimatedBytes);
            
            // Check for error status
            if (data.status === 'error') {
              setError(data.message || 'An error occurred during processing');
              if (onSSEError) {
                onSSEError(data.message || 'An error occurred during processing');
              }
            }
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
          setError('Failed to parse server response');
        }
      };
      
      // Handle complete event
      eventSourceRef.current.addEventListener('complete', (event: MessageEvent) => {
        try {
          // Check if event.data is undefined or empty
          if (!event.data) {
            console.warn('Received empty complete event data');
            return;
          }
          
          const data = JSON.parse(event.data);
          
          // Update to completed state
          setCurrentRow(totalRows);
          setUploadedBytes(totalBytes);
          
          // Call the onComplete callback if provided
          if (onSSEComplete) {
            onSSEComplete(data);
          }
          
          // Close the connection
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        } catch (err) {
          console.error('Error parsing SSE complete event:', err);
          setError('Failed to parse completion data');
        }
      });
      
      // Handle error event
      eventSourceRef.current.addEventListener('error', (event: MessageEvent) => {
        let errorMessage = 'Unknown error occurred';
        
        try {
          // Check if event.data exists before trying to parse
          if (event.data) {
            const errorData = JSON.parse(event.data);
            errorMessage = errorData.error || errorData.message || errorMessage;
          }
        } catch (err) {
          console.error('Error parsing error data:', err);
        }
        
        setError(errorMessage);
        
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
      
      // Handle connection errors
      eventSourceRef.current.onerror = (err) => {
        console.error('SSE connection error:', err);
        
        // Set an error message for the user
        const errorMessage = 'Connection to server lost. Attempting to reconnect...';
        setError(errorMessage);
        
        // Call the onError callback if provided
        if (onSSEError) {
          onSSEError(errorMessage);
        }
        
        // Close the connection and try to reconnect after a delay
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
          
          // Only attempt to reconnect if the component is still mounted and SSE is still needed
          if (useSSE && isVisible) {
            setTimeout(connectSSE, 5000);
          }
        }
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
  }, [useSSE, isVisible, totalRows, totalBytes, startTime, onSSEComplete, onSSEError]);
  
  // Update local state when props change (for non-SSE mode)
  useEffect(() => {
    if (!useSSE) {
      setCurrentRow(initialCurrentRow);
      setStartTime(initialStartTime);
      setUploadedBytes(initialUploadedBytes);
    }
  }, [initialCurrentRow, initialStartTime, initialUploadedBytes, useSSE]);

  if (!isVisible) return null;

  // Calculate progress metrics
  const progress = (currentRow / totalRows) * 100;
  const elapsedTime = Date.now() - startTime;
  const rate = elapsedTime > 0 ? currentRow / (elapsedTime / 1000) : 0; // rows per second
  
  // Calculate estimated time for entire file
  const remainingRows = totalRows - currentRow;
  const estimatedSecondsRemaining = rate > 0 ? remainingRows / rate : 0;

  return (
    <div className="w-full space-y-2 p-4 border rounded-lg bg-background">
      {error && (
        <div className="text-red-500 font-medium mb-2">
          Error: {error}
        </div>
      )}
      
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