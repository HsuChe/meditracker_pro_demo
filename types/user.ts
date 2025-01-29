export interface User {
  id: string
  name: string
  email: string
  role: string
  phoneNumber: string
  isActive: boolean
  status: "Active" | "Inactive" | "Pending"
  permissions: {
    claimManagement: {
      caseManagement: boolean
      saasDashboard: boolean
    }
    filterManagement: {
      filter: boolean
      filterDashboard: boolean
      ingestion: boolean
    }
  }
  lastLogin: string
  createdAt: string
  avatarUrl: string
  workspace: string
}

export interface AdminWorkspace {
  name: string
  canDelete: boolean
}

