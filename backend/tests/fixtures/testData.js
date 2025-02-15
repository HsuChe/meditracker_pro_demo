const testClaims = [
  {
    claim_id: 'CLM001',
    patient_name: 'John Doe',
    admission_date: '2024-01-01',
    discharge_date: '2024-01-05',
    diagnosis_code: 'A123',
    amount: 1000.50,
    status: 'active'
  },
  {
    claim_id: 'CLM002',
    patient_name: 'Jane Smith',
    admission_date: '2024-01-02',
    discharge_date: '2024-01-07',
    diagnosis_code: 'B456',
    amount: 2000.75,
    status: 'pending'
  }
];

const testFilters = [
  {
    name: 'High Value Claims',
    conditions: [
      {
        column: 'amount',
        operator: 'greater_than',
        value: '1500'
      }
    ]
  },
  {
    name: 'Recent Admissions',
    conditions: [
      {
        column: 'admission_date',
        operator: 'after',
        value: '2024-01-01'
      }
    ]
  }
];

const testLUTs = [
  {
    name: 'Common Diagnoses',
    diagnosis_codes: ['A123', 'B456', 'C789']
  },
  {
    name: 'Critical Care',
    diagnosis_codes: ['X111', 'Y222', 'Z333']
  }
];

module.exports = {
  testClaims,
  testFilters,
  testLUTs
}; 