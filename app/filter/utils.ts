import { DataType, ClaimData } from './types';

export const OPERATORS_BY_TYPE: Record<DataType, string[]> = {
  string: ['equals', 'contains', 'starts_with', 'ends_with', 'is_null', 'is_not_null', 'in_list', 'not_in_list'],
  number: ['equals', 'greater_than', 'less_than', 'greater_than_equals', 'less_than_equals', 'between', 'is_null', 'is_not_null'],
  date: ['equals', 'before', 'after', 'between', 'between_date', 'is_null', 'is_not_null'],
  boolean: ['equals', 'is_null', 'is_not_null']
};

export const formatColumnName = (name: string): string => {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const parseDelimitedInput = (input: string): string[] => {
  const delimiters = [',', ';', '|', '\t'];
  for (const delimiter of delimiters) {
    if (input.includes(delimiter)) {
      return input
        .split(delimiter)
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
  }
  return [input.trim()];
};

export const operatorNeedsInput = (operator: string): boolean => {
  return !['is_null', 'is_not_null'].includes(operator);
};

export const operatorNeedsSecondInput = (operator: string): boolean => {
  return operator === 'between' || operator === 'between_date';
};

export const checkCondition = (value: any, filterValue: any, operator: string, secondValue?: any) => {
  switch (operator) {
    case 'equals':
      return typeof value === 'string' && typeof filterValue === 'string'
        ? value.toLowerCase() === filterValue.toLowerCase()
        : value === filterValue;
    case 'contains':
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    case 'starts_with':
      return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
    case 'ends_with':
      return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
    case 'is_null':
      return value === null || value === undefined;
    case 'is_not_null':
      return value !== null && value !== undefined;
    case 'in_list':
      if (!value) return false;
      const valueList = parseDelimitedInput(String(filterValue));
      return valueList.some(item => 
        String(value).toLowerCase() === item.toLowerCase()
      );
    case 'not_in_list':
      if (!value) return false;
      const notInValueList = parseDelimitedInput(String(filterValue));
      return !notInValueList.some(item => 
        String(value).toLowerCase() === item.toLowerCase()
      );
    case 'greater_than':
      return Number(value) > Number(filterValue);
    case 'greater_than_equals':
      return Number(value) >= Number(filterValue);
    case 'less_than':
      return Number(value) < Number(filterValue);
    case 'less_than_equals':
      return Number(value) <= Number(filterValue);
    case 'between':
      const numValue = Number(value);
      const numFilterValue = Number(filterValue);
      const numSecondValue = Number(secondValue);
      return !isNaN(numValue) && !isNaN(numFilterValue) && !isNaN(numSecondValue) &&
             numValue >= numFilterValue && numValue <= numSecondValue;
    case 'before':
      return new Date(value) < new Date(filterValue);
    case 'after':
      return new Date(value) > new Date(filterValue);
    case 'between_date':
      const dateValue = new Date(value);
      const compareDate = new Date(filterValue);
      const compareValue = secondValue?.value;
      const compareUnit = secondValue?.unit as 'year' | 'month' | 'week' | 'day';
      const compareOperator = secondValue?.operator;
      
      if (isNaN(dateValue.getTime()) || isNaN(compareDate.getTime()) || !compareValue || !compareUnit || !compareOperator) {
        return false;
      }

      const timeDiff = dateValue.getTime() - compareDate.getTime();
      const unitInMs = {
        year: 31536000000,  // 365 days
        month: 2592000000,  // 30 days
        week: 604800000,    // 7 days
        day: 86400000       // 1 day
      }[compareUnit];

      const diffInUnits = Math.abs(timeDiff) / unitInMs;

      switch (compareOperator) {
        case 'greater_than':
          return diffInUnits > compareValue;
        case 'less_than':
          return diffInUnits < compareValue;
        case 'equals':
          return diffInUnits === compareValue;
        default:
          return false;
      }
    default:
      return true;
  }
};

export const groupDataByClaimId = (data: ClaimData[]): ClaimData[] => {
  const groupedData = data.reduce((acc, record) => {
    const claimId = record.claim_id;
    if (!acc[claimId]) {
      acc[claimId] = [];
    }
    acc[claimId].push(record);
    return acc;
  }, {} as Record<string, ClaimData[]>);

  return Object.entries(groupedData)
    .map(([claimId, records]) => {
      const sortedRecords = records.sort((a, b) => {
        return (a.line_id || '').localeCompare(b.line_id || '') || 0;
      });

      const [mainRecord, ...otherRecords] = sortedRecords;
      return {
        ...mainRecord,
        grouped_data: otherRecords
      };
    })
    .sort((a, b) => a.claim_id.localeCompare(b.claim_id));
};

export const calculateStatistics = (claims: ClaimData[]) => {
  const uniqueClaimIds = new Set(claims.map(c => c.claim_id)).size;
  let totalRecords = 0;
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  let totalAllowedAmount = 0;

  claims.forEach(claim => {
    const groupedData = Array.isArray(claim.grouped_data) ? claim.grouped_data : [];
    totalRecords += groupedData.length;

    groupedData.forEach(record => {
      if (record.admission_date) {
        const date = new Date(record.admission_date);
        if (!isNaN(date.getTime())) {
          if (!minDate || date < minDate) minDate = date;
          if (!maxDate || date > maxDate) maxDate = date;
        }
      }

      if (record.allowed_amount) {
        const amount = parseFloat(record.allowed_amount.toString());
        if (!isNaN(amount)) {
          totalAllowedAmount += amount;
        }
      }
    });
  });

  const minDateStr = minDate ? new Date(minDate).toISOString() : null;
  const maxDateStr = maxDate ? new Date(maxDate).toISOString() : null;

  return {
    uniqueClaimIds,
    totalRecords,
    dateRange: {
      min: minDateStr,
      max: maxDateStr
    },
    totalAllowedAmount
  };
};