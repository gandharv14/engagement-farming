import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <Spinner className="size-5 text-primary" />
        <span>Loading...</span>
      </div>
    </div>
  );
}
