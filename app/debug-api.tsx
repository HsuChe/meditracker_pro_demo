"use client"

import { useState, useEffect } from 'react'
import { getApiUrl } from './config'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from '@/components/ui/button'

export default function DebugAPI() {
  const [apiUrl, setApiUrl] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get the current API URL from config
    setApiUrl(getApiUrl())
  }, [])

  const testConnection = async () => {
    setIsLoading(true)
    setError(null)
    setTestResult(null)
    
    try {
      // Try to connect to the health endpoint
      console.log('Testing connection to:', `${apiUrl}/api/health`)
      const response = await fetch(`${apiUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('API Response:', data)
      setTestResult(data)
    } catch (err) {
      console.error('API Connection Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const testIngestedData = async () => {
    setIsLoading(true)
    setError(null)
    setTestResult(null)
    
    try {
      // Try to fetch ingested data
      console.log('Testing ingested data API:', `${apiUrl}/api/ingested-data`)
      const response = await fetch(`${apiUrl}/api/ingested-data`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Ingested Data Response:', data)
      setTestResult(data)
    } catch (err) {
      console.error('Ingested Data API Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const testFiltersAPI = async () => {
    setIsLoading(true)
    setError(null)
    setTestResult(null)
    
    try {
      // Try to fetch filters
      console.log('Testing filters API:', `${apiUrl}/api/filters/claims`)
      const response = await fetch(`${apiUrl}/api/filters/claims`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Filters API Response:', data)
      setTestResult(data)
    } catch (err) {
      console.error('Filters API Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>API Connection Debugger</CardTitle>
        <CardDescription>
          Test the connection to your backend API
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="font-medium">Current API URL:</p>
            <code className="bg-muted p-2 rounded block mt-1">{apiUrl}</code>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={testConnection} disabled={isLoading}>
              {isLoading ? 'Testing...' : 'Test API Connection'}
            </Button>
            <Button onClick={testIngestedData} disabled={isLoading} variant="outline">
              {isLoading ? 'Testing...' : 'Test Ingested Data API'}
            </Button>
            <Button onClick={testFiltersAPI} disabled={isLoading} variant="outline">
              {isLoading ? 'Testing...' : 'Test Filters API'}
            </Button>
          </div>
          
          {error && (
            <div className="bg-destructive/10 p-4 rounded-md border border-destructive">
              <p className="font-medium text-destructive">Error:</p>
              <p>{error}</p>
            </div>
          )}
          
          {testResult && (
            <div className="bg-muted p-4 rounded-md">
              <p className="font-medium">Response:</p>
              <pre className="mt-2 overflow-auto max-h-64 text-sm">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
          
          <div className="bg-muted p-4 rounded-md">
            <p className="font-medium">Troubleshooting Tips:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Check that your backend is running and accessible</li>
              <li>Verify the NEXT_PUBLIC_BACKEND_URL in .env.local</li>
              <li>Look for CORS errors in your browser's console</li>
              <li>Check that your API endpoints are correct</li>
              <li>Verify any authentication requirements</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 