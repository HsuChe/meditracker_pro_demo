import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatisticsPanel from '@/app/filter/components/Statistics';
import { Statistics } from '@/app/filter/types';

describe('StatisticsPanel', () => {
  it('renders nothing when statistics are null', () => {
    render(<StatisticsPanel statistics={null} />);
    expect(screen.queryByText('Dataset Statistics')).not.toBeInTheDocument();
  });

  it('renders all statistics sections with correct headings', () => {
    const stats: Statistics = {
      uniqueClaimIds: 1000,
      dateRange: { min: '2023-12-31', max: '2024-12-30' },
      totalAllowedAmount: 50000.50,
      totalRecords: 2000
    };

    render(<StatisticsPanel statistics={stats} />);

    expect(screen.getByText('Dataset Statistics')).toBeInTheDocument();
    expect(screen.getByText('Unique Claims')).toBeInTheDocument();
    expect(screen.getByText('Date Range')).toBeInTheDocument();
    expect(screen.getByText('Total Allowed Amount')).toBeInTheDocument();
    expect(screen.getByText('Total Records')).toBeInTheDocument();
  });

  it('formats unique claims count with commas', () => {
    const stats: Statistics = {
      uniqueClaimIds: 1000000,
      dateRange: { min: '2023-12-31', max: '2024-12-30' },
      totalAllowedAmount: 0,
      totalRecords: 0
    };

    render(<StatisticsPanel statistics={stats} />);
    
    const uniqueClaimsSection = screen.getByText('Unique Claims').parentElement;
    expect(uniqueClaimsSection?.querySelector('.font-bold')?.textContent).toBe('1,000,000');
  });

  it('formats date range correctly', () => {
    const stats: Statistics = {
      uniqueClaimIds: 0,
      dateRange: { min: '2023-12-31', max: '2024-12-30' },
      totalAllowedAmount: 0,
      totalRecords: 0
    };

    render(<StatisticsPanel statistics={stats} />);
    
    const dateRangeSection = screen.getByText('Date Range').parentElement;
    expect(dateRangeSection?.querySelector('.font-bold')?.textContent?.trim()).toBe('12/30/2023 - 12/29/2024');
  });

  it('shows N/A when date range is missing', () => {
    const stats: Statistics = {
      uniqueClaimIds: 0,
      dateRange: null,
      totalAllowedAmount: 0,
      totalRecords: 0
    };

    render(<StatisticsPanel statistics={stats} />);
    
    const dateRangeSection = screen.getByText('Date Range').parentElement;
    expect(dateRangeSection?.querySelector('.font-bold')?.textContent?.trim()).toBe('N/A');
  });

  it('formats total allowed amount with currency and decimals', () => {
    const stats: Statistics = {
      uniqueClaimIds: 0,
      dateRange: { min: '2023-12-31', max: '2024-12-30' },
      totalAllowedAmount: 1234567.89,
      totalRecords: 0
    };

    render(<StatisticsPanel statistics={stats} />);
    
    const allowedAmountSection = screen.getByText('Total Allowed Amount').parentElement;
    expect(allowedAmountSection?.querySelector('.font-bold')?.textContent?.trim()).toBe('$1,234,567.89');
  });

  it('formats total records with commas', () => {
    const stats: Statistics = {
      uniqueClaimIds: 0,
      dateRange: { min: '2023-12-31', max: '2024-12-30' },
      totalAllowedAmount: 0,
      totalRecords: 1000000
    };

    render(<StatisticsPanel statistics={stats} />);
    
    const totalRecordsSection = screen.getByText('Total Records').parentElement;
    expect(totalRecordsSection?.querySelector('.font-bold')?.textContent).toBe('1,000,000');
  });

  it('handles zero values correctly', () => {
    const stats: Statistics = {
      uniqueClaimIds: 0,
      dateRange: { min: '2023-12-31', max: '2024-12-30' },
      totalAllowedAmount: 0,
      totalRecords: 0
    };

    render(<StatisticsPanel statistics={stats} />);
    
    const uniqueClaimsSection = screen.getByText('Unique Claims').parentElement;
    const allowedAmountSection = screen.getByText('Total Allowed Amount').parentElement;
    const totalRecordsSection = screen.getByText('Total Records').parentElement;
    
    expect(uniqueClaimsSection?.querySelector('.font-bold')?.textContent).toBe('0');
    expect(allowedAmountSection?.querySelector('.font-bold')?.textContent?.trim()).toBe('$0.00');
    expect(totalRecordsSection?.querySelector('.font-bold')?.textContent).toBe('0');
  });

  it('handles missing values gracefully', () => {
    const stats: Statistics = {
      uniqueClaimIds: 0,
      dateRange: { min: '2023-12-31', max: '2024-12-30' },
      totalAllowedAmount: 0,
      totalRecords: 0
    };

    render(<StatisticsPanel statistics={stats} />);
    
    const uniqueClaimsSection = screen.getByText('Unique Claims').parentElement;
    const allowedAmountSection = screen.getByText('Total Allowed Amount').parentElement;
    const totalRecordsSection = screen.getByText('Total Records').parentElement;
    
    expect(uniqueClaimsSection?.querySelector('.font-bold')?.textContent).toBe('0');
    expect(allowedAmountSection?.querySelector('.font-bold')?.textContent?.trim()).toBe('$0.00');
    expect(totalRecordsSection?.querySelector('.font-bold')?.textContent).toBe('0');
  });

  it('maintains layout structure with grid classes', () => {
    const stats: Statistics = {
      uniqueClaimIds: 0,
      dateRange: { min: '2023-12-31', max: '2024-12-30' },
      totalAllowedAmount: 0,
      totalRecords: 0
    };

    render(<StatisticsPanel statistics={stats} />);
    
    const gridContainer = screen.getByText('Dataset Statistics').parentElement?.querySelector('.grid');
    expect(gridContainer).toHaveClass('grid-cols-2', 'md:grid-cols-4', 'gap-4');
  });
}); 