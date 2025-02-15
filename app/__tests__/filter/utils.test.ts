import { checkCondition, formatColumnName, parseDelimitedInput } from '../../filter/utils';

describe('Filter Utils Tests', () => {
  describe('checkCondition', () => {
    describe('between_date operator', () => {
      const today = new Date();
      const sixDaysAgo = new Date(today);
      sixDaysAgo.setDate(today.getDate() - 6);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);
      
      it('should correctly evaluate "less than 6 days from today"', () => {
        const result = checkCondition(
          threeDaysAgo.toISOString(),  // A date within the last 6 days
          today.toISOString(),
          'between_date',
          {
            operator: 'less_than',
            value: 6,
            unit: 'day'
          }
        );
        expect(result).toBe(true);
      });

      it('should correctly evaluate "greater than 6 days from today"', () => {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        
        const result = checkCondition(
          sevenDaysAgo.toISOString(),
          today.toISOString(),
          'between_date',
          {
            operator: 'greater_than',
            value: 6,
            unit: 'day'
          }
        );
        expect(result).toBe(true);
      });

      it('should handle different time units', () => {
        const units = ['day', 'week', 'month', 'year'] as const;
        units.forEach(unit => {
          const recentDate = new Date(today);
          // Set date to be within the specified unit
          switch(unit) {
            case 'day':
              recentDate.setDate(today.getDate() - 0.5);
              break;
            case 'week':
              recentDate.setDate(today.getDate() - 3);
              break;
            case 'month':
              recentDate.setDate(today.getDate() - 15);
              break;
            case 'year':
              recentDate.setMonth(today.getMonth() - 6);
              break;
          }
          
          const result = checkCondition(
            recentDate.toISOString(),
            today.toISOString(),
            'between_date',
            {
              operator: 'less_than',
              value: 1,
              unit
            }
          );
          expect(result).toBe(true);
        });
      });
    });
  });

  describe('formatColumnName', () => {
    it('should format column names correctly', () => {
      expect(formatColumnName('admission_date')).toBe('Admission Date');
      expect(formatColumnName('claim_id')).toBe('Claim Id');
      expect(formatColumnName('allowed_amount')).toBe('Allowed Amount');
    });
  });

  describe('parseDelimitedInput', () => {
    it('should parse comma-delimited input', () => {
      expect(parseDelimitedInput('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('should parse semicolon-delimited input', () => {
      expect(parseDelimitedInput('a;b;c')).toEqual(['a', 'b', 'c']);
    });

    it('should handle whitespace', () => {
      expect(parseDelimitedInput(' a , b , c ')).toEqual(['a', 'b', 'c']);
    });
  });
}); 