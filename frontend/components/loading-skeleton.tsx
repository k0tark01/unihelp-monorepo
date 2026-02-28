import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeletons() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-[75%]" />
      <Skeleton className="ml-auto h-16 w-[65%]" />
      <Skeleton className="h-24 w-[80%]" />
    </div>
  );
}