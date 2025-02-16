import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SaveFilterDialog from '@/app/filter/components/SaveFilterDialog';

describe('SaveFilterDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    filterName: '',
    description: '',
    onNameChange: jest.fn(),
    onDescriptionChange: jest.fn(),
    onSave: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the dialog when open is true', () => {
    render(<SaveFilterDialog {...defaultProps} />);
    
    expect(screen.getByText('Save Filter')).toBeInTheDocument();
    expect(screen.getByText('Enter a name and description for your filter.')).toBeInTheDocument();
  });

  it('does not render the dialog when open is false', () => {
    render(<SaveFilterDialog {...defaultProps} open={false} />);
    
    expect(screen.queryByText('Save Filter')).not.toBeInTheDocument();
  });

  it('displays input fields with correct initial values', () => {
    const props = {
      ...defaultProps,
      filterName: 'Test Filter',
      description: 'Test Description',
    };
    
    render(<SaveFilterDialog {...props} />);
    
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    const descriptionInput = screen.getByLabelText('Description') as HTMLTextAreaElement;
    
    expect(nameInput.value).toBe('Test Filter');
    expect(descriptionInput.value).toBe('Test Description');
  });

  it('calls onNameChange when name input changes', () => {
    render(<SaveFilterDialog {...defaultProps} />);
    
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'New Filter Name' } });
    
    expect(defaultProps.onNameChange).toHaveBeenCalledWith('New Filter Name');
  });

  it('calls onDescriptionChange when description input changes', () => {
    render(<SaveFilterDialog {...defaultProps} />);
    
    const descriptionInput = screen.getByLabelText('Description');
    fireEvent.change(descriptionInput, { target: { value: 'New Description' } });
    
    expect(defaultProps.onDescriptionChange).toHaveBeenCalledWith('New Description');
  });

  it('disables save button when filterName is empty', () => {
    render(<SaveFilterDialog {...defaultProps} filterName="" />);
    
    const saveButton = screen.getByText('Save');
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when filterName is not empty', () => {
    render(<SaveFilterDialog {...defaultProps} filterName="Test Filter" />);
    
    const saveButton = screen.getByText('Save');
    expect(saveButton).not.toBeDisabled();
  });

  it('calls onSave when save button is clicked', () => {
    render(<SaveFilterDialog {...defaultProps} filterName="Test Filter" />);
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  it('calls onOpenChange with false when cancel button is clicked', () => {
    render(<SaveFilterDialog {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('has correct accessibility attributes', () => {
    render(<SaveFilterDialog {...defaultProps} />);
    
    // Check for proper labeling
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    
    // Check dialog has a title
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby');
  });
}); 