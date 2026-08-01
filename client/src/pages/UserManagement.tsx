/*
  User Management Page
  - Pending registration requests section (admin only)
  - Active users table with role management
  - Integrates with tRPC accessControl router
*/
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Users,
  Shield,
  Search,
  UserCog,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Briefcase,
  Hash,
  UserPlus,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const pageSize = 10;

  // Create user dialog state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "user" | "admin",
    department: "",
    specialty: "",
    employeeNumber: "",
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // Change password dialog state
  const [changingPasswordFor, setChangingPasswordFor] = useState<{
    id: number;
    openId: string;
    name: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const usersQuery = trpc.accessControl.users.useQuery();
  const modelQuery = trpc.accessControl.model.useQuery();
  const pendingQuery = trpc.accessControl.pendingUsers.useQuery(undefined, {
    enabled: currentUser?.role === "admin",
    refetchInterval: 30_000,
  });

  const assignRolesMutation = trpc.accessControl.assignRoles.useMutation({
    onSuccess: () => {
      toast.success("Roles updated successfully");
      usersQuery.refetch();
      setEditingUser(null);
    },
    onError: err =>
      toast.error("Failed to update roles", { description: err.message }),
  });

  const updateSystemRoleMutation =
    trpc.accessControl.updateSystemRole.useMutation({
      onSuccess: () => {
        toast.success("System access updated successfully");
        usersQuery.refetch();
      },
      onError: err =>
        toast.error("Update failed", { description: err.message }),
    });

  const approveUserMutation = trpc.accessControl.approveUser.useMutation({
    onSuccess: () => {
      toast.success("User approved successfully");
      pendingQuery.refetch();
      usersQuery.refetch();
    },
    onError: err =>
      toast.error("Failed to approve user", { description: err.message }),
  });

  const rejectUserMutation = trpc.accessControl.rejectUser.useMutation({
    onSuccess: () => {
      toast.success("Registration request rejected");
      pendingQuery.refetch();
      usersQuery.refetch();
    },
    onError: err =>
      toast.error("Failed to reject request", { description: err.message }),
  });

  const createUserMutation = trpc.auth.adminCreateUser.useMutation({
    onSuccess: () => {
      toast.success("User created successfully");
      usersQuery.refetch();
      setShowCreateUser(false);
      setCreateForm({
        name: "",
        email: "",
        password: "",
        role: "user",
        department: "",
        specialty: "",
        employeeNumber: "",
      });
    },
    onError: err =>
      toast.error("Failed to create user", { description: err.message }),
  });

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully");
      setChangingPasswordFor(null);
      setNewPassword("");
    },
    onError: err =>
      toast.error("Failed to change password", { description: err.message }),
  });

  const users = usersQuery.data ?? [];
  const roles = modelQuery.data?.roles ?? [];
  const pendingUsers = pendingQuery.data ?? [];

  // Filter active users only
  const activeUsers = users.filter(
    u => (u as any).userStatus === "active" || !(u as any).userStatus
  );

  const filteredUsers = activeUsers.filter(u => {
    const matchesSearch =
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.openId.toLowerCase().includes(search.toLowerCase());
    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "admin" && u.role === "admin") ||
      (roleFilter === "user" && u.role === "user") ||
      u.assignedRoles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const isAdmin = currentUser?.role === "admin";

  const handleEditRoles = (userId: number, currentRoles: string[]) => {
    setEditingUser(userId);
    setSelectedRoles([...currentRoles]);
  };

  const handleSaveRoles = () => {
    if (editingUser === null) return;
    assignRolesMutation.mutate({
      userId: editingUser,
      roleKeys: selectedRoles,
    });
  };

  const handleToggleSystemRole = (
    userId: number,
    currentRole: "user" | "admin"
  ) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    updateSystemRoleMutation.mutate({ userId, role: newRole });
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleColor = (roleKey: string) => {
    const role = roles.find(r => r.key === roleKey);
    return role?.color || "#6b7280";
  };

  const getRoleName = (roleKey: string) => {
    const role = roles.find(r => r.key === roleKey);
    return role?.name || roleKey;
  };

  return (
    <div className="space-y-6" dir="ltr">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review registered users, access levels, roles, and registration
            requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingUsers.length > 0 && (
            <Badge className="bg-amber-500 text-slate-950 text-sm px-3 py-1">
              <AlertCircle className="h-3.5 w-3.5 mr-1" />
              {pendingUsers.length} pending{" "}
              {pendingUsers.length === 1 ? "request" : "requests"}
            </Badge>
          )}
          <Badge variant="outline" className="text-sm px-3 py-1">
            {activeUsers.length} active{" "}
            {activeUsers.length === 1 ? "user" : "users"}
          </Badge>
          {isAdmin && (
            <Button
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              onClick={() => setShowCreateUser(true)}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Create user
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeUsers.length}</p>
              <p className="text-xs text-muted-foreground">Active users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {activeUsers.filter(u => u.role === "admin").length}
              </p>
              <p className="text-xs text-muted-foreground">
                System administrators
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingUsers.length}</p>
              <p className="text-xs text-muted-foreground">Pending requests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <UserCog className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {activeUsers.filter(u => u.assignedRoles.length > 0).length}
              </p>
              <p className="text-xs text-muted-foreground">Users with roles</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Registration Requests */}
      {isAdmin && pendingUsers.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Pending registration requests
              <Badge className="bg-amber-500 text-slate-950 ml-auto">
                {pendingUsers.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingUsers.map(u => (
                <div
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800"
                >
                  {/* User info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {u.avatarUrl ? (
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-sm font-bold text-amber-800 dark:text-amber-200 flex-shrink-0">
                        {(u.name || u.openId).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {u.name || "Unnamed user"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email || u.openId.slice(0, 16) + "..."}
                      </p>
                    </div>
                  </div>

                  {/* Registration details */}
                  <div className="flex flex-wrap gap-3 text-xs">
                    {(u as any).specialty && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <UserCog className="h-3.5 w-3.5" />
                        <span>{(u as any).specialty}</span>
                      </div>
                    )}
                    {(u as any).department && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>{(u as any).department}</span>
                      </div>
                    )}
                    {(u as any).employeeNumber && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Hash className="h-3.5 w-3.5" />
                        <span dir="ltr">{(u as any).employeeNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatDate(u.createdAt)}</span>
                    </div>
                  </div>

                  {/* Note */}
                  {(u as any).registrationNote && (
                    <div className="text-xs text-muted-foreground bg-white dark:bg-slate-800 rounded-lg p-2 border max-w-xs">
                      <span className="font-medium">Note: </span>
                      {(u as any).registrationNote}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() =>
                        approveUserMutation.mutate({ userId: u.id })
                      }
                      disabled={approveUserMutation.isPending}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() =>
                        rejectUserMutation.mutate({ userId: u.id })
                      }
                      disabled={rejectUserMutation.isPending}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={v => {
                setRoleFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="admin">System administrators</SelectItem>
                <SelectItem value="user">Standard users</SelectItem>
                {roles.map(role => (
                  <SelectItem key={role.key} value={role.key}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Active users</CardTitle>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading users...
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pl-4 font-medium text-muted-foreground">
                      #
                    </th>
                    <th className="pb-3 pl-4 font-medium text-muted-foreground">
                      User
                    </th>
                    <th className="pb-3 pl-4 font-medium text-muted-foreground">
                      Specialty
                    </th>
                    <th className="pb-3 pl-4 font-medium text-muted-foreground">
                      System access
                    </th>
                    <th className="pb-3 pl-4 font-medium text-muted-foreground">
                      Roles
                    </th>
                    <th className="pb-3 pl-4 font-medium text-muted-foreground">
                      Last sign-in
                    </th>
                    {isAdmin && (
                      <th className="pb-3 pl-4 font-medium text-muted-foreground">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u, idx) => (
                    <tr
                      key={u.id}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3 pl-4 text-muted-foreground">
                        {(page - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-3">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {(u.name || u.openId).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-foreground">
                              {u.name || "Unnamed user"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {u.email || u.openId.slice(0, 12) + "..."}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pl-4">
                        <div className="text-xs text-muted-foreground">
                          <div>{(u as any).specialty || "—"}</div>
                          {(u as any).employeeNumber && (
                            <div className="text-slate-400" dir="ltr">
                              {(u as any).employeeNumber}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pl-4">
                        <Badge
                          variant={
                            u.role === "admin" ? "destructive" : "secondary"
                          }
                          className="text-xs"
                        >
                          {u.role === "admin" ? "Administrator" : "User"}
                        </Badge>
                      </td>
                      <td className="py-3 pl-4">
                        <div className="flex flex-wrap gap-1">
                          {u.assignedRoles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              No roles
                            </span>
                          ) : (
                            u.assignedRoles.map(roleKey => (
                              <Badge
                                key={roleKey}
                                variant="outline"
                                className="text-xs"
                                style={{
                                  borderColor: getRoleColor(roleKey),
                                  color: getRoleColor(roleKey),
                                }}
                              >
                                {getRoleName(roleKey)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3 pl-4 text-xs text-muted-foreground">
                        {formatDate(u.lastSignedIn)}
                      </td>
                      {isAdmin && (
                        <td className="py-3 pl-4">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleEditRoles(u.id, u.assignedRoles)
                              }
                              className="text-xs"
                            >
                              <UserCog className="h-3.5 w-3.5 mr-1" />
                              Roles
                            </Button>
                            {u.openId !== currentUser?.openId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleToggleSystemRole(u.id, u.role)
                                }
                                className="text-xs"
                              >
                                <Shield className="h-3.5 w-3.5 mr-1" />
                                {u.role === "admin"
                                  ? "Remove admin"
                                  : "Promote"}
                              </Button>
                            )}
                            {/* Admin can change password for other users only (not self — use profile page) */}
                            {u.openId !== currentUser?.openId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setChangingPasswordFor({
                                    id: u.id,
                                    openId: u.openId,
                                    name: u.name ?? "User",
                                  });
                                  setNewPassword("");
                                }}
                                className="text-xs text-amber-600 hover:text-amber-700"
                              >
                                <KeyRound className="h-3.5 w-3.5 mr-1" />
                                Password
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, filteredUsers.length)} of{" "}
                {filteredUsers.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent className="max-w-lg" dir="ltr">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-cyan-600" />
              Create new user
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full name *</Label>
                <Input
                  value={createForm.name}
                  onChange={e =>
                    setCreateForm(f => ({ ...f, name: e.target.value }))
                  }
                  placeholder="User name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Employee number</Label>
                <Input
                  value={createForm.employeeNumber}
                  onChange={e =>
                    setCreateForm(f => ({
                      ...f,
                      employeeNumber: e.target.value,
                    }))
                  }
                  placeholder="EMP-12345"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email address *</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={e =>
                  setCreateForm(f => ({ ...f, email: e.target.value }))
                }
                placeholder="example@company.com"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password * (at least 8 characters)</Label>
              <div className="relative">
                <Input
                  type={showCreatePassword ? "text" : "password"}
                  value={createForm.password}
                  onChange={e =>
                    setCreateForm(f => ({ ...f, password: e.target.value }))
                  }
                  placeholder="••••••••"
                  dir="ltr"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCreatePassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>System access</Label>
                <Select
                  value={createForm.role}
                  onValueChange={v =>
                    setCreateForm(f => ({ ...f, role: v as "user" | "admin" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Standard user</SelectItem>
                    <SelectItem value="admin">System administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Specialty</Label>
                <Input
                  value={createForm.specialty}
                  onChange={e =>
                    setCreateForm(f => ({ ...f, specialty: e.target.value }))
                  }
                  placeholder="Job role"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input
                value={createForm.department}
                onChange={e =>
                  setCreateForm(f => ({ ...f, department: e.target.value }))
                }
                placeholder="Department"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUser(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createUserMutation.mutate(createForm)}
              disabled={
                createUserMutation.isPending ||
                !createForm.name ||
                !createForm.email ||
                createForm.password.length < 8
              }
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {createUserMutation.isPending ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        open={changingPasswordFor !== null}
        onOpenChange={open => !open && setChangingPasswordFor(null)}
      >
        <DialogContent className="max-w-sm" dir="ltr">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              Change password
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Change the password for{" "}
              <span className="font-semibold text-foreground">
                {changingPasswordFor?.name}
              </span>
              .
            </p>
            <div className="space-y-1.5">
              <Label>New password *</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  dir="ltr"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {newPassword && newPassword.length < 8 && (
                <p className="text-xs text-red-500">
                  Password must contain at least 8 characters.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangingPasswordFor(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!changingPasswordFor || newPassword.length < 8) return;
                changePasswordMutation.mutate({
                  newPassword,
                  targetOpenId: changingPasswordFor.openId,
                });
              }}
              disabled={
                changePasswordMutation.isPending || newPassword.length < 8
              }
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {changePasswordMutation.isPending
                ? "Changing..."
                : "Change password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Roles Dialog */}
      <Dialog
        open={editingUser !== null}
        onOpenChange={open => !open && setEditingUser(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user roles</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {roles.map(role => (
              <div
                key={role.key}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
              >
                <Checkbox
                  id={`role-${role.key}`}
                  checked={selectedRoles.includes(role.key)}
                  onCheckedChange={checked => {
                    if (checked) {
                      setSelectedRoles(prev => [...prev, role.key]);
                    } else {
                      setSelectedRoles(prev =>
                        prev.filter(k => k !== role.key)
                      );
                    }
                  }}
                />
                <Label
                  htmlFor={`role-${role.key}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="font-medium">{role.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {role.subtitle}
                  </p>
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRoles}
              disabled={assignRolesMutation.isPending}
            >
              {assignRolesMutation.isPending ? "Saving..." : "Save roles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
