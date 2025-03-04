"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileInput } from "@/components/ui/file-input"
import { IngestionTable } from "./components/ingestion-table"
import { MappingManager } from "./components/mapping-manager"
import { ClaimsSubmitter } from "./components/claims-submitter"

interface Ingestion {
  id: number
  name: string
  type: string
  date: string
  recordsCount?: number
}

interface Mapping {
  csvColumn: string
  dbColumn: string
}

interface SavedMapping {
  name: string
  mappings: Mapping[]
}

interface DummyClaim {
  claim_id: string
  patient_id: string
  date_of_birth: string
  gender: string
  provider_id: string
  facility_id: string
  diagnosis_code: string
  procedure_code: string
  admission_date: string
  discharge_date: string
  revenue_code: string
  modifiers: string
  claim_type: string
  total_charges: number
  allowed_amount: number
}

interface IngestionHistory {
  id: number
  name: string
  type: string
  date: string
  recordsCount: number
}

interface FileMetadata {
  name: string;
  size: number;
  rows: number;
  columns: number;
}

export default function IngestionPage() {
  const [ingestions, setIngestions] = useState<Ingestion[]>([
    { id: 1, name: "Product List", type: "CSV", date: "2023-04-01" },
    { id: 2, name: "Price LUT", type: "LUT", date: "2023-04-02" },
  ]);
  
  const [dbColumns, setDbColumns] = useState<string[]>([
    "claim_id", "patient_id", "date_of_birth", "gender", "provider_id", 
    "facility_id", "diagnosis_code", "procedure_code", "admission_date", 
    "discharge_date", "revenue_code", "modifiers", "claim_type", 
    "total_charges", "allowed_amount"
  ]);
  
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [lutCsvData, setLutCsvData] = useState<string[][]>([]);
  const [lutData, setLutData] = useState("");
  const [lutName, setLutName] = useState<string>("");
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<SavedMapping | null>(null);
  const [selectedMappingId, setSelectedMappingId] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<'csv' | 'lut'>('csv');
  
  // Add state to store the uploaded File object
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Format bytes to human readable format
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
  };

  // Restore the file upload handler
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, isLut = false) => {
    const file = event.target.files?.[0]
    if (file) {
      // Save the actual File object
      if (!isLut) {
        setUploadedFile(file);
      }
      
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const rows = content.split("\n").map((row) => row.split(","))
        if (isLut) {
          setLutCsvData(rows)
          setLutData(
            rows
              .slice(1)
              .map((row) => row.join(","))
              .join("\n"),
          )
        } else {
          setCsvData(rows)
          // Set file metadata
          setFileMetadata({
            name: file.name,
            size: file.size,
            rows: rows.length - 1, // Exclude header row
            columns: rows[0].length
          });
          setMappings(rows[0].map((header) => {
            const existingMapping = mappings.find(m => m.csvColumn === header);
            return {
              csvColumn: header,
              dbColumn: existingMapping?.dbColumn || ""
            };
          }));
        }
      }
      reader.readAsText(file)
    } else {
      if (!isLut) {
        setUploadedFile(null);
        setFileMetadata(null);
      }
    }
  }, [mappings])

  const handleMappingChange = useCallback((csvColumn: string, dbColumn: string) => {
    setMappings((prevMappings) =>
      prevMappings.map((mapping) => (mapping.csvColumn === csvColumn ? { ...mapping, dbColumn } : mapping)),
    )
  }, [])

  const handleLUTSubmit = useCallback(async () => {
    if (!lutName.trim() || !lutData.trim()) {
      alert('Please enter both name and data for the LUT');
      return;
    }

    try {
      
      const response = await fetch('/api/luts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lutName.trim(),
          data: lutData
        })
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Server error response:', responseData);
        throw new Error(responseData.details || responseData.error || 'Failed to submit LUT');
      }
      alert('LUT submitted successfully');
      setLutName('');
      setLutData('');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Full error details:', error);
      alert('Error submitting LUT: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [lutName, lutData]);

  const handleDeleteLUTs = async (ids: string[]) => {
    try {
      const response = await fetch('/api/luts/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete LUTs');
      }

      alert(ids.length === 1 ? 'LUT deleted successfully' : 'LUTs deleted successfully');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting LUTs:', error);
      alert('Error deleting LUTs: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleFilterLUTs = async (searchTerm: string) => {
    try {
      const response = await fetch(`/api/luts?search=${encodeURIComponent(searchTerm)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to filter LUTs');
      }

      // The IngestionTable component will handle the filtered data
    } catch (error) {
      console.error('Error filtering LUTs:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Data Ingestion</h1>

      <Tabs 
        defaultValue="csv" 
        className="mb-8"
        onValueChange={(value) => setActiveTab(value as 'csv' | 'lut')}
      >
        <div className="border-b border-border">
          <TabsList className="h-10 w-full bg-transparent justify-start rounded-none">
            <TabsTrigger 
              value="csv" 
              className="data-[state=active]:bg-background data-[state=active]:border-border data-[state=active]:border-b-0 data-[state=active]:shadow-none rounded-b-none px-6 border-2 border-transparent"
            >
              CSV Upload
            </TabsTrigger>
            <TabsTrigger 
              value="lut" 
              className="data-[state=active]:bg-background data-[state=active]:border-border data-[state=active]:border-b-0 data-[state=active]:shadow-none rounded-b-none px-6 border-2 border-transparent"
            >
              LUT Input
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="csv" data-value="csv" className="rounded-t-none">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle>CSV Upload and Mapping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="csv-file">Upload CSV File</Label>
                <FileInput 
                  id="csv-file" 
                  accept=".csv" 
                  onChange={(e) => handleFileUpload(e)} 
                  className="w-full"
                />
                {fileMetadata && (
                  <div className="mt-2 text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">{fileMetadata.name}</p>
                    <div className="grid grid-cols-3 gap-4">
                      <p>Size: {formatBytes(fileMetadata.size)}</p>
                      <p>Rows: {fileMetadata.rows.toLocaleString()}</p>
                      <p>Columns: {fileMetadata.columns}</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Pass the file to the ClaimsSubmitter component but don't show its upload button */}
              {uploadedFile && fileMetadata && (
                <>
                  <ClaimsSubmitter 
                    file={uploadedFile} 
                    ingestionName={fileMetadata.name.replace(/\.[^/.]+$/, "")} 
                  />
                  <div className="space-y-2">
                    <MappingManager
                      csvColumns={csvData[0]}
                      dbColumns={dbColumns}
                      currentMappings={mappings}
                      onMappingChange={setMappings}
                      onMappingSelect={setSelectedMappingId}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <div className="mt-6">
            <IngestionTable
              refreshTrigger={refreshTrigger}
              activeTab={activeTab}
              onDeleteAll={handleDeleteLUTs}
              onFilter={handleFilterLUTs}
            />
          </div>
        </TabsContent>

        <TabsContent value="lut" data-value="lut" className="border-x border-b rounded-t-none">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle>LUT Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lut-name">LUT Name</Label>
                  <Input
                    id="lut-name"
                    name="lut-name"
                    placeholder="Enter LUT name"
                    value={lutName}
                    onChange={(e) => setLutName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lut-data">LUT Data</Label>
                  <textarea
                    id="lut-data"
                    name="lut-data"
                    placeholder="Enter LUT data (comma-separated values)"
                    value={lutData}
                    onChange={(e) => setLutData(e.target.value)}
                    className="w-full h-32 p-2 rounded-md border bg-background text-foreground min-h-[80px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lut-csv-file">Upload LUT CSV File</Label>
                  <FileInput 
                    id="lut-csv-file"
                    name="lut-csv-file"
                    accept=".csv" 
                    onChange={(e) => handleFileUpload(e, true)} 
                    className="w-full"
                  />
                </div>
                <Button 
                  onClick={handleLUTSubmit}
                  disabled={!lutName.trim() || !lutData.trim()}
                  aria-label="Submit LUT"
                >
                  Submit LUT
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6">
            <IngestionTable
              refreshTrigger={refreshTrigger}
              activeTab={activeTab}
              onDeleteAll={handleDeleteLUTs}
              onFilter={handleFilterLUTs}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}


