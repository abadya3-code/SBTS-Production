/**
 * client/src/components/profile/ActivityTimeline.tsx
 * ─────────────────────────────────────────────────────
 * Professional Activity Timeline for the User Profile page.
 * Displays the user's recent actions across the system:
 *   - Workflow log entries (phase transitions, notes, etc.)
 *   - Phase approvals / revocations
 * Supports filtering by event type and pagination (load more).
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  CheckCircle,
  XCircle,
  FolderOpen,
  Clock,
  ChevronDown,
  Filter,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Tag,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = "all" | "workflow" | "approval";

interface TimelineEvent {
  id: string;
  type: "workflow" | "approval" | "project";
  action: string;
  description: string;
  blindTag?: string;
  projectId?: string;
  projectName?: string;
  phase?: string;
  createdAt: Date;
  icon: string;
  color: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEventIcon(event: TimelineEvent) {
  if (event.icon === "check-circle") return <CheckCircle className="h-4 w-4" />;
  if (event.icon === "x-circle") return <XCircle className="h-4 w-4" />;
  if (event.icon === "folder") return <FolderOpen className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
}

function getColorClasses(color: string) {
  switch (color) {
    case "green":
      return {
        dot: "bg-emerald-500",
        badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        icon: "text-emerald-400",
        ring: "ring-emerald-500/30",
      };
    case "red":
      return {
        dot: "bg-red-500",
        badge: "bg-red-500/10 text-red-400 border-red-500/20",
        icon: "text-red-400",
        ring: "ring-red-500/30",
      };
    case "yellow":
      return {
        dot: "bg-amber-500",
        badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        icon: "text-amber-400",
        ring: "ring-amber-500/30",
      };
    default: // blue
      return {
        dot: "bg-cyan-500",
        badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        icon: "text-cyan-400",
        ring: "ring-cyan-500/30",
      };
  }
}

function getPhaseLabel(phase?: string): string {
  if (!phase) return "";
  const map: Record<string, string> = {
    "Broken / Preparation": "Broken",
    Assembly: "Assembly",
    "Tight & Torque": "T&T",
    "Final Tight": "Final",
    "Inspection Ready": "Inspect",
  };
  return map[phase] ?? phase;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <Skeleton className="h-8 w-8 rounded-full" />
            {i < 4 && <Skeleton className="h-12 w-0.5 mt-1" />}
          </div>
          <div className="flex-1 pb-4">
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyTimeline() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
        <Activity className="h-8 w-8 text-slate-500" />
      </div>
      <p className="text-slate-400 font-medium">No activity recorded yet</p>
      <p className="text-slate-500 text-sm mt-1">
        Your workflow actions and approvals will appear here.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ActivityTimeline() {
  const [filter, setFilter] = useState<EventType>("all");
  const [limit, setLimit] = useState(20);
  const [, navigate] = useLocation();

  // Build navigation URL for a given event
  const getEventUrl = (event: TimelineEvent): string | null => {
    if (!event.projectId) return null;
    if (event.blindTag) {
      return `/projects/${event.projectId}/blinds/${event.blindTag}`;
    }
    return `/projects/${event.projectId}`;
  };

  const { data, isLoading, error, refetch, isFetching } = trpc.profile.activity.useQuery(
    { limit },
    { refetchOnWindowFocus: false },
  );

  const events: TimelineEvent[] = (data?.events ?? []).filter((e) => {
    if (filter === "all") return true;
    return e.type === filter;
  });

  const filterButtons: { key: EventType; label: string; count?: number }[] = [
    { key: "all", label: "All", count: data?.total },
    { key: "workflow", label: "Workflow", count: data?.workflowCount },
    { key: "approval", label: "Approvals", count: data?.approvalCount },
  ];

  return (
    <Card className="bg-slate-900/60 border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 flex items-center gap-2 text-base font-semibold">
            <div className="h-7 w-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-cyan-400" />
            </div>
            Activity Timeline
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-slate-400 hover:text-slate-200 h-7 w-7 p-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-3">
          <Filter className="h-3.5 w-3.5 text-slate-500 self-center mr-1" />
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                filter === btn.key
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {btn.label}
              {btn.count !== undefined && btn.count > 0 && (
                <span className="ml-1.5 text-slate-500 text-[10px]">{btn.count}</span>
              )}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <TimelineSkeleton />
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400 text-sm py-4">
            <AlertCircle className="h-4 w-4" />
            Failed to load activity. Please try again.
          </div>
        ) : events.length === 0 ? (
          <EmptyTimeline />
        ) : (
          <>
            <div className="relative">
              {events.map((event, idx) => {
                const colors = getColorClasses(event.color);
                const isLast = idx === events.length - 1;
                const eventDate = new Date(event.createdAt);

                const eventUrl = getEventUrl(event);
                const isClickable = !!eventUrl;

                return (
                  <div key={event.id} className="flex gap-3 group">
                    {/* Timeline spine */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center ring-2 ${colors.ring} bg-slate-900 transition-all group-hover:scale-110 ${colors.icon}`}
                      >
                        {getEventIcon(event)}
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 bg-gradient-to-b from-slate-600 to-slate-700/30 my-1 min-h-[24px]" />
                      )}
                    </div>

                    {/* Event content — clickable card */}
                    <div className={`flex-1 ${!isLast ? "pb-5" : "pb-1"}`}>
                      <div
                        role={isClickable ? "button" : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        onClick={() => isClickable && navigate(eventUrl!)}
                        onKeyDown={(e) => {
                          if (isClickable && (e.key === "Enter" || e.key === " ")) {
                            navigate(eventUrl!);
                          }
                        }}
                        className={`rounded-lg p-2.5 -ml-1 transition-all ${
                          isClickable
                            ? "cursor-pointer hover:bg-slate-800/70 hover:ring-1 hover:ring-slate-600/50 active:scale-[0.99]"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {/* Action title with link indicator */}
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-medium leading-tight truncate ${
                                isClickable ? "text-cyan-300 group-hover:text-cyan-200" : "text-slate-200"
                              }`}>
                                {event.action}
                              </p>
                              {isClickable && (
                                <ExternalLink className="h-3 w-3 text-slate-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>

                            {/* Description */}
                            <p className="text-slate-400 text-xs mt-0.5 leading-relaxed line-clamp-2">
                              {event.description}
                            </p>

                            {/* Metadata badges */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {event.blindTag && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (event.projectId) {
                                      navigate(`/projects/${event.projectId}/blinds/${event.blindTag}`);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-cyan-300 border border-cyan-800/50 hover:bg-cyan-900/30 hover:border-cyan-600/50 transition-colors cursor-pointer"
                                >
                                  <Tag className="h-2.5 w-2.5" />
                                  {event.blindTag}
                                </button>
                              )}
                              {event.projectName && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (event.projectId) {
                                      navigate(`/projects/${event.projectId}`);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-slate-100 hover:border-slate-500 transition-colors cursor-pointer"
                                >
                                  <FolderOpen className="h-2.5 w-2.5" />
                                  {event.projectName}
                                </button>
                              )}
                              {event.phase && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 h-4 ${colors.badge}`}
                                >
                                  {getPhaseLabel(event.phase)}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Timestamp */}
                          <div className="flex-shrink-0 text-right">
                            <p
                              className="text-slate-500 text-[10px] whitespace-nowrap"
                              title={format(eventDate, "PPpp")}
                            >
                              {formatDistanceToNow(eventDate, { addSuffix: true })}
                            </p>
                            <p className="text-slate-600 text-[9px] mt-0.5">
                              {format(eventDate, "MMM d")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {data && data.total >= limit && (
              <div className="mt-4 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLimit((prev) => prev + 20)}
                  disabled={isFetching}
                  className="text-slate-400 hover:text-slate-200 text-xs gap-1"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Load more activity
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
