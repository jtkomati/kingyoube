import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonChartProps {
  height?: number;
  showLegend?: boolean;
  showTitle?: boolean;
}

export function SkeletonChart({ 
  height = 300, 
  showLegend = true,
  showTitle = true 
}: SkeletonChartProps) {
  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
      )}
      <CardContent>
        <div 
          className="relative w-full bg-muted/30 rounded-lg overflow-hidden"
          style={{ height }}
        >
          {/* Simulated chart bars/lines */}
          <div className="absolute inset-0 flex items-end justify-around p-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-muted rounded-t animate-pulse"
                style={{ 
                  height: `${30 + Math.random() * 60}%`,
                  animationDelay: `${i * 100}ms`
                }}
              />
            ))}
          </div>
          
          {/* X-axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-around p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-8" />
            ))}
          </div>
        </div>
        
        {showLegend && (
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SkeletonLineChart({ height = 250 }: { height?: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </CardHeader>
      <CardContent>
        <div 
          className="relative w-full bg-muted/20 rounded-lg"
          style={{ height }}
        >
          {/* Simulated line chart path */}
          <svg className="absolute inset-0 w-full h-full p-4" preserveAspectRatio="none">
            <path
              d="M 0 80 Q 50 40 100 60 T 200 50 T 300 70 T 400 40"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="3"
              className="animate-pulse"
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
