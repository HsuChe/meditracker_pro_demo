import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SaveFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterName: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onSave: () => void;
}

const SaveFilterDialog: React.FC<SaveFilterDialogProps> = ({
  open,
  onOpenChange,
  filterName,
  description,
  onNameChange,
  onDescriptionChange,
  onSave,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Filter</DialogTitle>
          <DialogDescription>
            Enter a name and description for your filter.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="filter-name" className="text-right">
              Name
            </Label>
            <Input
              id="filter-name"
              value={filterName}
              onChange={(e) => onNameChange(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="filter-description" className="text-right">
              Description
            </Label>
            <Textarea
              id="filter-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Enter a description for your filter..."
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!filterName}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveFilterDialog;