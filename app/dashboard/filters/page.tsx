"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"

// Sample data for the line graph
const timeSeriesData = [
  { month: "Jan", lossRatio: 65, claimDenialRate: 12 },
  { month: "Feb", lossRatio: 68, claimDenialRate: 10 },
  { month: "Mar", lossRatio: 70, claimDenialRate: 11 },
  { month: "Apr", lossRatio: 72, claimDenialRate: 9 },
  { month: "May", lossRatio: 69, claimDenialRate: 10 },
  { month: "Jun", lossRatio: 71, claimDenialRate: 8 },
]

// Sample filter data
const filterData = [
  {
    id: 1,
    name: "Filter 1",
    rows: 1000,
    value: 50000,
    specificity: 0.8,
    sensitivity: 0.9,
    latency: 50,
    errorRate: 0.02,
    confidenceScore: 0.95,
    predictionDrift: 0.03,
  },
  {
    id: 2,
    name: "Filter 2",
    rows: 800,
    value: 40000,
    specificity: 0.7,
    sensitivity: 0.95,
    latency: 45,
    errorRate: 0.03,
    confidenceScore: 0.92,
    predictionDrift: 0.04,
  },
  {
    id: 3,
    name: "Filter 3",
    rows: 1200,
    value: 60000,
    specificity: 0.85,
    sensitivity: 0.88,
    latency: 55,
    errorRate: 0.01,
    confidenceScore: 0.97,
    predictionDrift: 0.02,
  },
  {
    id: 4,
    name: "Filter 4",
    rows: 950,
    value: 47500,
    specificity: 0.82,
    sensitivity: 0.91,
    latency: 48,
    errorRate: 0.02,
    confidenceScore: 0.94,
    predictionDrift: 0.03,
  },
  {
    id: 5,
    name: "Filter 5",
    rows: 1100,
    value: 55000,
    specificity: 0.79,
    sensitivity: 0.93,
    latency: 52,
    errorRate: 0.02,
    confidenceScore: 0.93,
    predictionDrift: 0.04,
  },
  {
    id: 6,
    name: "Filter 6",
    rows: 750,
    value: 37500,
    specificity: 0.75,
    sensitivity: 0.92,
    latency: 47,
    errorRate: 0.03,
    confidenceScore: 0.91,
    predictionDrift: 0.05,
  },
  {
    id: 7,
    name: "Filter 7",
    rows: 1300,
    value: 65000,
    specificity: 0.87,
    sensitivity: 0.89,
    latency: 58,
    errorRate: 0.01,
    confidenceScore: 0.96,
    predictionDrift: 0.02,
  },
  {
    id: 8,
    name: "Filter 8",
    rows: 900,
    value: 45000,
    specificity: 0.81,
    sensitivity: 0.94,
    latency: 49,
    errorRate: 0.02,
    confidenceScore: 0.95,
    predictionDrift: 0.03,
  },
  {
    id: 9,
    name: "Filter 9",
    rows: 1050,
    value: 52500,
    specificity: 0.83,
    sensitivity: 0.9,
    latency: 51,
    errorRate: 0.02,
    confidenceScore: 0.94,
    predictionDrift: 0.03,
  },
  {
    id: 10,
    name: "Filter 10",
    rows: 850,
    value: 42500,
    specificity: 0.78,
    sensitivity: 0.93,
    latency: 46,
    errorRate: 0.03,
    confidenceScore: 0.92,
    predictionDrift: 0.04,
  },
  {
    id: 11,
    name: "Filter 11",
    rows: 1150,
    value: 57500,
    specificity: 0.84,
    sensitivity: 0.91,
    latency: 53,
    errorRate: 0.02,
    confidenceScore: 0.95,
    predictionDrift: 0.03,
  },
  {
    id: 12,
    name: "Filter 12",
    rows: 700,
    value: 35000,
    specificity: 0.76,
    sensitivity: 0.94,
    latency: 44,
    errorRate: 0.03,
    confidenceScore: 0.9,
    predictionDrift: 0.05,
  },
  {
    id: 13,
    name: "Filter 13",
    rows: 1250,
    value: 62500,
    specificity: 0.86,
    sensitivity: 0.87,
    latency: 57,
    errorRate: 0.01,
    confidenceScore: 0.97,
    predictionDrift: 0.02,
  },
  {
    id: 14,
    name: "Filter 14",
    rows: 975,
    value: 48750,
    specificity: 0.8,
    sensitivity: 0.92,
    latency: 50,
    errorRate: 0.02,
    confidenceScore: 0.93,
    predictionDrift: 0.04,
  },
  {
    id: 15,
    name: "Filter 15",
    rows: 1025,
    value: 51250,
    specificity: 0.82,
    sensitivity: 0.89,
    latency: 52,
    errorRate: 0.02,
    confidenceScore: 0.94,
    predictionDrift: 0.03,
  },
]

export default function FilterDashboardPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const filtersPerPage = 5
  const totalPages = Math.ceil(filterData.length / filtersPerPage)

  const indexOfLastFilter = currentPage * filtersPerPage
  const indexOfFirstFilter = indexOfLastFilter - filtersPerPage
  const currentFilters = filterData.slice(indexOfFirstFilter, indexOfLastFilter)

  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Filter Dashboard</h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clean Claim Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92.5%</div>
            <p className="text-xs text-muted-foreground">+2.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Claim Denial Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7.5%</div>
            <p className="text-xs text-muted-foreground">-1.3% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Claim Processing Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14.2 Days</div>
            <p className="text-xs text-muted-foreground">-0.8 days from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Claim Closure Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.05</div>
            <p className="text-xs text-muted-foreground">+0.02 from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loss Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">68.3%</div>
            <p className="text-xs text-muted-foreground">-1.5% from last month</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Loss Ratio and Claim Denial Rate Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeriesData}>
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="lossRatio" stroke="#8884d8" name="Loss Ratio (%)" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="claimDenialRate"
                stroke="#82ca9d"
                name="Claim Denial Rate (%)"
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
            <TableHead>Rows</TableHead>
            <TableHead>Value ($)</TableHead>
            <TableHead>Specificity</TableHead>
            <TableHead>Sensitivity</TableHead>
            <TableHead>Latency (ms)</TableHead>
            <TableHead>Error Rate</TableHead>
            <TableHead>Confidence Score</TableHead>
            <TableHead>Prediction Drift</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentFilters.map((filter) => (
            <TableRow key={filter.id}>
              <TableCell>{filter.name}</TableCell>
              <TableCell>{filter.rows}</TableCell>
              <TableCell>${filter.value.toLocaleString()}</TableCell>
              <TableCell>{filter.specificity.toFixed(2)}</TableCell>
              <TableCell>{filter.sensitivity.toFixed(2)}</TableCell>
              <TableCell>{filter.latency}</TableCell>
              <TableCell>{filter.errorRate.toFixed(3)}</TableCell>
              <TableCell>{filter.confidenceScore.toFixed(2)}</TableCell>
              <TableCell>{filter.predictionDrift.toFixed(3)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-between items-center mt-4">
        <div>
          Showing {indexOfFirstFilter + 1} - {Math.min(indexOfLastFilter, filterData.length)} of {filterData.length}
        </div>
        <div className="flex gap-2">
          <Button onClick={prevPage} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button onClick={nextPage} disabled={currentPage === totalPages}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

