"use client"

import React, { useState, useEffect } from "react"
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

export default function FilterPage() {
  // State declarations
  const [filterName, setFilterName] = useState("")
  const [filterDescription, setFilterDescription] = useState("")
  const [filterKeys, setFilterKeys] = useState<FilterKey[]>([{
    id: "root",
    keyType: null,
    keyColumn: "",
    conditions: [],
    children: [{
      id: "group1",
      keyType: 'main',
      keyColumn: 'claim_id',
      conditions: [{
        id: "condition1",
        column: "",
        operator: "equals",
        value: null
      }],
      children: []
    }]
  }])
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [selectedSavedFilter, setSelectedSavedFilter] = useState<string | null>(null)
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

  // Load initial data
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true)
        
        const [claimsResponse, columnTypesResponse] = await Promise.all([
          fetch(`http://localhost:5000/api/filters/claims?page=1&limit=${pageSize}`),
          fetch('http://localhost:5000/api/filters/claimsDtype')
        ])

        if (!claimsResponse.ok || !columnTypesResponse.ok) {
          throw new Error('Failed to fetch initial data')
        }

        const claimsData = await claimsResponse.json()
        const columnTypes = await columnTypesResponse.json() as ColumnTypeResponse

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
              name: column,
              displayName: formatColumnName(column),
              dataType: type
            }))
            .sort((a, b) => {
              if (a.name === 'claim_id') return -1
              if (b.name === 'claim_id') return 1
              if (a.name === 'line_id') return -1
              if (b.name === 'line_id') return 1
              return a.displayName.localeCompare(b.displayName)
            })

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
  useEffect(() => {
    const fetchSavedFilters = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/filters/saved')
        if (!response.ok) throw new Error('Failed to fetch saved filters')
        const data = await response.json()
        setSavedFilters(data.filters.map((filter: any) => ({
          id: filter.filter_id,
          name: filter.name,
          description: filter.description,
          keyColumns: [],
          filterKeys: filter.filterKeys,
          run_count: filter.run_count,
          last_run: filter.last_run
        })))
      } catch (error) {
        console.error('Error fetching saved filters:', error)
      }
    }

    fetchSavedFilters()
  }, [])

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
                column: "",
                operator: "equals",
                value: null
              }
            ]
          }
        }
        return { ...key, children: key.children.map(updateKey) }
      }
      return keys.map(updateKey)
    })
  }

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
    setFilterKeys(keys => {
      const updateCondition = (keys: FilterKey[], keyId: string, conditionId: string, updates: Partial<FilterCondition>): FilterKey[] => {
        return keys.map(key => {
          if (key.id === keyId) {
            return {
              ...key,
              conditions: key.conditions.map(condition => {
                if (condition.id === conditionId) {
                  const updatedCondition = { 
                    ...condition, 
                    ...updates,
                    column: updates.column 
                      ? columns.find(col => col.displayName === updates.column)?.name || updates.column
                      : condition.column
                  };
                  
                  const columnInfo = columns.find(col => col.name === updatedCondition.column);
                  
                  if (columnInfo) {
                    if (columnInfo.dataType === 'number' && typeof updatedCondition.value === 'string') {
                      updatedCondition.value = parseFloat(updatedCondition.value) || null;
                    } else if (columnInfo.dataType === 'boolean' && typeof updatedCondition.value === 'string') {
                      updatedCondition.value = updatedCondition.value.toLowerCase();
                    }
                  }
                  
                  return updatedCondition;
                }
                return condition;
              })
            };
          }
          return {
            ...key,
            children: updateCondition(key.children, keyId, conditionId, updates)
          };
        });
      };

      return updateCondition(keys, keyId, conditionId, updates);
    });
  }

  const handleAddKey = (parentId: string, keyType: 'main' | 'sub') => {
    setFilterKeys((keys) => {
      const newKeyId = `group${Date.now()}`;
      const newKey: FilterKey = {
        id: newKeyId,
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
  }

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
        id: savedFilter.filter_id,
        name: filterName,
        description: savedFilter.description || '',
        keyColumns: [],
        filterKeys,
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
      setSelectedSavedFilter(filterName);

      const response = await fetch(`http://localhost:5000/api/filters/execute/${filter.id}`);

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
          keyType: null,
          keyColumn: "",
          conditions: [],
          children: [{
            id: "group1",
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
              keyType: 'sub',
              keyColumn: keyColumn,
              conditions: (conditions as any[]).map((c, condIndex) => ({
                id: `subcondition${index + 1}_${condIndex + 1}`,
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
        page: page,
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
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to apply filter');
      }

      const data = await response.json();

      setClaims(data.claims);
      setStatistics({
        uniqueClaimIds: data.statistics.uniqueClaimIds,
        dateRange: data.statistics.dateRange,
        totalAllowedAmount: data.statistics.totalAllowedAmount,
        totalRecords: data.statistics.totalRecords,
      });

      setSelectedSavedFilter(null);
    } catch (error) {
      console.error('Error applying filter:', error);
      setError(error instanceof Error ? error.message : 'Failed to apply filter');
    } finally {
      setIsLoading(false);
    }
  }

  const handleResetFilter = async () => {
    try {
      setIsLoading(true);
      setError(null);

      setFilterName("");
      setFilterKeys([{
        id: "root",
        keyType: null,
        keyColumn: "",
        conditions: [],
        children: [{
          id: "group1",
          keyType: 'main',
          keyColumn: 'claim_id',
          conditions: [{
            id: "condition1",
            column: "",
            operator: "equals",
            value: null
          }],
          children: []
        }]
      }]);
      setSelectedSavedFilter(null);
      setPage(1);

      const response = await fetch(`http://localhost:5000/api/filters/claims?page=1&limit=${pageSize}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      setClaims(data.claims);
      setStatistics({
        uniqueClaimIds: data.statistics.uniqueClaimIds,
        dateRange: data.statistics.dateRange,
        totalAllowedAmount: data.statistics.totalAllowedAmount,
        totalRecords: data.statistics.totalRecords,
      });

    } catch (err) {
      console.error('Error resetting filter:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while resetting');
    } finally {
      setIsLoading(false);
    }
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

  return (
    <div className="container mx-auto px-4 py-8 bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-8">Filter Management</h1>

      <SavedFiltersSelect
        savedFilters={savedFilters}
        selectedFilter={selectedSavedFilter}
        onFilterSelect={handleLoadFilter}
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