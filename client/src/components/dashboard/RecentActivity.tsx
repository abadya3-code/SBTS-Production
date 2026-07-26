import { format } from "date-fns";
import { Activity, CheckCircle2, Edit2, Plus, Trash2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ActivityType = "created" | "updated" | "deleted" | "approved" | "assigned";

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  user: {
    name: string;
    avatarUrl?: string;
  };
  timestamp: Date;
}

interface RecentActivityProps {
  activities: ActivityItem[];
  limit?: number;
}

const activityIcons: Record<ActivityType, React.ReactNode> = {
  created: <Plus className="h-4 w-4 text-blue-600" />,
  updated: <Edit2 className="h-4 w-4 text-amber-600" />,
  deleted: <Trash2 className="h-4 w-4 text-red-600" />,
  approved: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  assigned: <User className="h-4 w-4 text-purple-600" />,
};

const activityColors: Record<ActivityType, string> = {
  created: "bg-blue-100",
  updated: "bg-amber-100",
  deleted: "bg-red-100",
  approved: "bg-green-100",
  assigned: "bg-purple-100",
};

export function RecentActivity({ activities, limit = 5 }: RecentActivityProps) {
  const displayedActivities = activities.slice(0, limit);

  if (displayedActivities.length === 0) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Activity className="h-5 w-5 text-slate-600" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-center">
            <p className="text-sm text-slate-500">No activity yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Activity className="h-5 w-5 text-slate-600" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayedActivities.map((activity) => (
            <div key={activity.id} className="flex gap-4 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
              {/* Activity Icon */}
              <div className={`flex-shrink-0 rounded-lg p-2 ${activityColors[activity.type]}`}>
                {activityIcons[activity.type]}
              </div>

              {/* Activity Content */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{activity.title}</p>
                <p className="text-sm text-slate-600">{activity.description}</p>
              </div>

              {/* User and Time */}
              <div className="flex-shrink-0 text-right">
                <div className="flex items-center justify-end gap-2 mb-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={activity.user.avatarUrl} alt={activity.user.name} />
                    <AvatarFallback className="text-xs font-bold">
                      {activity.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <p className="text-xs text-slate-500">
                  {format(activity.timestamp, "MMM d, HH:mm")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
