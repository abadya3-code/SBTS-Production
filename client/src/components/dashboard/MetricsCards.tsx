import { AlertCircle, CheckCircle2, Clock, Package, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricsCardsProps {
  registeredBlinds: number;
  plannedBlinds: number;
  highPriorityBlinds: number;
  criticalBlinds: number;
  inspectionReadyBlinds: number;
}

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  trend?: number;
}

function MetricCard({ title, value, icon, color, trend }: MetricCardProps) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700">
          <span>{title}</span>
          <div className={`rounded-lg p-2 ${color}`}>{icon}</div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-extrabold text-slate-950">{value}</p>
            {trend !== undefined && (
              <p className={`mt-1 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                {trend >= 0 ? "+" : ""}{trend}% from last week
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricsCards({
  registeredBlinds,
  plannedBlinds,
  highPriorityBlinds,
  criticalBlinds,
  inspectionReadyBlinds,
}: MetricsCardsProps) {
  return (
    <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      <MetricCard
        title="Registered Blinds"
        value={registeredBlinds}
        icon={<Package className="h-5 w-5 text-blue-600" />}
        color="bg-blue-100"
        trend={12}
      />
      <MetricCard
        title="Planned Blinds"
        value={plannedBlinds}
        icon={<Clock className="h-5 w-5 text-amber-600" />}
        color="bg-amber-100"
        trend={5}
      />
      <MetricCard
        title="High Priority"
        value={highPriorityBlinds}
        icon={<TrendingUp className="h-5 w-5 text-orange-600" />}
        color="bg-orange-100"
        trend={-3}
      />
      <MetricCard
        title="Critical Blinds"
        value={criticalBlinds}
        icon={<AlertCircle className="h-5 w-5 text-red-600" />}
        color="bg-red-100"
        trend={0}
      />
      <MetricCard
        title="Inspection Ready"
        value={inspectionReadyBlinds}
        icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
        color="bg-green-100"
        trend={8}
      />
    </div>
  );
}
