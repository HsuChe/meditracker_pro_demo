import React from 'react';

// Helper interfaces and functions
interface SelectComponent extends React.FC<any> {
  displayName?: string;
}

interface CommandComponent extends React.FC<any> {
  displayName?: string;
}

const createSelectComponent = (name: string, render: React.FC<any>): SelectComponent => {
  const component = render as SelectComponent;
  component.displayName = `Select.${name}`;
  return component;
};

const createCommandComponent = (name: string, render: React.FC<any>): CommandComponent => {
  const component = render as CommandComponent;
  component.displayName = name;
  return component;
};

// UI Component Mocks
export const buttonMock = {
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button" {...props}>
      {children}
    </button>
  ),
};

export const inputMock = {
  Input: (props: any) => <input {...props} />,
};

export const labelMock = {
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
};

export const switchMock = {
  Switch: (props: any) => <input type="checkbox" {...props} />,
};

// Radix UI Mocks
export const popoverMock = {
  Root: ({ children }: any) => <div data-testid="popover-root">{children}</div>,
  Trigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
  Content: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
};

export const selectMockFactory = () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select 
      value={value} 
      onChange={(e) => onValueChange(e.target.value)}
      data-testid="select"
    >
      {[10, 25, 50, 75, 100].map((size) => (
        <option key={size} value={size.toString()}>
          {size}
        </option>
      ))}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null
});

export const cmdkMockFactory = () => {
  const CommandPrimitive = {
    Root: createCommandComponent('Command', 
      ({ children }: any) => <div data-testid="command-root">{children}</div>
    ),
    Input: createCommandComponent('Command.Input',
      ({ value, onValueChange }: any) => (
        <input
          data-testid="command-input"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
      )
    ),
    Empty: createCommandComponent('Command.Empty',
      ({ children }: any) => <div data-testid="command-empty">{children}</div>
    ),
    Group: createCommandComponent('Command.Group',
      ({ children }: any) => <div data-testid="command-group">{children}</div>
    ),
    Item: createCommandComponent('Command.Item',
      ({ children, onSelect }: any) => (
        <div data-testid="command-item" onClick={() => onSelect && onSelect()}>
          {children}
        </div>
      )
    ),
    List: createCommandComponent('Command.List',
      ({ children }: any) => <div data-testid="command-list">{children}</div>
    )
  };

  return {
    Command: CommandPrimitive.Root,
    CommandInput: CommandPrimitive.Input,
    CommandList: CommandPrimitive.List,
    CommandEmpty: CommandPrimitive.Empty,
    CommandGroup: CommandPrimitive.Group,
    CommandItem: CommandPrimitive.Item,
    default: CommandPrimitive.Root
  };
};

export const calendarMock = {
  Calendar: () => <div data-testid="calendar">Calendar Mock</div>,
};

export const dateRangePickerMock = {
  DatePickerWithRange: () => <div data-testid="date-range-picker">Date Range Picker Mock</div>,
};

export const tableMock = {
  Table: ({ children }: any) => <table data-testid="table">{children}</table>,
  TableHeader: ({ children }: any) => <thead data-testid="table-header">{children}</thead>,
  TableBody: ({ children }: any) => <tbody data-testid="table-body">{children}</tbody>,
  TableHead: ({ children }: any) => <th data-testid="table-head">{children}</th>,
  TableRow: ({ children, className }: any) => (
    <tr data-testid="table-row" className={className}>
      {children}
    </tr>
  ),
  TableCell: ({ children }: any) => <td data-testid="table-cell">{children}</td>
}; 