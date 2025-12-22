import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonCardProps {
  showHeader?: boolean;
  showDescription?: boolean;
  lines?: number;
}

export function SkeletonCard({ 
  showHeader = true, 
  showDescription = false,
  lines = 2 
}: SkeletonCardProps) {
  return (
    <Card>
      {showHeader && (
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-1/3" />
          {showDescription && <Skeleton className="h-4 w-2/3" />}
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="h-4" 
            style={{ width: `${100 - (i * 15)}%` }} 
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function SkeletonMetricCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

export function SkeletonCardGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonMetricCard key={i} />
      ))}
    </div>
  );
}
