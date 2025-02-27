"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { UploadProgress } from "./upload-progress"
import { currentConfig } from '@/app/config'

const getApiUrl = () => currentConfig.apiUrl;

export function ClaimsSubmitter() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      
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
    }
  }

  const resetForm = () => {
    setFile(null)
    setIsUploading(false)
    setShowProgress(false)
    setUseSSE(false)
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
    
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload",
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
      totalRows: 0,  // Will be updated from server
      currentRow: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
    }))
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      
      // Start the upload
      const response = await fetch(`${getApiUrl()}/api/ingested-data/upload`, {
        method: "POST",
        body: formData,
        headers: {
          // Add Accept header for SSE
          'Accept': 'application/json',
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to upload file")
      }
      
      const data = await response.json()
      
      // Update progress with total rows from response
      setUploadProgress(prev => ({
        ...prev,
        totalRows: data.totalRows || prev.totalRows,
      }))
      
      toast({
        title: "Upload successful",
        description: `${data.message || "File has been uploaded and processed successfully"}`,
      })
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Claims Data</CardTitle>
        <CardDescription>
          Upload a CSV file containing claims data to be processed and stored in the database.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="file">Claims CSV File</Label>
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </div>
          </div>
          <div className="mt-6">
            <UploadProgress
              currentRow={uploadProgress.currentRow}
              totalRows={uploadProgress.totalRows}
              startTime={uploadProgress.startTime}
              uploadedBytes={uploadProgress.uploadedBytes}
              totalBytes={uploadProgress.totalBytes}
              isVisible={showProgress}
              currentBatch={uploadProgress.currentBatch}
              totalBatches={uploadProgress.totalBatches}
              useSSE={useSSE}
              onSSEComplete={handleSSEComplete}
              onSSEError={handleSSEError}
            />
          </div>
          <div className="flex justify-between mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={resetForm}
              disabled={isUploading}
            >
              Reset
            </Button>
            <Button 
              type="submit" 
              disabled={!file || isUploading}
            >
              {isUploading ? "Processing..." : "Upload & Process"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
} 