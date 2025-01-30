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
import { IngestionTable } from "./ingestion-table"
import { MappingManager } from "./mapping-manager"
import { ClaimsSubmitter } from "./claims-submitter"

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

export default function IngestionPage() {
  const [ingestions, setIngestions] = useState<Ingestion[]>([
    { id: 1, name: "Product List", type: "CSV", date: "2023-04-01" },
    { id: 2, name: "Price LUT", type: "LUT", date: "2023-04-02" },
  ])
  const [csvData, setCsvData] = useState<string[][]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [lutName, setLutName] = useState<string>("")
  const [lutData, setLutData] = useState<string>("")
  const [lutCsvData, setLutCsvData] = useState<string[][]>([])
  const [selectedMappingId, setSelectedMappingId] = useState<number | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [fileMetadata, setFileMetadata] = useState<{
    name: string;
    size: number;
    rows: number;
    columns: number;
  } | null>(null);

  const dbColumns = [
    "claim_id",
    "patient_id",
    "date_of_birth",
    "gender",
    "provider_id",
    "facility_id",
    "diagnosis_code",
    "procedure_code",
    "admission_date",
    "discharge_date",
    "revenue_code",
    "modifiers",
    "claim_type",
    "total_charges",
    "allowed_amount"
  ]

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, isLut = false) => {
    const file = event.target.files?.[0]
    if (file) {
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
      setFileMetadata(null);
    }
  }, [mappings])

  const handleMappingChange = useCallback((csvColumn: string, dbColumn: string) => {
    setMappings((prevMappings) =>
      prevMappings.map((mapping) => (mapping.csvColumn === csvColumn ? { ...mapping, dbColumn } : mapping)),
    )
  }, [])

  const handleLUTSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      // Handle LUT submission logic here
      console.log("LUT submitted", { lutName, lutData })
      // You would typically send this data to your backend here
    },
    [lutName, lutData],
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Data Ingestion</h1>

      <Tabs defaultValue="csv" className="mb-8">
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
        <TabsContent value="csv" className="border-x border-b rounded-t-none">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle>CSV Upload and Mapping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="csv-file" className="block text-sm font-medium">
                  Upload CSV File
                </Label>
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
              {csvData.length > 0 && (
                <>
                  <div className="space-y-2">
                    <MappingManager
                      csvColumns={csvData[0]}
                      dbColumns={dbColumns}
                      currentMappings={mappings}
                      onMappingChange={setMappings}
                      onMappingSelect={setSelectedMappingId}
                    />
                  </div>
                  <ClaimsSubmitter 
                    csvData={csvData}
                    mappingId={selectedMappingId}
                    onSuccess={() => {
                      alert('Claims submitted successfully');
                      setRefreshTrigger(prev => prev + 1);
                    }}
                    onError={(error: string) => {
                      alert(`Error: ${error}`);
                    }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="lut" className="border-x border-b rounded-t-none">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle>LUT Input</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label htmlFor="lut-csv-file">Upload LUT CSV File</Label>
                <FileInput id="lut-csv-file" accept=".csv" onChange={(e) => handleFileUpload(e, true)} />
              </div>
              <form onSubmit={handleLUTSubmit}>
                <div className="mb-4">
                  <Label htmlFor="lut-name">LUT Name</Label>
                  <Input
                    id="lut-name"
                    placeholder="Enter LUT name"
                    value={lutName}
                    onChange={(e) => setLutName(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <Label htmlFor="lut-data">LUT Data (one entry per line)</Label>
                  <textarea
                    id="lut-data"
                    className="w-full h-32 p-2 border rounded"
                    placeholder="Enter LUT data"
                    value={lutData}
                    onChange={(e) => setLutData(e.target.value)}
                  ></textarea>
                </div>
                <Button type="submit">Submit LUT</Button>
              </form>
              {lutCsvData.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Uploaded LUT CSV Preview</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {lutCsvData[0].map((header, index) => (
                          <TableHead key={index}>{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lutCsvData.slice(1, 6).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex}>{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {lutCsvData.length > 6 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Showing first 5 rows of {lutCsvData.length - 1} total rows
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <IngestionTable refreshTrigger={refreshTrigger} />
    </div>
  )
}

