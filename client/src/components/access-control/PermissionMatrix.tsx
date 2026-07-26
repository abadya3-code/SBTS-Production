/*
PermissionMatrix — Visual permission matrix showing all roles × all permissions in a grid.
Features:
- Roles as columns, permissions grouped in rows
- Click any cell to toggle permission (grant/revoke)
- "Select All" / "Clear All" per role column
- Filter by permission group
- Search permissions by label
- Export matrix to CSV
- Color-coded role headers
- Permission count badge per role
*/

import { useState, useMemo } from "react";
import { Check, Minus, Download, Search, ChevronDown, ChevronRight } from "lucide-react";
import { permissionGroups, type RoleModel } from "@/lib/mockData";

interface PermissionMatrixProps {
  roles: RoleModel[];
  onRolesChange: (roles: RoleModel[]) => void;
}

export default function PermissionMatrix({ roles, onRolesChange }: PermissionMatrixProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // All permissions flattened
  const allPermissions = useMemo(
    () => permissionGroups.flatMap((g) => g.permissions),
    []
  );

  // Filtered permission groups based on search and group filter
  const filteredGroups = useMemo(() => {
    return permissionGroups
      .filter((g) => !activeGroupFilter || g.group === activeGroupFilter)
      .map((g) => ({
        ...g,
        permissions: g.permissions.filter(
          (p) =>
            !searchQuery ||
            p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      }))
      .filter((g) => g.permissions.length > 0);
  }, [searchQuery, activeGroupFilter]);

  // Toggle a single permission for a role
  function togglePermission(roleKey: string, permKey: string) {
    const updated = roles.map((role) => {
      if (role.key !== roleKey) return role;
      const has = role.permissionKeys.includes(permKey);
      return {
        ...role,
        permissionKeys: has
          ? role.permissionKeys.filter((k) => k !== permKey)
          : [...role.permissionKeys, permKey],
      };
    });
    onRolesChange(updated);
  }

  // Select all visible permissions for a role
  function selectAllForRole(roleKey: string) {
    const visibleKeys = filteredGroups.flatMap((g) => g.permissions.map((p) => p.key));
    const updated = roles.map((role) => {
      if (role.key !== roleKey) return role;
      const merged = Array.from(new Set([...role.permissionKeys, ...visibleKeys]));
      return { ...role, permissionKeys: merged };
    });
    onRolesChange(updated);
  }

  // Clear all visible permissions for a role
  function clearAllForRole(roleKey: string) {
    const visibleKeys = new Set(filteredGroups.flatMap((g) => g.permissions.map((p) => p.key)));
    const updated = roles.map((role) => {
      if (role.key !== roleKey) return role;
      return { ...role, permissionKeys: role.permissionKeys.filter((k) => !visibleKeys.has(k)) };
    });
    onRolesChange(updated);
  }

  // Toggle group collapse
  function toggleGroup(groupName: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }

  // Export to CSV
  function exportCSV() {
    const header = ["Permission", "Group", ...roles.map((r) => r.name)];
    const rows = allPermissions.map((p) => [
      p.label,
      p.group,
      ...roles.map((r) => (r.permissionKeys.includes(p.key) ? "✓" : "")),
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permission-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Count permissions per role (visible only)
  function countVisible(role: RoleModel) {
    const visibleKeys = filteredGroups.flatMap((g) => g.permissions.map((p) => p.key));
    return visibleKeys.filter((k) => role.permissionKeys.includes(k)).length;
  }

  // Check if role has all visible permissions
  function hasAllVisible(role: RoleModel) {
    const visibleKeys = filteredGroups.flatMap((g) => g.permissions.map((p) => p.key));
    return visibleKeys.length > 0 && visibleKeys.every((k) => role.permissionKeys.includes(k));
  }

  // Check if role has some visible permissions
  function hasSomeVisible(role: RoleModel) {
    const visibleKeys = filteredGroups.flatMap((g) => g.permissions.map((p) => p.key));
    return visibleKeys.some((k) => role.permissionKeys.includes(k));
  }

  const totalVisible = filteredGroups.reduce((sum, g) => sum + g.permissions.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search permissions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          />
        </div>

        {/* Group filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveGroupFilter(null)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              !activeGroupFilter
                ? "bg-slate-950 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            All Groups
          </button>
          {permissionGroups.map((g) => (
            <button
              key={g.group}
              onClick={() => setActiveGroupFilter(activeGroupFilter === g.group ? null : g.group)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activeGroupFilter === g.group
                  ? "bg-cyan-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {g.group}
            </button>
          ))}
        </div>

        {/* Export button */}
        <button
          onClick={exportCSV}
          className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-800">{totalVisible}</strong> permissions across{" "}
          <strong className="text-slate-800">{filteredGroups.length}</strong> groups
        </span>
        <span className="text-slate-300">•</span>
        <span>
          <strong className="text-slate-800">{roles.length}</strong> roles
        </span>
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {/* Permission column header */}
              <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50 px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Permission
              </th>
              {/* Role column headers */}
              {roles.map((role) => {
                const allGranted = hasAllVisible(role);
                const someGranted = hasSomeVisible(role);
                const count = countVisible(role);
                return (
                  <th key={role.key} className="min-w-[120px] px-3 py-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {/* Role color dot + name */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: role.color }}
                        />
                        <span className="text-xs font-extrabold text-slate-900 leading-tight">
                          {role.name}
                        </span>
                      </div>
                      {/* Permission count badge */}
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{
                          backgroundColor: role.color + "22",
                          color: role.color,
                        }}
                      >
                        {count}/{totalVisible}
                      </span>
                      {/* Select all / Clear all */}
                      <div className="flex gap-1 mt-0.5">
                        <button
                          onClick={() => selectAllForRole(role.key)}
                          title="Grant all visible"
                          disabled={allGranted}
                          className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 transition hover:border-cyan-400 hover:text-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          All
                        </button>
                        <button
                          onClick={() => clearAllForRole(role.key)}
                          title="Revoke all visible"
                          disabled={!someGranted}
                          className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 transition hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          None
                        </button>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group) => {
              const Icon = group.icon;
              const isCollapsed = collapsedGroups.has(group.group);
              return (
                <>
                  {/* Group header row */}
                  <tr
                    key={`group-${group.group}`}
                    className="cursor-pointer border-b border-slate-100 bg-slate-50/70 hover:bg-slate-100/70 transition"
                    onClick={() => toggleGroup(group.group)}
                  >
                    <td
                      className="sticky left-0 z-10 bg-slate-50/90 px-4 py-2.5 backdrop-blur-sm"
                      colSpan={roles.length + 1}
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                        <Icon className="h-4 w-4 text-cyan-700" />
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          {group.group}
                        </span>
                        <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {group.permissions.length}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Permission rows */}
                  {!isCollapsed &&
                    group.permissions.map((permission, idx) => (
                      <tr
                        key={permission.key}
                        className={`border-b border-slate-100 transition hover:bg-slate-50/50 ${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                        }`}
                      >
                        {/* Permission label */}
                        <td className="sticky left-0 z-10 bg-inherit px-4 py-3">
                          <div className="font-semibold text-slate-800">{permission.label}</div>
                          <div className="text-xs text-slate-400 leading-relaxed">
                            {permission.description}
                          </div>
                        </td>

                        {/* Role cells */}
                        {roles.map((role) => {
                          const granted = role.permissionKeys.includes(permission.key);
                          return (
                            <td key={role.key} className="px-3 py-3 text-center">
                              <button
                                onClick={() => togglePermission(role.key, permission.key)}
                                title={
                                  granted
                                    ? `Revoke "${permission.label}" from ${role.name}`
                                    : `Grant "${permission.label}" to ${role.name}`
                                }
                                className={`mx-auto flex h-8 w-8 items-center justify-center rounded-xl border-2 transition-all duration-150 ${
                                  granted
                                    ? "border-transparent shadow-sm"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                }`}
                                style={
                                  granted
                                    ? {
                                        backgroundColor: role.color + "22",
                                        borderColor: role.color + "55",
                                      }
                                    : undefined
                                }
                              >
                                {granted ? (
                                  <Check
                                    className="h-4 w-4 font-bold"
                                    style={{ color: role.color }}
                                  />
                                ) : (
                                  <Minus className="h-3 w-3 text-slate-300" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </>
              );
            })}

            {/* Empty state */}
            {filteredGroups.length === 0 && (
              <tr>
                <td
                  colSpan={roles.length + 1}
                  className="px-4 py-12 text-center text-sm text-slate-400"
                >
                  No permissions match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <div className="flex items-center gap-2 font-semibold text-slate-600">Legend:</div>
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-cyan-100 border border-cyan-300">
            <Check className="h-3 w-3 text-cyan-600" />
          </span>
          <span>Permission granted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-lg border-2 border-slate-200 bg-white">
            <Minus className="h-3 w-3 text-slate-300" />
          </span>
          <span>Permission not granted</span>
        </div>
        <div className="ml-auto text-slate-400">Click any cell to toggle · Changes auto-save with "Save Changes"</div>
      </div>
    </div>
  );
}
