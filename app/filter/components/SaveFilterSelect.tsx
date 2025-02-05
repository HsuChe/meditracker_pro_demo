import React from 'react';
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SavedFilter } from '../types';

interface SavedFiltersSelectProps {
  savedFilters: SavedFilter[];
  selectedFilter: string | null;
  onFilterSelect: (filterName: string) => void;
}

const SavedFiltersSelect: React.FC<SavedFiltersSelectProps> = ({
  savedFilters,
  selectedFilter,
  onFilterSelect,
}) => {
  return (
    <div className="mb-8">
      <Label htmlFor="saved-filters">Saved Filters</Label>
      <Select
        value={selectedFilter || ""}
        onValueChange={onFilterSelect}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a saved filter..." />
        </SelectTrigger>
        <SelectContent>
          <Command>
            <CommandInput placeholder="Search filters..." className="h-9" />
            <CommandEmpty>No filter found.</CommandEmpty>
            <CommandGroup>
              {savedFilters.map((filter) => (
                <CommandItem
                  key={filter.id}
                  value={filter.name}
                  onSelect={(value) => onFilterSelect(value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedFilter === filter.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col gap-0.5">
                    <span>{filter.name}</span>
                    {filter.description && (
                      <span className="text-xs text-muted-foreground font-normal">
                        {filter.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </SelectContent>
      </Select>
    </div>
  );
};

export default SavedFiltersSelect;