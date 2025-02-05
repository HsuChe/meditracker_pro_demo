import React from 'react';
import { Statistics } from '../types';

interface StatisticsPanelProps {
  statistics: Statistics | null;
}

const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ statistics }) => {
  if (!statistics) return null;

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Dataset Statistics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground mb-2">Unique Claims</div>
          <div className="text-lg md:text-xl font-bold truncate">
            {(statistics.uniqueClaimIds || 0).toLocaleString()}
          </div>
        </div>
        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground mb-2">Date Range</div>
          <div className="text-lg md:text-xl font-bold truncate">
            {statistics.dateRange ? (
              <>
                {new Date(statistics.dateRange.min).toLocaleDateString()} - {new Date(statistics.dateRange.max).toLocaleDateString()}
              </>
            ) : (
              'N/A'
            )}
          </div>
        </div>
        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground mb-2">Total Allowed Amount</div>
          <div className="text-lg md:text-xl font-bold truncate">
            ${(statistics.totalAllowedAmount || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground mb-2">Total Records</div>
          <div className="text-lg md:text-xl font-bold truncate">
            {(statistics.totalRecords || 0).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPanel;