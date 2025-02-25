import React from 'react';
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { SavedFilter } from '../types';
import { Button } from "@/components/ui/button";

export interface SaveFilterSelectProps {
  savedFilters: SavedFilter[];
  selectedFilter: SavedFilter | null;
  onFilterSelect: (filter: SavedFilter | null) => void;
  onDeleteFilter: (filter: SavedFilter) => void;
}

export function SaveFilterSelect({
  savedFilters = [],
  selectedFilter,
  onFilterSelect,
  onDeleteFilter,
}: SaveFilterSelectProps) {
  const filters = Array.isArray(savedFilters) ? savedFilters : [];
  
  return (
    <div className="mb-8">
      <Label htmlFor="saved-filters">Saved Filters</Label>
      <Select
        value={selectedFilter?.filter_id?.toString()}
        onValueChange={(value) => {
          const filter = filters.find((f) => f.filter_id.toString() === value);
          onFilterSelect(filter || null);
        }}
      >
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select a saved filter" />
        </SelectTrigger>
        <SelectContent>
          {filters.length === 0 ? (
            <SelectItem value="empty" disabled>
              No saved filters
            </SelectItem>
          ) : (
            filters.map((filter) => (
              <SelectItem key={filter.filter_id} value={filter.filter_id.toString()}>
                <div className="flex items-center justify-between w-full group">
                  <div className="flex-1">
                    <div>{filter.name}</div>
                    {filter.description && (
                      <div className="text-sm text-gray-500">{filter.description}</div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFilter(filter);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

export default SaveFilterSelect;