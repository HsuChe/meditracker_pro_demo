"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2 } from "lucide-react"

interface Mapping {
  csvColumn: string
  dbColumn: string
}

interface SavedMapping {
  id: number
  name: string
  mappings: Mapping[]
  is_in_use: boolean
  created_at: string
  last_used: string | null
}

interface MappingManagerProps {
  csvColumns: string[]
  dbColumns: string[]
  currentMappings: Mapping[]
  onMappingChange: (mappings: Mapping[]) => void
  onMappingSelect: (mappingId: number | null) => void
}

export function MappingManager({ csvColumns, dbColumns, currentMappings, onMappingChange, onMappingSelect }: MappingManagerProps) {
  const [savedMappings, setSavedMappings] = useState<Array<{id: number, name: string, mappings: Mapping[]}>>([]);
  const [newMappingName, setNewMappingName] = useState("");
  const [selectedMapping, setSelectedMapping] = useState<string>("");
  const [availableDbColumns, setAvailableDbColumns] = useState<string[]>(dbColumns);

  // Fetch saved mappings when component mounts
  useEffect(() => {
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

  // Add this useEffect to fetch database columns
  useEffect(() => {
    const fetchDbColumns = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/db-columns');
        if (response.ok) {
          const columns = await response.json();
          setAvailableDbColumns(columns);
        }
      } catch (error) {
        console.error('Error fetching database columns:', error);
        // Fallback to props if API fails
        setAvailableDbColumns(dbColumns);
      }
    };

    fetchDbColumns();
  }, [dbColumns]);

  // Handle loading a saved mapping
  const handleLoadMapping = useCallback((mappingId: string) => {
    const mapping = savedMappings.find(m => m.id.toString() === mappingId);
    if (mapping) {
      onMappingChange(mapping.mappings);
      setSelectedMapping(mappingId);
      onMappingSelect(mapping.id);
    }
  }, [savedMappings, onMappingChange, onMappingSelect]);

  // Handle saving a new mapping
  const handleSaveMapping = useCallback(async () => {
    if (!newMappingName.trim()) {
      alert('Please enter a name for the mapping');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMappingName.trim(),
          mappings: currentMappings
        })
      });

      if (response.ok) {
        const newMapping = await response.json();
        setSavedMappings(prev => [...prev, newMapping]);
        setNewMappingName("");
        alert('Mapping saved successfully');
      } else {
        throw new Error('Failed to save mapping');
      }
    } catch (error) {
      console.error('Error saving mapping:', error);
      alert('Error saving mapping');
    }
  }, [newMappingName, currentMappings]);

  // Delete mapping
  const handleDeleteMapping = useCallback(async (mappingId: number) => {
    try {
      const mapping = savedMappings.find(m => m.id === mappingId);
      if (mapping?.is_in_use) {
        alert('Cannot delete mapping that is currently in use');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/mappings/${mappingId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSavedMappings(prev => prev.filter(m => m.id !== mappingId));
        if (selectedMapping === mappingId.toString()) {
          setSelectedMapping("");
        }
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
    }
  }, [savedMappings, selectedMapping]);

  // Sort the currentMappings array alphabetically by csvColumn
  const sortedMappings = [...currentMappings].sort((a, b) => 
    a.csvColumn.localeCompare(b.csvColumn)
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Load Saved Mapping Column */}
        <div className="space-y-2">
          <Label htmlFor="saved-mapping" className="block text-sm font-medium">
            Load Saved Mapping
          </Label>
          <Select onValueChange={handleLoadMapping}>
            <SelectTrigger id="saved-mapping" className="w-full">
              <SelectValue placeholder="Select a saved mapping" />
            </SelectTrigger>
            <SelectContent>
              {savedMappings.map((mapping) => (
                <SelectItem key={mapping.id} value={mapping.id.toString()}>
                  {mapping.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Save Current Mapping Column */}
        <div className="space-y-2">
          <Label htmlFor="new-mapping-name" className="block text-sm font-medium">
            Save Current Mapping
          </Label>
          <div className="flex gap-1.5 items-center">
            <Input
              id="new-mapping-name"
              value={newMappingName}
              onChange={(e) => setNewMappingName(e.target.value)}
              placeholder="Enter mapping name"
              className="flex-1"
            />
            <Button onClick={handleSaveMapping} className="-ml-0.5">
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Mapping Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CSV Column</TableHead>
            <TableHead>Database Column</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMappings.map((mapping, index) => (
            <TableRow key={mapping.csvColumn}>
              <TableCell>{mapping.csvColumn}</TableCell>
              <TableCell>
                <Select
                  value={mapping.dbColumn}
                  onValueChange={(value) => {
                    // Find the original index in currentMappings
                    const originalIndex = currentMappings.findIndex(
                      m => m.csvColumn === mapping.csvColumn
                    );
                    const newMappings = [...currentMappings];
                    newMappings[originalIndex] = { ...mapping, dbColumn: value };
                    onMappingChange(newMappings);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select database column" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDbColumns.map((column) => (
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
    </div>
  );
} 