import { Label } from "@/components/ui/label";

type FieldHelpLabelProps = {
  htmlFor: string;
  label: string;
  definition: string;
};

function FieldHelpLabel({ htmlFor, label, definition }: FieldHelpLabelProps) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      <details className="group relative">
        <summary
          className="flex size-5 cursor-help list-none items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden"
          title={`Show definition for ${label}`}
        >
          <span className="sr-only">{`Show definition for ${label}`}</span>
          <span aria-hidden="true">?</span>
        </summary>
        <div className="absolute left-0 z-10 mt-2 w-72 rounded-md border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-md">
          {definition}
        </div>
      </details>
    </div>
  );
}

export { FieldHelpLabel };
