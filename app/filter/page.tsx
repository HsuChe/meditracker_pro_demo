"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { DragEndEvent } from "@dnd-kit/core"
import { FilterKey, FilterCondition, SavedFilter, ClaimData, Statistics, ColumnInfo, ColumnTypeResponse } from "./types"
import { formatColumnName } from "./utils"
import StatisticsPanel from "./components/Statistics"
import FilterKeys from "./components/FiltersKeys"
import ClaimsTable from "./components/ClaimsTable"
import SaveFilterDialog from "./components/SaveFilterDialog"
import SavedFiltersSelect from "./components/SaveFilterSelect"

interface IngestedDataRecord {
  type: string;
  name: string;
  ingested_data_id: number;
}

interface IngestedDataResponse {
  records: IngestedDataRecord[];
}

interface LUTRecord {
  ingested_data_id: number;
  name: string;
  activity_status: string;
  type: string;
}

export default function FilterPage() {
  // State declarations
  const [filterName, setFilterName] = useState("")
  const [filterDescription, setFilterDescription] = useState("")
  const [filterKeys, setFilterKeys] = useState<FilterKey[]>([{
    id: "root",
    key: "root",
    label: "Root",
    type: "group",
    keyType: null,
    keyColumn: "",
    conditions: [],
    children: [{
      id: "group1",
      key: "main",
      label: "Main Filter",
      type: "group",
      keyType: 'main',
      keyColumn: 'claim_id',
      conditions: [{
        id: "condition1",
        key: "claim_id",
        column: "",
        operator: "equals",
        value: null
      }],
      children: []
    }]
  }])
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
  const [claims, setClaims] = useState<ClaimData[]>([])
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [lutNames, setLutNames] = useState<string[]>([])
  const [ingestedData, setIngestedData] = useState<IngestedDataResponse>({ records: [] })
  const [diagnosisCodes, setDiagnosisCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Memoize the ingested IDs array
  const ingestedLutIds = useMemo(() => 
    ingestedData.records
      .filter((record: any) => record.type === 'lut')
      .map((record: any) => record.ingested_data_id),
    [ingestedData.records] // Only recompute when records change
  );

  // Load initial data
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true)
        
        const [claimsResponse, columnTypesResponse, ingestedDataResponse] = await Promise.all([
          fetch(`http://localhost:5000/api/filters/claims?page=1&limit=${pageSize}`),
          fetch('http://localhost:5000/api/filters/claimsDtype'),
          fetch('http://localhost:5000/api/luts')
        ])

        if (!claimsResponse.ok || !columnTypesResponse.ok || !ingestedDataResponse.ok) {
          throw new Error('Failed to fetch initial data')
        }

        const claimsData = await claimsResponse.json()
        const columnTypes = await columnTypesResponse.json() as ColumnTypeResponse
        const lutsData = await ingestedDataResponse.json()

        // Set ingested data with the correct structure
        setIngestedData({ records: lutsData.records || [] });

        // Get LUT records that are active and their IDs
        const activeLUTRecords = lutsData.records.filter((record: LUTRecord) => record.activity_status === 'active');
        const activeIngestedIds = activeLUTRecords.map((lut: LUTRecord) => lut.ingested_data_id);
        
        // Fetch diagnosis codes using the diagnosis-codes endpoint
        const diagnosisCodesResponse = await fetch('http://localhost:5000/api/filters/diagnosis-codes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ingestedIds: activeIngestedIds
          })
        });

        if (diagnosisCodesResponse.ok) {
          const diagnosisCodesData = await diagnosisCodesResponse.json();
          
          if (diagnosisCodesData.success) {
            setDiagnosisCodes(diagnosisCodesData.data);
          }
        }

        // Get unique names of LUT records
        const uniqueClaimsNames = Array.from(new Set<string>(
          activeLUTRecords.map((record: LUTRecord) => record.name)
        ));
        
        setLutNames(uniqueClaimsNames);

        if (claimsData.claims && claimsData.claims.length > 0) {
          setClaims(claimsData.claims)
          setTotalRecords(claimsData.pagination.total)
          setStatistics({
            uniqueClaimIds: claimsData.statistics.uniqueClaimIds,
            dateRange: claimsData.statistics.dateRange,
            totalAllowedAmount: claimsData.statistics.totalAllowedAmount,
            totalRecords: claimsData.statistics.totalRecords,
          })

          const columnInfo: ColumnInfo[] = columnTypes.data
            .map(({ column, type }) => ({
              column,
              name: column,
              displayName: formatColumnName(column),
              dataType: type
            }))
            .sort((a, b) => {
              if (a.name === 'claim_id') return -1;
              if (b.name === 'claim_id') return 1;
              if (a.name === 'line_id') return -1;
              if (b.name === 'line_id') return 1;
              return a.displayName.localeCompare(b.displayName);
            });

          setColumns(columnInfo)
          setIsInitialized(true)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    initializeData()
  }, [])

  // Load saved filters
  const fetchSavedFilters = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/filters/saved');
      if (!response.ok) {
        throw new Error('Failed to fetch saved filters');
      }
      const data: SavedFilter[] = await response.json();
      setSavedFilters(data);

      // If any filters were cleaned up (have different claims_ids), show a notification
      const cleanedFilters = data.filter(filter => 
        filter.last_updated && new Date(filter.last_updated).getTime() > Date.now() - 5000
      );
      
      if (cleanedFilters.length > 0) {
        alert(`Some filters were updated to remove references to deleted claims: ${
          cleanedFilters.map(f => f.name).join(', ')
        }`);
      }
    } catch (error) {
      console.error('Error fetching saved filters:', error);
      alert('Error fetching saved filters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedFilters();
  }, []);

  // Early return for initialization
  if (!isInitialized) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Handler functions
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        const activeIndex = key.conditions.findIndex((c) => c.id === active.id);
        const overIndex = key.conditions.findIndex((c) => c.id === over.id);

        if (activeIndex !== -1 && overIndex !== -1) {
          const newConditions = [...key.conditions];
          const [movedCondition] = newConditions.splice(activeIndex, 1);
          newConditions.splice(overIndex, 0, movedCondition);
          return { ...key, conditions: newConditions };
        }

        return { ...key, children: key.children.map(updateKey) };
      };

      return keys.map(updateKey);
    });
  }

  const handleUpdateKeyColumn = (keyId: string, column: string) => {
    setFilterKeys(prevKeys => {
      const updateKeyInTree = (keys: FilterKey[]): FilterKey[] => {
        return keys.map(key => {
          if (key.id === keyId) {
            return {
              ...key,
              keyColumn: column
            };
          }
          if (key.children.length > 0) {
            return {
              ...key,
              children: updateKeyInTree(key.children)
            };
          }
          return key;
        });
      };

      return updateKeyInTree(prevKeys);
    });
  }

  const handleAddCondition = (keyId: string) => {
    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        if (key.id === keyId) {
          return {
            ...key,
            conditions: [
              ...key.conditions,
              {
                id: `condition${key.conditions.length + 1}`,
                key: key.keyColumn,
                column: "",
                operator: "equals",
                value: null
              }
            ]
          };
        }
        return { ...key, children: key.children.map(updateKey) };
      };
      return keys.map(updateKey);
    });
  };

  const handleRemoveCondition = (keyId: string, conditionId: string) => {
    setFilterKeys((keys) => {
      const updateKey = (key: FilterKey): FilterKey => {
        if (key.id === keyId) {
          if (key.conditions.length <= 1) {
            return key;
          }
          return {
            ...key,
            conditions: key.conditions.filter((condition) => condition.id !== conditionId)
          };
        }
        return {
          ...key,
          children: key.children.map(updateKey)
        };
      };
      return keys.map(updateKey);
    });
  }

  const handleConditionChange = (keyId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    console.log('Filter Condition Update:', {
      keyId,
      conditionId,
      updates,
      currentFilterState: filterKeys
    });
    
    setFilterKeys(prevKeys => {
      const updateCondition = (keys: FilterKey[], keyId: string, conditionId: string, updates: Partial<FilterCondition>): FilterKey[] => {
        return keys.map(key => {
          if (key.id === keyId) {
            return {
              ...key,
              conditions: key.conditions.map(condition =>
                condition.id === conditionId
                  ? { ...condition, ...updates }
                  : condition
              )
            };
          }
          if (key.children.length > 0) {
            return {
              ...key,
              children: updateCondition(key.children, keyId, conditionId, updates)
            };
          }
          return key;
        });
      };
      return updateCondition(prevKeys, keyId, conditionId, updates);
    });
  };

  const handleAddKey = (parentId: string, keyType: 'main' | 'sub') => {
    setFilterKeys((keys) => {
      const newKeyId = `group${Date.now()}`;
      const newKey: FilterKey = {
        id: newKeyId,
        key: keyType === 'main' ? 'claim_id' : 'sub_key',
        label: keyType === 'main' ? 'Main Filter' : 'Sub Filter',
        type: 'group',
        keyType,
        keyColumn: keyType === 'main' ? 'claim_id' : '',
        conditions: [],
        children: []
      };

      const addKeyToParent = (key: FilterKey): FilterKey => {
        if (key.id === parentId) {
          return {
            ...key,
            children: [...key.children, newKey]
          };
        }
        return {
          ...key,
          children: key.children.map(addKeyToParent)
        };
      };

      return keys.map(addKeyToParent);
    });
  };

  const handleRemoveKey = (keyId: string) => {
    setFilterKeys((keys) => {
      const removeKeyFromChildren = (children: FilterKey[]): FilterKey[] => {
        return children
          .filter((child) => child.id !== keyId)
          .map((child) => ({
            ...child,
            children: removeKeyFromChildren(child.children),
          }))
      }
      return keys
        .filter((key) => key.id !== keyId)
        .map((key) => ({
          ...key,
          children: removeKeyFromChildren(key.children),
        }))
    })
  }

  const handleSaveFilter = async () => {
    if (!filterName) {
      alert("Please enter a filter name before saving.");
      return;
    }

    try {
      const conditions = filterKeys[0].children.flatMap((mainKey: FilterKey) => {
        const mainConditions = mainKey.conditions.map((condition: FilterCondition) => ({
          key: 'Claim Id',
          column: condition.column,
          operator: condition.operator,
          value: condition.value,
          secondValue: condition.secondValue
        }));

        const subConditions = mainKey.children.flatMap((subKey: FilterKey) => 
          subKey.conditions.map((condition: FilterCondition) => ({
            key: `Sub Key: ${subKey.keyColumn}`,
            column: condition.column,
            operator: condition.operator,
            value: condition.value,
            secondValue: condition.secondValue
          }))
        );

        return [...mainConditions, ...subConditions];
      });

      const payload = {
        name: filterName,
        description: filterDescription,
        conditions: conditions,
        is_favorite: false,
        created_by: "system"
      };

      const response = await fetch('http://localhost:5000/api/filters/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const savedFilter = await response.json();

      const newSavedFilter: SavedFilter = {
        filter_id: savedFilter.filter_id,
        name: filterName,
        description: savedFilter.description || '',
        conditions: savedFilter.conditions || [],
        claims_ids: savedFilter.claims_ids || [],
        is_favorite: savedFilter.is_favorite || false,
        created_by: savedFilter.created_by || 'system',
        last_updated: savedFilter.last_updated || new Date().toISOString(),
        run_count: savedFilter.run_count,
        last_run: savedFilter.last_run
      };
      
      setSavedFilters([...savedFilters, newSavedFilter]);
      setIsSaveDialogOpen(false);
      setFilterDescription("");
      
      alert(`Filter "${filterName}" has been saved with ${savedFilter.matched_claims_count} matching claims.`);
    } catch (error) {
      console.error('Error saving filter:', error);
      alert(error instanceof Error ? error.message : 'Failed to save filter');
    }
  }

  const handleLoadFilter = async (filterName: string) => {
    const filter = savedFilters.find((f) => f.name === filterName);
    if (!filter) return;

    try {
      setIsLoading(true);
      setFilterName(filter.name);
      setFilterDescription(filter.description || '');
      setSelectedFilter(filterName);

      const response = await fetch(`http://localhost:5000/api/filters/execute/${filter.filter_id}`);

      if (!response.ok) {
        throw new Error('Failed to load saved filter data');
      }

      const data = await response.json();
      
      setClaims(data.claims);
      setStatistics({
        uniqueClaimIds: data.statistics.uniqueClaimIds,
        dateRange: data.statistics.dateRange,
        totalAllowedAmount: data.statistics.totalAllowedAmount,
        totalRecords: data.statistics.totalRecords,
      });

      if (data.savedFilterData?.conditions) {
        const conditions = data.savedFilterData.conditions;
        
        const newFilterKeys: FilterKey[] = [{
          id: "root",
          key: "root",
          label: "Root",
          type: "group",
          keyType: null,
          keyColumn: "",
          conditions: [],
          children: [{
            id: "group1",
            key: "main",
            label: "Main Filter",
            type: "group",
            keyType: 'main',
            keyColumn: 'claim_id',
            conditions: conditions
              .filter((c: any) => c.key === 'Claim Id')
              .map((c: any, index: number) => ({
                id: `condition${index + 1}`,
                column: c.column,
                operator: c.operator,
                value: c.value,
                secondValue: c.secondValue
              })),
            children: []
          }]
        }];

        const subKeyConditions = conditions.filter((c: any) => c.key.startsWith('Sub Key:'));
        if (subKeyConditions.length > 0) {
          const subKeyGroups = subKeyConditions.reduce((acc: any, c: any) => {
            const keyColumn = c.key.split(': ')[1];
            if (!acc[keyColumn]) {
              acc[keyColumn] = [];
            }
            acc[keyColumn].push(c);
            return acc;
          }, {});

          Object.entries(subKeyGroups).forEach(([keyColumn, conditions], index) => {
            newFilterKeys[0].children[0].children.push({
              id: `subgroup${index + 1}`,
              key: "sub",
              label: "Sub Filter",
              type: "group",
              keyType: 'sub',
              keyColumn: keyColumn,
              conditions: (conditions as any[]).map((c, condIndex) => ({
                id: `subcondition${index + 1}_${condIndex + 1}`,
                key: keyColumn,
                column: c.column,
                operator: c.operator,
                value: c.value,
                secondValue: c.secondValue
              })),
              children: []
            });
          });
        }

        setFilterKeys(newFilterKeys);
      }
    } catch (error) {
      console.error('Error loading saved filter:', error);
      alert(error instanceof Error ? error.message : 'Failed to load filter');
    } finally {
      setIsLoading(false);
    }
  }

  const handleApplyFilter = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const conditions = filterKeys[0].children.flatMap((mainKey: FilterKey) => {
        const mainConditions = mainKey.conditions
          .filter(c => c.column && c.operator)
          .map(condition => {
            // Handle between_date operator
            if (condition.operator === 'between_date') {
              const formattedCondition = {
                key: 'Claim Id',
                column: condition.column,
                operator: condition.operator,
                value: condition.value === 'today' ? new Date().toISOString() : condition.value,
                secondValue: condition.secondValue
              };
              console.log('Formatted between_date condition:', formattedCondition);
              return formattedCondition;
            }
            
            return {
              key: 'Claim Id',
              column: condition.column,
              operator: condition.operator,
              value: condition.value,
              secondValue: condition.secondValue
            };
          });

        const subConditions = mainKey.children.flatMap((subKey: FilterKey) => 
          subKey.conditions
            .filter(c => c.column && c.operator)
            .map(condition => {
              // Handle between_date operator for sub conditions
              if (condition.operator === 'between_date') {
                const formattedSubCondition = {
                  key: `Sub Key: ${subKey.keyColumn}`,
                  column: condition.column,
                  operator: condition.operator,
                  value: condition.value === 'today' ? new Date().toISOString() : condition.value,
                  secondValue: condition.secondValue
                };
                console.log('Formatted between_date sub-condition:', formattedSubCondition);
                return formattedSubCondition;
              }

              return {
                key: `Sub Key: ${subKey.keyColumn}`,
                column: condition.column,
                operator: condition.operator,
                value: condition.value,
                secondValue: condition.secondValue
              };
            })
        );

        return [...mainConditions, ...subConditions];
      });

      console.log('=== Filter Request Details ===');
      console.log('Original filter keys:', JSON.stringify(filterKeys, null, 2));
      console.log('Processed conditions:', JSON.stringify(conditions, null, 2));

      const payload = {
        name: filterName,
        description: filterDescription,
        conditions: conditions,
        page: page,
        limit: pageSize
      };

      console.log('Sending payload to server:', JSON.stringify(payload, null, 2));

      const response = await fetch('http://localhost:5000/api/filters/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error response:', errorData);
        throw new Error(errorData.message || 'Failed to apply filter');
      }

      const data = await response.json();
      console.log('Server response:', JSON.stringify(data, null, 2));

      setClaims(data.claims);
      setStatistics({
        uniqueClaimIds: data.statistics.uniqueClaimIds,
        dateRange: data.statistics.dateRange,
        totalAllowedAmount: data.statistics.totalAllowedAmount,
        totalRecords: data.statistics.totalRecords,
      });

      setSelectedFilter(null);
    } catch (error) {
      console.error('Error applying filter:', error);
      setError(error instanceof Error ? error.message : 'Failed to apply filter');
    } finally {
      setIsLoading(false);
    }
  }

  const handleResetFilter = () => {
    setFilterName("");
    setFilterKeys([{
      id: "root",
      key: "root",
      label: "Root",
      type: "group",
      keyType: null,
      keyColumn: "",
      conditions: [],
      children: [{
        id: "group1",
        key: "main",
        label: "Main Filter",
        type: "group",
        keyType: 'main',
        keyColumn: 'claim_id',
        conditions: [{
          id: "condition1",
          key: "claim_id",
          column: "",
          operator: "equals",
          value: null
        }],
        children: []
      }]
    }]);
    setSelectedFilter(null);
    setPage(1);
  }

  const handlePageChange = async (newPage: number) => {
    try {
      setIsLoading(true);
      
      const conditions = filterKeys[0].children.flatMap((mainKey: FilterKey) => {
        const mainConditions = mainKey.conditions
          .filter(c => c.column && c.operator)
          .map(condition => ({
            key: 'Claim Id',
            column: condition.column,
            operator: condition.operator,
            value: condition.value,
            secondValue: condition.secondValue
          }));

        const subConditions = mainKey.children.flatMap((subKey: FilterKey) => 
          subKey.conditions
            .filter(c => c.column && c.operator)
            .map(condition => ({
              key: `Sub Key: ${subKey.keyColumn}`,
              column: condition.column,
              operator: condition.operator,
              value: condition.value,
              secondValue: condition.secondValue
            }))
        );

        return [...mainConditions, ...subConditions];
      });

      const payload = {
        name: filterName,
        description: filterDescription,
        conditions: conditions,
        page: newPage,
        limit: pageSize
      };

      const response = await fetch('http://localhost:5000/api/filters/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch page');
      }

      const data = await response.json();
      
      setClaims(data.claims);
      setPage(newPage);
      setStatistics({
        uniqueClaimIds: data.statistics.uniqueClaimIds,
        dateRange: data.statistics.dateRange,
        totalAllowedAmount: data.statistics.totalAllowedAmount,
        totalRecords: data.statistics.totalRecords,
      });
    } catch (error) {
      console.error('Error changing page:', error);
      setError(error instanceof Error ? error.message : 'Failed to change page');
    } finally {
      setIsLoading(false);
    }
  }

  const handlePageSizeChange = async (newSize: number) => {
    try {
      setIsLoading(true);

      const conditions = filterKeys[0].children.flatMap((mainKey: FilterKey) => {
        const mainConditions = mainKey.conditions
          .filter(c => c.column && c.operator)
          .map(condition => ({
            key: 'Claim Id',
            column: condition.column,
            operator: condition.operator,
            value: condition.value,
            secondValue: condition.secondValue
          }));

        const subConditions = mainKey.children.flatMap((subKey: FilterKey) => 
          subKey.conditions
            .filter(c => c.column && c.operator)
            .map(condition => ({
              key: `Sub Key: ${subKey.keyColumn}`,
              column: condition.column,
              operator: condition.operator,
              value: condition.value,
              secondValue: condition.secondValue
            }))
        );

        return [...mainConditions, ...subConditions];
      });

      const payload = {
        name: filterName,
        description: filterDescription,
        conditions: conditions,
        page: 1,
        limit: newSize
      };

      const response = await fetch('http://localhost:5000/api/filters/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update page size');
      }

      const data = await response.json();
      
      setClaims(data.claims);
      setPageSize(newSize);
      setPage(1);
      setStatistics({
        uniqueClaimIds: data.statistics.uniqueClaimIds,
        dateRange: data.statistics.dateRange,
        totalAllowedAmount: data.statistics.totalAllowedAmount,
        totalRecords: data.statistics.totalRecords,
      });
    } catch (error) {
      console.error('Error changing page size:', error);
      setError(error instanceof Error ? error.message : 'Failed to change page size');
    } finally {
      setIsLoading(false);
    }
  }

  const handleToggleRowExpansion = (claimId: string) => {
    setExpandedRows(current => {
      const newSet = new Set(current);
      if (newSet.has(claimId)) {
        newSet.delete(claimId);
      } else {
        newSet.add(claimId);
      }
      return newSet;
    });
  }

  const handleDeleteFilter = async (filterName: string) => {
    if (!confirm(`Are you sure you want to delete the filter "${filterName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/filters/${filterName}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete filter');
      }

      // Refresh the filters list
      fetchSavedFilters();
      
      // Clear selection if the deleted filter was selected
      if (selectedFilter === filterName) {
        setSelectedFilter(null);
      }
    } catch (error) {
      console.error('Error deleting filter:', error);
      alert('Error deleting filter');
    }
  };

  const handleDeleteAllFilters = async () => {
    if (confirm('Are you sure you want to delete ALL saved filters? This cannot be undone.')) {
      try {
        const response = await fetch('http://localhost:5000/api/filters/saved', {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete all filters');
        }

        // Clear the local state
        setSavedFilters([]);
        setSelectedFilter(null);
      } catch (error) {
        console.error('Error deleting all filters:', error);
        setError('Failed to delete all filters');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 bg-background text-foreground">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Filter Builder</h1>
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={() => setIsSaveDialogOpen(true)}
            disabled={!filterKeys[0].children.length}
          >
            Save Filter
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAllFilters}
            disabled={!savedFilters.length}
          >
            Delete All Filters
          </Button>
        </div>
      </div>

      <SavedFiltersSelect
        savedFilters={savedFilters}
        selectedFilter={selectedFilter}
        onFilterSelect={handleLoadFilter}
        onDeleteFilter={handleDeleteFilter}
      />

      <div className="mb-8">
        <Label htmlFor="filter-name">Filter Name</Label>
        <Input
          id="filter-name"
          placeholder="Enter filter name"
          className="mb-4 bg-background text-foreground"
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
        />
      </div>

      <FilterKeys
        filterKeys={filterKeys}
        columns={columns}
        onAddCondition={handleAddCondition}
        onRemoveCondition={handleRemoveCondition}
        onAddKey={handleAddKey}
        onRemoveKey={handleRemoveKey}
        onConditionChange={handleConditionChange}
        onDragEnd={handleDragEnd}
        onUpdateKeyColumn={handleUpdateKeyColumn}
        lutNames={lutNames}
        ingestedIds={ingestedLutIds}
      />

      <div className="flex gap-4 mb-8">
        <Button onClick={handleApplyFilter}>Apply Filter</Button>
        <Button variant="outline" onClick={handleResetFilter}>
          Reset Filter
        </Button>
        <Button variant="secondary" onClick={() => setIsSaveDialogOpen(true)}>
          Save Filter
        </Button>
      </div>

      <StatisticsPanel statistics={statistics} />

      <ClaimsTable
        claims={claims}
        columns={columns}
        page={page}
        pageSize={pageSize}
        statistics={statistics}
        expandedRows={expandedRows}
        isLoading={isLoading}
        error={error}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onToggleRowExpansion={handleToggleRowExpansion}
      />

      <SaveFilterDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        filterName={filterName}
        description={filterDescription}
        onNameChange={setFilterName}
        onDescriptionChange={setFilterDescription}
        onSave={handleSaveFilter}
      />
    </div>
  )
}