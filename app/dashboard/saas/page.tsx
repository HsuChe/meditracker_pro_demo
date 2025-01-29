"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

// Mock data for the table
const mockTableData = [
  {
    id: 1,
    patientName: "John Doe",
    claimAmount: 1000,
    status: "Approved",
    cptCode: "99213",
    group: "Group A",
    facility: "Facility 1",
  },
  {
    id: 2,
    patientName: "Jane Smith",
    claimAmount: 1500,
    status: "Denied",
    cptCode: "99214",
    group: "Group B",
    facility: "Facility 2",
  },
  {
    id: 3,
    patientName: "Alice Johnson",
    claimAmount: 800,
    status: "Approved",
    cptCode: "99211",
    group: "Group C",
    facility: "Facility 3",
  },
  {
    id: 4,
    patientName: "Bob Williams",
    claimAmount: 2000,
    status: "Denied",
    cptCode: "99215",
    group: "Group A",
    facility: "Facility 1",
  },
  {
    id: 5,
    patientName: "Charlie Brown",
    claimAmount: 1200,
    status: "Approved",
    cptCode: "99212",
    group: "Group B",
    facility: "Facility 2",
  },
]

// Mock data for charts
const monthlyClaimsData = [
  { month: "Jan", approved: 100, denied: 20 },
  { month: "Feb", approved: 120, denied: 25 },
  { month: "Mar", approved: 110, denied: 18 },
  { month: "Apr", approved: 130, denied: 22 },
  { month: "May", approved: 140, denied: 30 },
  { month: "Jun", approved: 125, denied: 28 },
]

const topProblematicCPTCodes = [
  { cptCode: "99214", count: 50 },
  { cptCode: "99213", count: 40 },
  { cptCode: "99215", count: 30 },
  { cptCode: "99212", count: 25 },
  { cptCode: "99211", count: 20 },
]

const topSavedFilters = [
  { filterName: "High Value Claims", count: 100 },
  { filterName: "Denied Claims", count: 80 },
  { filterName: "New Patients", count: 60 },
  { filterName: "Specific Provider", count: 50 },
  { filterName: "Date Range", count: 40 },
]

const topGroupsDenial = [
  { group: "Group A", count: 30 },
  { group: "Group B", count: 25 },
  { group: "Group C", count: 20 },
  { group: "Group D", count: 15 },
  { group: "Group E", count: 10 },
]

const topFacilitiesDenial = [
  { facility: "Facility 1", count: 40 },
  { facility: "Facility 2", count: 35 },
  { facility: "Facility 3", count: 30 },
  { facility: "Facility 4", count: 25 },
  { facility: "Facility 5", count: 20 },
]

const topGroupsDeniedValue = [
  { group: "Group A", value: 50000 },
  { group: "Group B", value: 45000 },
  { group: "Group C", value: 40000 },
  { group: "Group D", value: 35000 },
  { group: "Group E", value: 30000 },
  { group: "Group F", value: 25000 },
  { group: "Group G", value: 20000 },
  { group: "Group H", value: 15000 },
  { group: "Group I", value: 10000 },
  { group: "Group J", value: 5000 },
]

const chartColors = [
  "hsl(220, 70%, 60%)",
  "hsl(220, 70%, 50%)",
  "hsl(220, 70%, 40%)",
  "hsl(220, 70%, 30%)",
  "hsl(220, 70%, 20%)",
]

