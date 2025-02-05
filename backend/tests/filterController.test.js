const { buildWhereClauses } = require('../controllers/filterController');
const pool = require('../config/db.config');

describe('Filter Controller Operators', () => {
  // Mock data for testing
  const testData = [
    {
      id: 1,
      claim_id: 'CLM001',
      patient_name: 'John Doe',
      admission_date: '2024-01-01',
      amount: 1000.50,
      status: 'active',
      notes: null
    },
    // Add more test records as needed
  ];

  // Test each operator
  describe('String Operators', () => {
    test('equals operator should generate correct SQL', () => {
      const condition = [{
        column: 'patient_name',
        operator: 'equals',
        value: 'John Doe'
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('patient_name::text = $1::text');
      expect(params).toEqual(['John Doe']);
    });

    test('contains operator should generate correct SQL', () => {
      const condition = [{
        column: 'patient_name',
        operator: 'contains',
        value: 'John'
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('patient_name::text ILIKE \'%\' || $1::text || \'%\'');
      expect(params).toEqual(['John']);
    });

    test('starts_with operator should generate correct SQL', () => {
      const condition = [{
        column: 'patient_name',
        operator: 'starts_with',
        value: 'John'
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('patient_name::text ILIKE $1::text || \'%\'');
      expect(params).toEqual(['John']);
    });

    test('ends_with operator should generate correct SQL', () => {
      const condition = [{
        column: 'patient_name',
        operator: 'ends_with',
        value: 'Doe'
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('patient_name::text ILIKE \'%\' || $1::text');
      expect(params).toEqual(['Doe']);
    });
  });

  describe('Numeric Operators', () => {
    test('equals operator with number should generate correct SQL', () => {
      const condition = [{
        column: 'amount',
        operator: 'equals',
        value: 1000.50
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('amount::numeric = $1::numeric');
      expect(params).toEqual([1000.50]);
    });

    test('greater_than operator should generate correct SQL', () => {
      const condition = [{
        column: 'amount',
        operator: 'greater_than',
        value: 1000
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('amount::numeric > $1::numeric');
      expect(params).toEqual([1000]);
    });

    test('less_than operator should generate correct SQL', () => {
      const condition = [{
        column: 'amount',
        operator: 'less_than',
        value: 2000
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('amount::numeric < $1::numeric');
      expect(params).toEqual([2000]);
    });

    test('between operator should generate correct SQL', () => {
      const condition = [{
        column: 'amount',
        operator: 'between',
        value: 1000,
        secondValue: 2000
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('amount::numeric BETWEEN $1::numeric AND $2::numeric');
      expect(params).toEqual([1000, 2000]);
    });
  });

  describe('Date Operators', () => {
    test('before operator should generate correct SQL', () => {
      const condition = [{
        column: 'admission_date',
        operator: 'before',
        value: '2024-01-01'
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('admission_date::date < $1::date');
      expect(params).toEqual(['2024-01-01']);
    });

    test('after operator should generate correct SQL', () => {
      const condition = [{
        column: 'admission_date',
        operator: 'after',
        value: '2024-01-01'
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('admission_date::date > $1::date');
      expect(params).toEqual(['2024-01-01']);
    });

    test('between operator with dates should generate correct SQL', () => {
      const condition = [{
        column: 'admission_date',
        operator: 'between',
        value: '2024-01-01',
        secondValue: '2024-12-31'
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('admission_date::date BETWEEN $1::date AND $2::date');
      expect(params).toEqual(['2024-01-01', '2024-12-31']);
    });
  });

  describe('Null Operators', () => {
    test('is_null operator should generate correct SQL', () => {
      const condition = [{
        column: 'notes',
        operator: 'is_null',
        value: null
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('notes IS NULL');
      expect(params).toEqual([]);
    });

    test('is_not_null operator should generate correct SQL', () => {
      const condition = [{
        column: 'notes',
        operator: 'is_not_null',
        value: null
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses[0]).toBe('notes IS NOT NULL');
      expect(params).toEqual([]);
    });
  });

  describe('Multiple Conditions', () => {
    test('should handle multiple conditions correctly', () => {
      const conditions = [
        {
          column: 'patient_name',
          operator: 'equals',
          value: 'John Doe'
        },
        {
          column: 'amount',
          operator: 'greater_than',
          value: 1000
        },
        {
          column: 'status',
          operator: 'is_not_null',
          value: null
        }
      ];

      const { clauses, params } = buildWhereClauses(conditions);
      
      expect(clauses).toHaveLength(3);
      expect(params).toHaveLength(2); // is_not_null doesn't add a param
      expect(clauses[0]).toBe('patient_name::text = $1::text');
      expect(clauses[1]).toBe('amount::numeric > $2::numeric');
      expect(clauses[2]).toBe('status IS NOT NULL');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid operator gracefully', () => {
      const condition = [{
        column: 'patient_name',
        operator: 'invalid_operator',
        value: 'John'
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses).toHaveLength(0);
      expect(params).toHaveLength(0);
    });

    test('should handle null values correctly', () => {
      const condition = [{
        column: 'patient_name',
        operator: 'equals',
        value: null
      }];

      const { clauses, params } = buildWhereClauses(condition);
      
      expect(clauses).toHaveLength(0);
      expect(params).toHaveLength(0);
    });
  });
}); 