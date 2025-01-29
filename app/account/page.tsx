"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Download, Mail, Trash2, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import type { User, AdminWorkspace } from "@/types/user"
import { FileInput } from "@/components/ui/file-input"

// Mock authentication
const isAuthenticated = () => {
  return localStorage.getItem("isAuthenticated") === "true"
}

// Update the isAdmin function
const isAdmin = (user: User) => {
  return user.workspace === "Administration"
}

const mockUsers: User[] = [
  {
    id: "1",
    name: "Admin User",
    email: "admin@example.com",
    role: "Administrator",
    phoneNumber: "+1234567890",
    isActive: true,
    status: "Active",
    permissions: {
      claimManagement: {
        caseManagement: true,
        saasDashboard: true,
      },
      filterManagement: {
        filter: true,
        filterDashboard: true,
        ingestion: true,
      },
    },
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    avatarUrl: "",
    workspace: "Administration",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "Analyst",
    phoneNumber: "+1987654321",
    isActive: false,
    status: "Inactive",
    permissions: {
      claimManagement: {
        caseManagement: false,
        saasDashboard: false,
      },
      filterManagement: {
        filter: true,
        filterDashboard: false,
        ingestion: true,
      },
    },
    lastLogin: "2023-06-30T15:45:00Z",
    createdAt: "2023-02-15T00:00:00Z",
    avatarUrl: "",
    workspace: "Sales",
  },
  {
    id: "3",
    name: "John Doe",
    email: "john@example.com",
    role: "Manager",
    phoneNumber: "+1234567890",
    isActive: true,
    status: "Active",
    permissions: {
      claimManagement: {
        caseManagement: true,
        saasDashboard: true,
      },
      filterManagement: {
        filter: true,
        filterDashboard: true,
        ingestion: true,
      },
    },
    lastLogin: "2023-07-01T10:30:00Z",
    createdAt: "2023-01-01T00:00:00Z",
    avatarUrl: "",
    workspace: "Marketing",
  },
]

