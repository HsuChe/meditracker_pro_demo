# Filter System Technical Proposal

## 1. UI Components and Functionality

### Saved Filters Section

#### Saved Filters Dropdown
- **Type**: Select component (shadcn/ui)
- **Functionality**:
  - Displays list of previously saved filters
  - Shows filter name and last run timestamp
  - On selection:
    - Populates all filter conditions
    - Loads associated results
    - Updates filter name field
- **State Management**:
  ```typescript
  interface SavedFilter {
    id: number;
    name: string;
    conditions: FilterCondition[];
    claims_ids: number[];
    created_at: string;
    last_updated: string;
  }
  ```

### Filter Building Section

#### Filter Name Input
- **Type**: Text input (shadcn/ui)
- **Functionality**:
  - Required for saving filters
  - Must be unique
  - Validates against existing filter names
  - Max length: 255 characters

#### Column Type Detection and Operators
- **Data Types and Allowed Operators**:

1. **String Type Operators**:
   ```typescript
   type StringOperator = 
     | 'equals'
     | 'notEquals'
     | 'contains'
     | 'doesNotContain'
     | 'startsWith'
     | 'endsWith'
     | 'matchesRegex'
     | 'isIn'
     | 'isNotIn'
     | 'isNull'
     | 'isNotNull'
   ```

2. **Date Type Operators**:
   ```typescript
   type DateOperator = 
     | 'equals'
     | 'before'
     | 'after'
     | 'between'
     | 'isNull'
     | 'isNotNull'
     | 'daysSince'
   ```

3. **Integer Type Operators**:
   ```typescript
   type IntegerOperator =
     | 'equals'
     | 'notEquals'
     | 'greaterThan'
     | 'lessThan'
     | 'greaterThanEquals'
     | 'lessThanEquals'
     | 'between'
     | 'isIn'
     | 'isNotIn'
     | 'isNull'
     | 'isNotNull'
   ```

4. **Float Type Operators**:
   ```typescript
   type FloatOperator =
     | 'equals'
     | 'notEquals'
     | 'greaterThan'
     | 'lessThan'
     | 'greaterThanEquals'
     | 'lessThanEquals'
     | 'between'
     | 'percentageOfTotal'
     | 'isNull'
     | 'isNotNull'
   ```

#### Filter Conditions
- **Type**: Dynamic form group
- **Base Structure**:
  ```typescript
  type FilterCondition = {
    id: string;
    column: string;
    value: string;
    operator: FilterOperator;
    secondValue?: string;
  }
  ```
- **Components per condition**:
  1. Column Selector (Select)
     - Lists available columns from DataRow interface
     - Auto-detects data type based on column definition
  2. Operator Selector (Select)
     - Options dynamically updated based on column type
     - Uses appropriate operator type from above definitions
  3. Value Input
     - Type changes based on column type:
       - Date: DatePicker component
       - Number (Integer/Float): NumberInput
       - String: Text input or LUT dropdown
     - Second value input appears for 'between' operator
  4. Remove Button (X icon)
     - Removes condition from group

### Data Structure Definition
```typescript
interface DataRow {
  claim_id: string;          // varchar(8)
  patient_id: number;        // integer
  date_of_birth: string;     // date
  gender: string | null;     // varchar(10), nullable
  provider_id: number;       // integer
  facility_id: number;       // integer
  diagnosis_code: string;    // varchar(10)
  procedure_code: string;    // varchar(10)
  admission_date: string | null;    // date, nullable
  discharge_date: string | null;    // date, nullable
  revenue_code: string | null;      // varchar(10), nullable
  modifiers: string | null;         // varchar(10), nullable
  claim_type: string | null;        // varchar(20), nullable
  total_charges: number;     // numeric(10,2)
  allowed_amount: number;    // numeric(10,2)
  claim_merged_id: number;   // integer (serial)
  [key: string]: any;        // For flexibility
}
```

### Action Buttons

#### Apply Filter Button
- **Type**: Primary button
- **Functionality**:
  - Validates filter configuration
  - Executes filter query
  - Updates results table
  - Shows loading state during execution

#### Reset Filter Button
- **Type**: Secondary button
- **Functionality**:
  - Clears all conditions
  - Resets key column selection
  - Clears filter name
  - Maintains saved filters

#### Save Filter Button
- **Type**: Primary button
- **Functionality**:
  - Validates filter name
  - Saves complete filter configuration
  - Updates saved filters list
  - Shows success/error toast

## 2. Backend Implementation

### Database Schema

```sql
-- Saved Filters
CREATE TABLE saved_filters (
    filter_id SERIAL PRIMARY KEY,
    filter_name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    conditions JSONB NOT NULL,
    claims_ids JSONB NOT NULL
);

-- Type-specific LUT Tables
CREATE TABLE string_lut (
    id SERIAL PRIMARY KEY,
    column_name VARCHAR(50),
    value VARCHAR(255),
    description TEXT
);

CREATE TABLE numeric_lut (
    id SERIAL PRIMARY KEY,
    column_name VARCHAR(50),
    min_value NUMERIC,
    max_value NUMERIC,
    increment NUMERIC
);
```

### Query Builder Logic

```typescript
interface QueryBuilder {
  // String Type Handlers
  handleStringOperator(column: string, operator: StringOperator, value: string): string {
    switch(operator) {
      case 'contains': return `${column} ILIKE '%${value}%'`;
      case 'startsWith': return `${column} ILIKE '${value}%'`;
      case 'endsWith': return `${column} ILIKE '%${value}'`;
      case 'matchesRegex': return `${column} ~ '${value}'`;
      // ... handle other string operators
    }
  }

  // Date Type Handlers
  handleDateOperator(column: string, operator: DateOperator, value: string, secondValue?: string): string {
    switch(operator) {
      case 'between': return `${column} BETWEEN '${value}' AND '${secondValue}'`;
      case 'before': return `${column} < '${value}'`;
      case 'after': return `${column} > '${value}'`;
      // ... handle other date operators
    }
  }

  // Numeric Type Handlers
  handleNumericOperator(column: string, operator: IntegerOperator | FloatOperator, value: string): string {
    switch(operator) {
      case 'greaterThan': return `${column} > ${value}`;
      case 'lessThan': return `${column} < ${value}`;
      case 'between': return `${column} BETWEEN ${value} AND ${secondValue}`;
      // ... handle other numeric operators
    }
  }
}
```

### Performance Optimization Indexes
```sql
-- Create indexes based on common filter patterns
CREATE INDEX idx_claim_type ON claims(claim_type);
CREATE INDEX idx_dates ON claims(admission_date, discharge_date);
CREATE INDEX idx_numeric ON claims(total_charges, allowed_amount);

-- Composite indexes for common combinations
CREATE INDEX idx_claim_dates ON claims(claim_type, admission_date);
```

## 3. Implementation Guidelines

### Frontend Best Practices:
1. Cache detected column types
2. Implement debounced input for string filters
3. Use proper date formatting for date operations
4. Handle null values appropriately
5. Validate numeric inputs

### Backend Best Practices:
1. Use parameterized queries to prevent SQL injection
2. Implement proper error handling for each operator type
3. Cache common LUT values
4. Monitor query performance by operator type
5. Log slow queries for optimization

### Performance Considerations:
1. Maximum results per page: 100
2. LUT cache refresh interval: 1 hour
3. Query timeout: 30 seconds
4. String search minimum length: 3 characters
5. Maximum items in 'isIn' lists: 1000