'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '@/app/config';

interface DatabaseInfo {
  status: string;
  message: string;
  data?: {
    timestamp: string;
    database: string;
    version: string;
  };
  error?: string;
}

interface TablesInfo {
  status: string;
  tables?: string[];
  error?: string;
}

export default function TestPage() {
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [tablesInfo, setTablesInfo] = useState<TablesInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('Fetching from:', `${getApiUrl()}/api/test/test-db`);
        
        // Test DB connection
        const dbResponse = await fetch(`${getApiUrl()}/api/test/test-db`);
        if (!dbResponse.ok) {
          throw new Error(`Database connection test failed: ${dbResponse.statusText}`);
        }
        const dbData = await dbResponse.json();
        console.log('DB Response:', dbData);
        setDbInfo(dbData);

        // Get tables
        const tablesResponse = await fetch(`${getApiUrl()}/api/test/tables`);
        if (!tablesResponse.ok) {
          throw new Error(`Failed to fetch tables: ${tablesResponse.statusText}`);
        }
        const tablesData = await tablesResponse.json();
        console.log('Tables Response:', tablesData);
        setTablesInfo(tablesData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Neon Database Connection Test</h1>
      
      {/* Database Connection Status */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mb-2">
            <span className="font-medium">Status: </span>
            <span className={dbInfo?.status === 'success' ? 'text-green-600' : 'text-red-600'}>
              {dbInfo?.status}
            </span>
          </div>
          <div className="mb-2">
            <span className="font-medium">Message: </span>
            {dbInfo?.message}
          </div>
          {dbInfo?.data && (
            <>
              <div className="mb-2">
                <span className="font-medium">Timestamp: </span>
                {new Date(dbInfo.data.timestamp).toLocaleString()}
              </div>
              <div className="mb-2">
                <span className="font-medium">Database: </span>
                {dbInfo.data.database}
              </div>
              <div className="mb-2">
                <span className="font-medium">Version: </span>
                {dbInfo.data.version}
              </div>
            </>
          )}
          {dbInfo?.error && (
            <div className="text-red-600">
              <span className="font-medium">Error: </span>
              {dbInfo.error}
            </div>
          )}
        </div>
      </div>

      {/* Database Tables */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Database Tables</h2>
        <div className="bg-white p-6 rounded-lg shadow-md">
          {tablesInfo?.status === 'success' ? (
            <div>
              <div className="mb-2 font-medium">Available Tables:</div>
              {tablesInfo.tables && tablesInfo.tables.length > 0 ? (
                <ul className="list-disc pl-6">
                  {tablesInfo.tables.map((table, index) => (
                    <li key={index} className="mb-1">{table}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No tables found in the database.</p>
              )}
            </div>
          ) : (
            <div className="text-red-600">
              <span className="font-medium">Error: </span>
              {tablesInfo?.error || 'Failed to fetch tables'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 