import { FC } from 'react';

export interface SelectComponent extends FC<any> {
  displayName?: string;
}

export interface CommandComponent extends FC<any> {
  displayName?: string;
}

export const buttonMock: {
  Button: FC<any>;
};

export const inputMock: {
  Input: FC<any>;
};

export const labelMock: {
  Label: FC<any>;
};

export const switchMock: {
  Switch: FC<any>;
};

export const popoverMock: {
  Root: FC<any>;
  Trigger: FC<any>;
  Content: FC<any>;
};

export const selectMockFactory: () => {
  Root: SelectComponent;
  Trigger: SelectComponent;
  Value: SelectComponent;
  Content: SelectComponent;
  Item: SelectComponent;
  Group: SelectComponent;
  Label: SelectComponent;
  Separator: SelectComponent;
  ScrollUpButton: SelectComponent;
  ScrollDownButton: SelectComponent;
  ItemText: SelectComponent;
  ItemIndicator: SelectComponent;
  Icon: SelectComponent;
  Portal: SelectComponent;
  Viewport: SelectComponent;
};

export const cmdkMockFactory: () => {
  Command: CommandComponent;
  CommandInput: CommandComponent;
  CommandList: CommandComponent;
  CommandEmpty: CommandComponent;
  CommandGroup: CommandComponent;
  CommandItem: CommandComponent;
  default: CommandComponent;
};

export const calendarMock: {
  Calendar: FC<any>;
};

export const dateRangePickerMock: {
  DatePickerWithRange: FC<any>;
}; 