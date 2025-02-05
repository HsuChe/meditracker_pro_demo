"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"

interface SavedFilter {
  filter_id: number
  name: string
  description: string
  conditions: any
  claims_ids: string[]
  created_by: string
  created_at: string
  last_updated: string
  run_count: number
  last_run: string
}

interface FilterStats {
  detection_rate: number
  total_claims: number
  matched_claims: number
  last_execution_time: number
  error_rate: number
  confidence_score: number
  prediction_drift: number
}

interface FilterWithStats extends SavedFilter {
  stats: FilterStats
}

export default function FilterDashboardPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterWithStats[]>([])
  const [totalFilters, setTotalFilters] = useState(0)
  const [totalClaimsInSystem, setTotalClaimsInSystem] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filtersPerPage = 5

  // Fetch total claims count
  useEffect(() => {
    const fetchTotalClaims = async () => {
      try {
        const response = await fetch('/api/filters/claims')
        const data = await response.json()
        setTotalClaimsInSystem(data.totalClaims || 400000) // Fallback to 400,000 if API fails
      } catch (err) {
        console.error("Error fetching total claims:", err)
        setTotalClaimsInSystem(400000) // Fallback to 400,000 if API fails
      }
    }

    fetchTotalClaims()
  }, [])

  // Fetch saved filters and their stats
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setLoading(true)
        // Fetch saved filters - updated endpoint
        const filtersResponse = await fetch(`/api/filters/saved?page=${currentPage}&limit=${filtersPerPage}`)
        const filtersData = await filtersResponse.json()

        if (!filtersData.filters) {
          throw new Error('Invalid response format')
        }

        // For each filter, fetch its stats
        const filtersWithStats = await Promise.all(
          filtersData.filters.map(async (filter: SavedFilter) => {
            // Get claims data for this filter - updated endpoint
            const statsResponse = await fetch(`/api/filters/execute/${filter.filter_id}`)
            const statsData = await statsResponse.json()

            // Calculate stats using total claims from system
            const matchedClaims = filter.claims_ids?.length || 0
            const detectionRate = totalClaimsInSystem > 0 ? (matchedClaims / totalClaimsInSystem) * 100 : 0

            const stats: FilterStats = {
              detection_rate: detectionRate,
              total_claims: totalClaimsInSystem,
              matched_claims: matchedClaims,
              last_execution_time: statsData.execution_time_ms || 0,
              error_rate: 0.02, // TODO: Calculate from actual data
              confidence_score: 0.95, // TODO: Calculate from actual data
              prediction_drift: 0.03, // TODO: Calculate from actual data
            }

            return { ...filter, stats }
          })
        )

        setFilters(filtersWithStats)
        setTotalFilters(filtersData.pagination.total)
        setError(null)
      } catch (err) {
        console.error("Error fetching filters:", err)
        setError("Failed to load filters. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchFilters()
  }, [currentPage, totalClaimsInSystem]) // Added totalClaimsInSystem as dependency

  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(totalFilters / filtersPerPage)))
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>
  }

  // Calculate aggregate statistics
  const avgDetectionRate = filters.reduce((acc, f) => acc + f.stats.detection_rate, 0) / filters.length
  const totalMatchedClaims = filters.reduce((acc, f) => acc + f.stats.matched_claims, 0)

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Filter Dashboard</h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Detection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDetectionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Across all filters</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClaimsInSystem.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All claims in system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Matched Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMatchedClaims.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all filters</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Filter Performance Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={filters}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="stats.detection_rate"
                stroke="#8884d8"
                name="Detection Rate (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <h2 className="text-2xl font-semibold mb-4">Filter Performance</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filter Name</TableHead>
            <TableHead>Total Claims</TableHead>
            <TableHead>Matched Claims</TableHead>
            <TableHead>Detection Rate</TableHead>
            <TableHead>Last Run</TableHead>
            <TableHead>Error Rate</TableHead>
            <TableHead>Confidence Score</TableHead>
            <TableHead>Prediction Drift</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filters.map((filter) => (
            <TableRow key={filter.filter_id}>
              <TableCell>{filter.name}</TableCell>
              <TableCell>{filter.stats.total_claims.toLocaleString()}</TableCell>
              <TableCell>{filter.stats.matched_claims.toLocaleString()}</TableCell>
              <TableCell>{filter.stats.detection_rate.toFixed(2)}%</TableCell>
              <TableCell>{new Date(filter.last_run).toLocaleDateString()}</TableCell>
              <TableCell>{filter.stats.error_rate.toFixed(3)}</TableCell>
              <TableCell>{filter.stats.confidence_score.toFixed(2)}</TableCell>
              <TableCell>{filter.stats.prediction_drift.toFixed(3)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-between items-center mt-4">
        <div>
          Showing {(currentPage - 1) * filtersPerPage + 1} - {Math.min(currentPage * filtersPerPage, totalFilters)} of{" "}
          {totalFilters}
        </div>
        <div className="flex gap-2">
          <Button onClick={prevPage} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button onClick={nextPage} disabled={currentPage === Math.ceil(totalFilters / filtersPerPage)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

