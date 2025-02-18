import React from 'react';
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SavedFilter } from '../types';
import { Button } from "@/components/ui/button";

interface SavedFiltersSelectProps {
  savedFilters: SavedFilter[];
  selectedFilter: string | null;
  onFilterSelect: (filterName: string) => void;
  onDeleteFilter: (filterName: string) => void;
}

const SavedFiltersSelect: React.FC<SavedFiltersSelectProps> = ({
  savedFilters,
  selectedFilter,
  onFilterSelect,
  onDeleteFilter,
}) => {
  return (
    <div className="mb-8">
      <Label htmlFor="saved-filters">Saved Filters</Label>
      <Select
        value={selectedFilter || ""}
        onValueChange={onFilterSelect}
      >
        <SelectTrigger className="w-full" id="saved-filters">
          <SelectValue>
            {selectedFilter || "Select a saved filter..."}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <Command>
            <CommandInput placeholder="Search filters..." className="h-9" />
            <CommandEmpty>No filter found.</CommandEmpty>
            <CommandGroup>
              {savedFilters.map((filter) => (
                <CommandItem
                  key={`${filter.filter_id}-${filter.name}`}
                  value={filter.name}
                  onSelect={() => onFilterSelect(filter.name)}
                  className="flex justify-between items-center"
                >
                  <div className="flex items-center">
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
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFilter(filter.name);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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