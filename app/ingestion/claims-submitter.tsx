"use client"

import { useCallback, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UploadProgress } from "./upload-progress"
import { parse } from 'papaparse'

interface DummyClaim {
  claim_id: string
  line_id: string
  patient_id: string | null
  date_of_birth: string | null
  gender: string | null
  provider_id: string | null
  facility_id: string | null
  diagnosis_code: string | null
  procedure_code: string | null
  admission_date: string | null
  discharge_date: string | null
  revenue_code: string | null
  modifiers: string | null
  claim_type: string | null
  total_charges: number | null
  allowed_amount: number | null
}

interface ClaimsSubmitterProps {
  csvData: any[];
  mappingId: number | null;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface IngestionState {
  id: string;
  processedRows: number;
  failedRows: Array<{ row: number; error: string }>;
  status: 'in_progress' | 'failed' | 'completed';
}

interface BatchPayload {
  name: string;
  data: any[];
  mapping_id: number;
  record_count: number;
  file_size_bytes: number;
  batch_number: number;
  total_batches: number;
  parent_ingestion_id: number | null;
}

export function ClaimsSubmitter({ 
  csvData, 
  mappingId, 
  onSuccess = () => {},
  onError = () => {}
}: ClaimsSubmitterProps) {
  const [savedMappings, setSavedMappings] = useState<Array<{name: string, mappings: any}>>([]);
  const [ingestionName, setIngestionName] = useState("");
  const [uploadProgress, setUploadProgress] = useState({
    currentRow: 0,
    totalRows: 0,
    startTime: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    isVisible: false,
    currentBatch: 0,
    totalBatches: 0
  });

  const [mappingData, setMappingData] = useState<any>(null);
  useEffect(() => {
    const fetchMapping = async () => {
      if (!mappingId) return;
      try {
        const response = await fetch(`http://localhost:5000/api/mappings/${mappingId}`);
        if (response.ok) {
          const data = await response.json();
          setMappingData(data);
        }
      } catch (error) {
        console.error('Error fetching mapping:', error);
      }
    };
    fetchMapping();
  }, [mappingId]);

  useEffect(() => {
    // Fetch saved mappings when component mounts
    const fetchSavedMappings = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/mappings');
        if (response.ok) {
          const data = await response.json();
          setSavedMappings(data);
        }
      } catch (error) {
        console.error('Error fetching saved mappings:', error);
      }
    };

    fetchSavedMappings();
  }, []);

  const handleSubmitClaims = useCallback(async () => {
    if (csvData.length < 2) {
      onError("No data to submit");
      return;
    }
    if (!ingestionName.trim()) {
      onError("Please enter a name for this ingestion");
      return;
    }
    if (!mappingId || typeof mappingId !== 'number') {
      onError("Please select a mapping configuration before submitting");
      return;
    }
    if (!mappingData) {
      onError("Mapping data not loaded");
      return;
    }

    const headers = csvData[0];
    const startTime = Date.now();
    const validRows = csvData.slice(1).filter(row => 
      row.length > 1 && row.some((cell: string) => cell && cell.trim() !== '')
    );

    const BATCH_SIZE = 5000;
    const totalBatches = Math.ceil(validRows.length / BATCH_SIZE);
    
    // Initialize progress
    setUploadProgress({
      currentRow: 0,
      totalRows: validRows.length,
      startTime,
      uploadedBytes: 0,
      totalBytes: new Blob([csvData.map(row => row.join(',')).join('\n')]).size,
      isVisible: true,
      currentBatch: 0,
      totalBatches
    });

    try {
      let parentIngestionId = null;

      // Process in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, validRows.length);
        const batchRows = validRows.slice(batchStart, batchEnd);
        
        // Transform batch data
        const transformedBatch = batchRows.map(row => {
          const transformed: any = {};
          mappingData.mappings.forEach((mapping: { csvColumn: string, dbColumn: string }) => {
            const columnIndex = headers.indexOf(mapping.csvColumn);
            if (columnIndex !== -1) {
              transformed[mapping.dbColumn] = row[columnIndex];
            }
          });
          return transformed;
        });

        const batchPayload: BatchPayload = {
          name: ingestionName,
          data: transformedBatch,
          mapping_id: mappingId,
          record_count: transformedBatch.length,
          file_size_bytes: new Blob([JSON.stringify(transformedBatch)]).size,
          batch_number: batchIndex,
          total_batches: totalBatches,
          parent_ingestion_id: parentIngestionId
        };

        // Upload batch
        const response = await fetch('http://localhost:5000/api/ingested-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batchPayload),
        });

        if (!response.ok) {
          throw new Error(`Failed to submit batch ${batchIndex + 1}`);
        }

        const result = await response.json();
        
        // Store parent ID from first batch
        if (batchIndex === 0) {
          parentIngestionId = result.parent_ingestion_id;
        }

        // Update progress
        const processedRows = (batchIndex + 1) * BATCH_SIZE;
        setUploadProgress(prev => ({
          ...prev,
          currentRow: Math.min(processedRows, validRows.length),
          uploadedBytes: Math.floor((processedRows / validRows.length) * prev.totalBytes),
          currentBatch: batchIndex + 1
        }));
      }

      onSuccess();

      // Wait before hiding progress
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUploadProgress(prev => ({ 
        ...prev, 
        isVisible: false,
        currentRow: 0,
        uploadedBytes: 0
      }));

    } catch (error) {
      console.error('Error submitting claims:', error);
      onError(error instanceof Error ? error.message : 'Unknown error occurred');
      setUploadProgress(prev => ({ ...prev, isVisible: false }));
    }
  }, [csvData, mappingId, ingestionName, onError, onSuccess, mappingData]);

  const handleFileUpload = (file: File) => {
    parse<string[]>(file, {
      complete: (results) => {
        console.log(results.data);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
      }
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <div>
        <Label htmlFor="ingestion-name">Ingestion Name</Label>
        <Input
          id="ingestion-name"
          value={ingestionName}
          onChange={(e) => setIngestionName(e.target.value)}
          placeholder="Enter a name for this ingestion"
          className="mt-1"
        />
      </div>
      <UploadProgress {...uploadProgress} />
      <Button 
        onClick={handleSubmitClaims}
        disabled={uploadProgress.isVisible}
      >
        Submit Claims
      </Button>
    </div>
  );
} 