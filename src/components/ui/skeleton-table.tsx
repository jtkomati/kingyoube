import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SkeletonTableProps {
  columns?: number;
  rows?: number;
  showHeader?: boolean;
}

export function SkeletonTable({ 
  columns = 5, 
  rows = 5,
  showHeader = true 
}: SkeletonTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        {showHeader && (
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={colIndex}>
                  <Skeleton 
                    className="h-4" 
                    style={{ 
                      width: `${60 + Math.random() * 40}%` 
                    }} 
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SkeletonTableWithPagination({ 
  columns = 5, 
  rows = 10 
}: SkeletonTableProps) {
  return (
    <div className="space-y-4">
      <SkeletonTable columns={columns} rows={rows} />
      <div className="flex items-center justify-between px-2">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </div>
  );
}