export default function SaaSDashboardPage() {
  const [selectedFilter, setSelectedFilter] = useState("")
  const [exportName, setExportName] = useState("")

  const handleExport = useCallback(() => {
    const fileName = exportName || `${selectedFilter}_${new Date().toISOString()}.csv`
    // Here you would implement the actual CSV export logic
    console.log(`Exporting ${fileName}`)
    // Reset export name after export
    setExportName("")
  }, [selectedFilter, exportName])

  const totalClaimsApproved = mockTableData.filter((claim) => claim.status === "Approved").length
  const totalClaimsDenied = mockTableData.filter((claim) => claim.status === "Denied").length
  const totalClaims = mockTableData.length
  const percentageDenial = ((totalClaimsDenied / totalClaims) * 100).toFixed(2)
  const percentFirstAttempt = ((totalClaimsApproved / totalClaims) * 100).toFixed(2)
  const totalDeniedValue = mockTableData
    .filter((claim) => claim.status === "Denied")
    .reduce((sum, claim) => sum + claim.claimAmount, 0)

  return (
    <div className="container mx-auto px-4 py-8 bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-8">SaaS Dashboard</h1>

      <Card className="mb-8 bg-secondary">
        <CardHeader>
          <CardTitle className="text-foreground">Claims Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="w-[200px] bg-background text-foreground">
                <SelectValue placeholder="Select filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filter1">Filter 1</SelectItem>
                <SelectItem value="filter2">Filter 2</SelectItem>
                <SelectItem value="filter3">Filter 3</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Export file name"
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
              className="w-[200px] bg-background text-foreground"
            />
            <Button onClick={handleExport}>Export CSV</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead className="text-foreground">Patient Name</TableHead>
                <TableHead className="text-foreground">Claim Amount</TableHead>
                <TableHead className="text-foreground">Status</TableHead>
                <TableHead className="text-foreground">CPT Code</TableHead>
                <TableHead className="text-foreground">Group</TableHead>
                <TableHead className="text-foreground">Facility</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTableData.map((row) => (
                <TableRow key={row.id} className="border-b border-border">
                  <TableCell className="text-foreground">{row.patientName}</TableCell>
                  <TableCell className="text-foreground">${row.claimAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-foreground">{row.status}</TableCell>
                  <TableCell className="text-foreground">{row.cptCode}</TableCell>
                  <TableCell className="text-foreground">{row.group}</TableCell>
                  <TableCell className="text-foreground">{row.facility}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle className="text-foreground">Total Claims Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalClaimsApproved}</div>
          </CardContent>
        </Card>
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle className="text-foreground">Total Claims Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalClaimsDenied}</div>
          </CardContent>
        </Card>
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle className="text-foreground">Percentage of Denial to Total Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{percentageDenial}%</div>
          </CardContent>
        </Card>
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle className="text-foreground">Percent of Claims 1st Attempt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{percentFirstAttempt}%</div>
          </CardContent>
        </Card>
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle className="text-foreground">Total Denied Dollar Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${totalDeniedValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle className="text-foreground">Monthly Denial and Approval Peaks</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300} style={{ backgroundColor: "hsl(var(--card))" }}>
              <BarChart data={monthlyClaimsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
                <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
                <Bar dataKey="approved" fill={chartColors[0]} name="Approved" />
                <Bar dataKey="denied" fill={chartColors[1]} name="Denied" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle className="text-foreground">Top 5 Problematic CPT/Procedure Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300} style={{ backgroundColor: "hsl(var(--card))" }}>
              <BarChart data={topProblematicCPTCodes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="cptCode" type="category" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
                <Bar dataKey="count" fill={chartColors[2]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle className="text-foreground">Top 5 Saved Filter Count</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300} style={{ backgroundColor: "hsl(var(--card))" }}>
              <BarChart data={topSavedFilters} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="filterName" type="category" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
                <Bar dataKey="count" fill={chartColors[3]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle className="text-foreground">Top 5 Groups Denial</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300} style={{ backgroundColor: "hsl(var(--card))" }}>
              <BarChart data={topGroupsDenial} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="group" type="category" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
                <Bar dataKey="count" fill={chartColors[4]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle className="text-foreground">Top 5 Facilities Denial</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300} style={{ backgroundColor: "hsl(var(--card))" }}>
              <BarChart data={topFacilitiesDenial} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="facility" type="category" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
                <Bar dataKey="count" fill={chartColors[0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle className="text-foreground">Top 10 Groups based on Denied Dollar Value</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400} style={{ backgroundColor: "hsl(var(--card))" }}>
              <BarChart data={topGroupsDeniedValue}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.2} />
                <XAxis dataKey="group" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend wrapperStyle={{ color: "hsl(var(--muted-foreground))" }} />
                <Bar dataKey="value" fill={chartColors[1]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

