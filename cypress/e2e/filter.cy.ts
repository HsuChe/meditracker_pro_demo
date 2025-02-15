/// <reference types="cypress" />

describe('Filter System', () => {
  beforeEach(() => {
    cy.visit('/filter');
    // Wait for initial data load
    cy.get('[data-testid="filter-builder"]').should('exist');
  });

  it('should filter claims less than 6 days from today', () => {
    // Select admission_date column
    cy.get('[data-testid="column-select"]').click();
    cy.contains('Admission Date').click();

    // Select between_date operator
    cy.get('[data-testid="operator-select"]').click();
    cy.contains('between date').click();

    // Select "Today" as reference date
    cy.get('[data-testid="date-select"]').click();
    cy.contains('Today').click();

    // Set "less than" comparison
    cy.get('[data-testid="comparison-select"]').click();
    cy.contains('Less Than').click();

    // Enter 6 as the value
    cy.get('[data-testid="value-input"]').type('6');

    // Select "days" as the unit
    cy.get('[data-testid="unit-select"]').click();
    cy.contains('Days').click();

    // Apply filter
    cy.get('button').contains('Apply Filter').click();

    // Verify results
    cy.get('[data-testid="claims-table"]').within(() => {
      // Should only show claims from the last 6 days
      cy.get('tr').should('have.length.gt', 1); // Header + at least one row
      cy.get('td').contains('2025-02-14').should('exist');
      cy.get('td').contains('2025-01-01').should('not.exist');
    });

    // Verify statistics
    cy.get('[data-testid="statistics-panel"]').within(() => {
      cy.contains('Unique Claims:').next().should('not.contain', '0');
      cy.contains('Date Range:').next().should('contain', '2025-02-14');
    });
  });

  it('should filter claims greater than 6 days from today', () => {
    // Select admission_date column
    cy.get('[data-testid="column-select"]').click();
    cy.contains('Admission Date').click();

    // Select between_date operator
    cy.get('[data-testid="operator-select"]').click();
    cy.contains('between date').click();

    // Select "Today" as reference date
    cy.get('[data-testid="date-select"]').click();
    cy.contains('Today').click();

    // Set "greater than" comparison
    cy.get('[data-testid="comparison-select"]').click();
    cy.contains('Greater Than').click();

    // Enter 6 as the value
    cy.get('[data-testid="value-input"]').type('6');

    // Select "days" as the unit
    cy.get('[data-testid="unit-select"]').click();
    cy.contains('Days').click();

    // Apply filter
    cy.get('button').contains('Apply Filter').click();

    // Verify results
    cy.get('[data-testid="claims-table"]').within(() => {
      // Should only show claims older than 6 days
      cy.get('tr').should('have.length.gt', 1);
      cy.get('td').contains('2025-02-14').should('not.exist');
      cy.get('td').contains('2025-01-01').should('exist');
    });
  });

  it('should save and load filters', () => {
    // Create a filter
    cy.get('[data-testid="column-select"]').click();
    cy.contains('Admission Date').click();
    cy.get('[data-testid="operator-select"]').click();
    cy.contains('between date').click();
    cy.get('[data-testid="date-select"]').click();
    cy.contains('Today').click();
    cy.get('[data-testid="comparison-select"]').click();
    cy.contains('Less Than').click();
    cy.get('[data-testid="value-input"]').type('6');
    cy.get('[data-testid="unit-select"]').click();
    cy.contains('Days').click();

    // Save the filter
    cy.get('button').contains('Save Filter').click();
    cy.get('[data-testid="filter-name-input"]').type('Test Filter');
    cy.get('button').contains('Save').click();

    // Reset the filter
    cy.get('button').contains('Reset Filter').click();

    // Load the saved filter
    cy.get('[data-testid="saved-filters-select"]').click();
    cy.contains('Test Filter').click();

    // Verify the filter is loaded correctly
    cy.get('[data-testid="claims-table"]').within(() => {
      cy.get('td').contains('2025-02-14').should('exist');
      cy.get('td').contains('2025-01-01').should('not.exist');
    });
  });
}); 