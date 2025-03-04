"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { UploadProgress } from "./upload-progress"
import { currentConfig } from '@/app/config'
import { FileInput } from "@/components/ui/file-input"

const getApiUrl = () => currentConfig.apiUrl;

interface FileMetadata {
  name: string;
  size: number;
  rows: number;
  columns: number;
}

interface ClaimsSubmitterProps {
  onFileMetadata?: (metadata: FileMetadata) => void;
  file?: File | null;
  ingestionName?: string;
  onIngestionNameChange?: (name: string) => void;
}

export function ClaimsSubmitter({ 
  onFileMetadata,
  file,
  ingestionName: propIngestionName = "",
  onIngestionNameChange
}: ClaimsSubmitterProps) {
  const [internalFile, setInternalFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [ingestionName, setIngestionName] = useState(propIngestionName)
  const [uploadProgress, setUploadProgress] = useState({
    currentRow: 0,
    totalRows: 0,
    startTime: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    currentBatch: 0,
    totalBatches: 1,
  })
  const [showProgress, setShowProgress] = useState(false)
  const [useSSE, setUseSSE] = useState(false)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (file) setInternalFile(file);
  }, [file]);

  useEffect(() => {
    setIngestionName(propIngestionName);
  }, [propIngestionName]);

  useEffect(() => {
    if (onIngestionNameChange && ingestionName !== propIngestionName) {
      onIngestionNameChange(ingestionName);
    }
  }, [ingestionName, propIngestionName, onIngestionNameChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      setInternalFile(selectedFile)
      
      // Set default ingestion name based on file name if not set
      if (!ingestionName) {
        const fileName = selectedFile.name.replace(/\.[^/.]+$/, ""); // Remove extension
        setIngestionName(fileName);
      }
      
      // Reset progress
      setUploadProgress({
        currentRow: 0,
        totalRows: 0,
        startTime: 0,
        uploadedBytes: 0,
        totalBytes: selectedFile.size,
        currentBatch: 0,
        totalBatches: 1,
      })
      
      setShowProgress(false)
      
      // Notify parent component about file metadata if callback exists
      if (onFileMetadata) {
        // Parse the CSV to get metadata
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            const content = event.target.result.toString();
            const lines = content.split('\n');
            const headers = lines[0].split(',');
            
            onFileMetadata({
              name: selectedFile.name,
              size: selectedFile.size,
              rows: lines.length - 1, // Subtract header row
              columns: headers.length
            });
          }
        };
        reader.readAsText(selectedFile);
      }
    }
  }

  const resetForm = () => {
    setInternalFile(null)
    setIsUploading(false)
    setShowProgress(false)
    setUseSSE(false)
    setIngestionName("")
    setUploadProgress({
      currentRow: 0,
      totalRows: 0,
      startTime: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      currentBatch: 0,
      totalBatches: 1,
    })
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const currentFile = file || internalFile;
    
    if (!ingestionName.trim()) {
      toast({
        title: "Ingestion name required",
        description: "Please provide a name for this ingestion",
        variant: "destructive",
      })
      return
    }
    
    if (!currentFile) {
      toast({
        title: "File required",
        description: "Please select a file to upload",
        variant: "destructive",
      })
      return
    }
    
    setIsUploading(true)
    setShowProgress(true)
    setUseSSE(true)
    
    // Set initial progress state
    setUploadProgress(prev => ({
      ...prev,
      startTime: Date.now(),
      totalRows: 100,  // Simulated number of rows
      currentRow: 0,
      uploadedBytes: 0,
      totalBytes: currentFile.size,
    }))
    
    try {
      // Use the standard ingestion endpoint instead of test-process
      const apiUrl = `${getApiUrl()}/api/ingested-data`;
      
      // Create form data with file and name
      const formData = new FormData();
      formData.append('file', currentFile);
      formData.append('name', ingestionName);
      
      // Actual API call to the backend
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          'Accept': 'application/json',
        },
        body: formData
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to process data")
      }
      
      const data = await response.json()
      
      // Update progress with total rows from response
      setUploadProgress(prev => ({
        ...prev,
        totalRows: data.totalRows || prev.totalRows,
      }))
      
      toast({
        title: "Processing initiated",
        description: `${data.message || "Processing has been initiated successfully"}`,
      })
    } catch (error) {
      console.error("Processing error:", error)
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
      setIsUploading(false)
      setShowProgress(false)
      setUseSSE(false)
    }
  }
  
  const handleSSEComplete = (data: any) => {
    toast({
      title: "Processing complete",
      description: `Successfully processed ${data.records_processed || 'all'} records`,
    })
    setIsUploading(false)
  }
  
  const handleSSEError = (error: string) => {
    toast({
      title: "Processing error",
      description: error,
      variant: "destructive",
    })
    setIsUploading(false)
  }

  // Format bytes to human-readable format
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="bg-muted/50 pb-4">
        <CardTitle className="text-xl text-primary">Upload Claims Data</CardTitle>
        <CardDescription>
          Upload a CSV file containing claims data to be processed and stored in the database.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="ingestion-name">Ingestion Name</Label>
              <Input
                id="ingestion-name"
                placeholder="Enter a name for this ingestion"
                value={ingestionName}
                onChange={(e) => setIngestionName(e.target.value)}
                required
              />
            </div>
            
            {!file && (
              <div className="space-y-2">
                <Label htmlFor="claims-file" className="font-medium">Upload CSV File</Label>
                <FileInput
                  ref={fileInputRef}
                  id="claims-file"
                  accept=".csv"
                  onChange={handleFileChange}
                  required
                />
              </div>
            )}
          </div>
          
          {(file || internalFile) && (
            <div className="p-4 bg-muted rounded-md text-sm space-y-2">
              <p className="font-medium">Selected File</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Name:</span> {file?.name || internalFile?.name}
                </div>
                <div>
                  <span className="text-muted-foreground">Size:</span> {formatBytes((file || internalFile)?.size || 0)}
                </div>
              </div>
            </div>
          )}
          
          {showProgress && (
            <UploadProgress
              isVisible={showProgress}
              currentRow={uploadProgress.currentRow}
              totalRows={uploadProgress.totalRows}
              startTime={uploadProgress.startTime}
              uploadedBytes={uploadProgress.uploadedBytes}
              totalBytes={uploadProgress.totalBytes}
              useSSE={useSSE}
              onSSEComplete={handleSSEComplete}
              onSSEError={handleSSEError}
            />
          )}
          
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={resetForm}>
              Reset
            </Button>
            <Button type="submit" disabled={isUploading || !ingestionName || !(file || internalFile)}>
              {isUploading ? "Processing..." : "Upload & Process"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Add TypeScript interface for props
ClaimsSubmitter.defaultProps = {
  onFileMetadata: null
}; 