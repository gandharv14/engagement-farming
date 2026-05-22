import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="arena-panel flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-muted-foreground">
        <Spinner className="size-5 text-primary" />
        <span className="font-mono uppercase tracking-[0.18em]">Loading arena...</span>
      </div>
    </div>
  );
}
