import { ArrowLeft, Edit2, MoreVertical, Share2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectHeaderProps {
  projectId: string;
  projectName: string;
  areaName: string;
  status: "Active" | "Completed" | "On Hold" | "Planning" | "Final Review";
  progress: number;
  description?: string;
  onEdit?: () => void;
  onShare?: () => void;
}

const statusColors: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Completed: "bg-blue-50 text-blue-700 ring-blue-200",
  "On Hold": "bg-amber-50 text-amber-700 ring-amber-200",
  Planning: "bg-slate-50 text-slate-700 ring-slate-200",
  "Final Review": "bg-cyan-50 text-cyan-700 ring-cyan-200",
};

export function ProjectHeader({
  projectId,
  projectName,
  areaName,
  status,
  progress,
  description,
  onEdit,
  onShare,
}: ProjectHeaderProps) {
  return (
    <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Back Button and Title Row */}
      <div className="mb-4 sm:mb-6 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/projects">
            <Button variant="outline" size="icon" className="rounded-xl flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">
              {projectName}
            </h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground">
              Area: <span className="font-semibold text-foreground">{areaName}</span>
            </p>
          </div>
        </div>

        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-xl">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
              <Edit2 className="mr-2 h-4 w-4" />
              Edit Project
            </DropdownMenuItem>
            {onShare && (
              <DropdownMenuItem onClick={onShare} className="cursor-pointer">
                <Share2 className="mr-2 h-4 w-4" />
                Share Project
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status and Description */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          {description && (
            <p className="mb-3 text-sm leading-6 text-muted-foreground">{description}</p>
          )}
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusColors[status]}`}
            >
              {status}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Project ID: {projectId}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Overall Progress</span>
          <span className="text-sm font-bold text-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2.5" />
      </div>
    </div>
  );
}