export default function AccountPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [admin, setAdmin] = useState(false)
  const router = useRouter()
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [currentUser, setCurrentUser] = useState<User>(mockUsers[0])
  const [adminWorkspaces, setAdminWorkspaces] = useState<AdminWorkspace[]>([
    { name: "Administration", canDelete: false },
    { name: "Marketing", canDelete: true },
    { name: "Sales", canDelete: true },
    { name: "Engineering", canDelete: true },
  ])
  const [newWorkspace, setNewWorkspace] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive" | "Pending">("All")
  const { toast } = useToast()
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    const auth = isAuthenticated()
    setAuthenticated(auth)
    if (!auth) {
      router.push("/login")
    } else {
      const email = localStorage.getItem("userEmail") || ""
      const workspace = localStorage.getItem("userWorkspace") || ""
      setUserEmail(email)
      const user = users.find((u) => u.email === email) || {
        ...mockUsers[0],
        email: email,
        name: email.split("@")[0],
        workspace: workspace,
      }
      setCurrentUser(user)
      setAdmin(isAdmin(user))
    }
  }, [router, users])

  const toggleUserStatus = (userId: string) => {
    setUsers(
      users.map((user) => {
        if (user.id === userId) {
          const newStatus = user.isActive ? "Inactive" : "Active"
          return { ...user, isActive: !user.isActive, status: newStatus }
        }
        return user
      }),
    )
  }

  const togglePermission = (userId: string, category: "claimManagement" | "filterManagement", permission: string) => {
    setUsers(
      users.map((user) => {
        if (user.id === userId) {
          return {
            ...user,
            permissions: {
              ...user.permissions,
              [category]: {
                ...user.permissions[category],
                [permission]:
                  !user.permissions[category][permission as keyof (typeof user.permissions)[typeof category]],
              },
            },
          }
        }
        return user
      }),
    )
  }

  const sendInvitation = () => {
    if (inviteEmail && !users.some((user) => user.email === inviteEmail)) {
      const newUser: User = {
        id: (users.length + 1).toString(),
        name: "Pending User",
        email: inviteEmail,
        role: "Pending",
        phoneNumber: "",
        isActive: false,
        status: "Pending",
        permissions: {
          claimManagement: {
            caseManagement: false,
            saasDashboard: false,
          },
          filterManagement: {
            filter: false,
            filterDashboard: false,
            ingestion: false,
          },
        },
        lastLogin: "",
        createdAt: new Date().toISOString(),
        avatarUrl: "",
        workspace: "",
      }
      setUsers([...users, newUser])
      toast({
        title: "Invitation Sent",
        description: `An invitation has been sent to ${inviteEmail}`,
      })
      setInviteEmail("")
    } else if (users.some((user) => user.email === inviteEmail)) {
      toast({
        title: "Invitation Already Sent",
        description: `An invitation has already been sent to ${inviteEmail}`,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
    }
  }

  const deleteInvitation = (userId: string) => {
    setUsers(users.filter((user) => user.id !== userId))
    toast({
      title: "Invitation Deleted",
      description: "The pending invitation has been deleted",
    })
  }

  const exportUserActivity = (userId: string) => {
    console.log(`Exporting activity for user ${userId}`)
    alert(`Activity for user ${userId} exported to CSV`)
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // In a real app, you'd upload the file to a server and get a URL back
      const reader = new FileReader()
      reader.onload = (e) => {
        setCurrentUser({ ...currentUser, avatarUrl: e.target?.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  const addWorkspace = () => {
    if (newWorkspace && !adminWorkspaces.some((w) => w.name === newWorkspace)) {
      setAdminWorkspaces([...adminWorkspaces, { name: newWorkspace, canDelete: true }])
      setNewWorkspace("")
    }
  }

  const deleteWorkspace = (workspaceName: string) => {
    const usersInWorkspace = users.filter((user) => user.workspace === workspaceName).length
    if (usersInWorkspace > 0) {
      toast({
        title: "Cannot Delete Workspace",
        description: `There are ${usersInWorkspace} user(s) in this workspace. Remove all users before deleting.`,
        variant: "destructive",
      })
      return
    }
    setAdminWorkspaces(adminWorkspaces.filter((w) => w.name !== workspaceName))
  }

  const changeUserWorkspace = (userId: string, workspace: string) => {
    setUsers(
      users.map((user) => {
        if (user.id === userId) {
          if (user.workspace === "Administration") {
            // Don't change the workspace if the user is already in Administration
            return user
          }
          const newUser = { ...user, workspace }
          // If the new workspace is "Administration", grant admin privileges
          if (workspace === "Administration") {
            newUser.permissions = {
              claimManagement: { caseManagement: true, saasDashboard: true },
              filterManagement: { filter: true, filterDashboard: true, ingestion: true },
            }
          }
          return newUser
        }
        return user
      }),
    )
  }

  const filteredUsers = users.filter((user) => {
    if (statusFilter === "All") return true
    return user.status === statusFilter
  })

  if (!authenticated) {
    return null // or a loading spinner
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                <AvatarFallback>
                  {currentUser.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar">Profile Picture</Label>
                <FileInput id="avatar" accept="image/*" onChange={handleImageUpload} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={currentUser.name}
                  onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={currentUser.role}
                  onChange={(e) => setCurrentUser({ ...currentUser, role: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={currentUser.phoneNumber}
                  onChange={(e) => setCurrentUser({ ...currentUser, phoneNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Last Login</Label>
                <Input value={new Date(currentUser.lastLogin).toLocaleString()} readOnly />
              </div>
              <div>
                <Label>Account Created</Label>
                <Input value={new Date(currentUser.createdAt).toLocaleString()} readOnly />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={() => {
              console.log("Saving changes:", currentUser)
              alert("Changes saved!")
            }}
          >
            Save Changes
          </Button>
        </CardFooter>
      </Card>

      {currentUser.workspace === "Administration" && (
        <Card>
          <CardHeader>
            <CardTitle>Administration</CardTitle>
            <CardDescription>Manage users and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label htmlFor="status-filter">Filter by Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value: "All" | "Active" | "Inactive" | "Pending") => setStatusFilter(value)}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/6">User Information</TableHead>
                  <TableHead className="w-1/6">Claim Management</TableHead>
                  <TableHead className="w-1/6">Filter Management</TableHead>
                  <TableHead className="w-1/6">Actions</TableHead>
                  <TableHead className="w-1/6">Workspace</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="align-top">
                      <div className="grid gap-2">
                        <div className="font-semibold">{user.name}</div>
                        <div>{user.email}</div>
                        <div>{user.role}</div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={user.isActive}
                            onCheckedChange={() => toggleUserStatus(user.id)}
                            disabled={user.status === "Pending"}
                          />
                          <span>{user.status}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="grid gap-2">
                        {Object.entries(user.permissions.claimManagement).map(([key, value]) => (
                          <Button
                            key={key}
                            variant={value ? "default" : "outline"}
                            size="sm"
                            className="w-full text-left justify-start"
                            onClick={() => togglePermission(user.id, "claimManagement", key)}
                            disabled={user.status === "Pending"}
                          >
                            {key === "caseManagement" ? "Case Management" : "SaaS Dashboard"}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="grid gap-2">
                        {Object.entries(user.permissions.filterManagement).map(([key, value]) => (
                          <Button
                            key={key}
                            variant={value ? "default" : "outline"}
                            size="sm"
                            className="w-full text-left justify-start"
                            onClick={() => togglePermission(user.id, "filterManagement", key)}
                            disabled={user.status === "Pending"}
                          >
                            {key === "filter" ? "Filter" : key === "filterDashboard" ? "Filter Dashboard" : "Ingestion"}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="grid gap-2 h-full">
                        {user.status === "Pending" ? (
                          <Button
                            variant="destructive"
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            size="sm"
                            className="h-9"
                            onClick={() => deleteInvitation(user.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Invitation
                          </Button>
                        ) : (
                          <>
                            <div className="text-sm">
                              <div>Created: {new Date(user.createdAt).toLocaleDateString()}</div>
                              <div>
                                Last Activity: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "N/A"}
                              </div>
                            </div>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-9"
                              onClick={() => exportUserActivity(user.id)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Export Activity (.csv)
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end h-full">
                        <Select
                          value={user.workspace}
                          onValueChange={(value) => changeUserWorkspace(user.id, value)}
                          disabled={user.status === "Pending" || user.workspace === "Administration"}
                        >
                          <SelectTrigger className="w-[180px] h-9">
                            <SelectValue placeholder="Select workspace" />
                          </SelectTrigger>
                          <SelectContent>
                            {adminWorkspaces.map((workspace) => (
                              <SelectItem
                                key={workspace.name}
                                value={workspace.name}
                                className="flex justify-between items-center group"
                              >
                                {workspace.name}
                                {workspace.canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deleteWorkspace(workspace.name)
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </SelectItem>
                            ))}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" className="w-full mt-2">
                                  Add Workspace
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                  <DialogTitle>Add New Workspace</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-left">
                                      Name
                                    </Label>
                                    <Input
                                      id="name"
                                      value={newWorkspace}
                                      onChange={(e) => setNewWorkspace(e.target.value)}
                                      className="col-span-3"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button onClick={addWorkspace}>Add Workspace</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter>
            <div className="flex items-center space-x-2 w-full">
              <Input
                type="email"
                placeholder="Enter email to invite"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button onClick={sendInvitation}>
                <Mail className="mr-2 h-4 w-4" />
                Invite User
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

