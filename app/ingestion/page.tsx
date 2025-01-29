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

interface Ingestion {
  id: number
  name: string
  type: string
  date: string
}

interface Mapping {
  csvColumn: string
  dbColumn: string
}

interface SavedMapping {
  name: string
  mappings: Mapping[]
}

export default function IngestionPage() {
  const [ingestions, setIngestions] = useState<Ingestion[]>([
    { id: 1, name: "Product List", type: "CSV", date: "2023-04-01" },
    { id: 2, name: "Price LUT", type: "LUT", date: "2023-04-02" },
  ])
  const [csvData, setCsvData] = useState<string[][]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([])
  const [selectedMapping, setSelectedMapping] = useState<string>("")
  const [newMappingName, setNewMappingName] = useState<string>("")
  const [lutName, setLutName] = useState<string>("")
  const [lutData, setLutData] = useState<string>("")
  const [lutCsvData, setLutCsvData] = useState<string[][]>([])

  const dbColumns = ["id", "name", "price", "category", "description"] // Example database columns

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
          setMappings(rows[0].map((header) => ({ csvColumn: header, dbColumn: "" })))
        }
      }
      reader.readAsText(file)
    }
  }, [])

  const handleMappingChange = useCallback((csvColumn: string, dbColumn: string) => {
    setMappings((prevMappings) =>
      prevMappings.map((mapping) => (mapping.csvColumn === csvColumn ? { ...mapping, dbColumn } : mapping)),
    )
  }, [])

  const handleSaveMapping = useCallback(() => {
    if (newMappingName) {
      setSavedMappings((prevMappings) => [...prevMappings, { name: newMappingName, mappings }])
      setNewMappingName("")
    }
  }, [newMappingName, mappings])

  const handleLoadMapping = useCallback(
    (mappingName: string) => {
      const mapping = savedMappings.find((m) => m.name === mappingName)
      if (mapping) {
        setMappings(mapping.mappings)
        setSelectedMapping(mappingName)
      }
    },
    [savedMappings],
  )

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
        <TabsList>
          <TabsTrigger value="csv">CSV Upload</TabsTrigger>
          <TabsTrigger value="lut">LUT Input</TabsTrigger>
        </TabsList>
        <TabsContent value="csv">
          <Card>
            <CardHeader>
              <CardTitle>CSV Upload and Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label htmlFor="csv-file">Upload CSV File</Label>
                <FileInput id="csv-file" accept=".csv" onChange={(e) => handleFileUpload(e)} />
              </div>
              {csvData.length > 0 && (
                <>
                  <div className="mb-4">
                    <Label htmlFor="saved-mappings">Load Saved Mapping</Label>
                    <Select value={selectedMapping} onValueChange={handleLoadMapping}>
                      <SelectTrigger id="saved-mappings">
                        <SelectValue placeholder="Select a saved mapping" />
                      </SelectTrigger>
                      <SelectContent>
                        {savedMappings.map((mapping) => (
                          <SelectItem key={mapping.name} value={mapping.name}>
                            {mapping.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CSV Column</TableHead>
                        <TableHead>Database Column</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.map((mapping) => (
                        <TableRow key={mapping.csvColumn}>
                          <TableCell>{mapping.csvColumn}</TableCell>
                          <TableCell>
                            <Select
                              value={mapping.dbColumn}
                              onValueChange={(value) => handleMappingChange(mapping.csvColumn, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select database column" />
                              </SelectTrigger>
                              <SelectContent>
                                {dbColumns.map((column) => (
                                  <SelectItem key={column} value={column}>
                                    {column}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex items-center gap-4">
                    <Input
                      placeholder="Enter mapping name"
                      value={newMappingName}
                      onChange={(e) => setNewMappingName(e.target.value)}
                    />
                    <Button onClick={handleSaveMapping}>Save Mapping</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="lut">
          <Card>
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

      <h2 className="text-2xl font-semibold mb-4">Ingested Data</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingestions.map((ingestion) => (
            <TableRow key={ingestion.id}>
              <TableCell>{ingestion.name}</TableCell>
              <TableCell>{ingestion.type}</TableCell>
              <TableCell>{ingestion.date}</TableCell>
              <TableCell>
                <Button variant="outline" size="sm" className="mr-2">
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  size="sm"
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

