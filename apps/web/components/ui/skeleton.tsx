import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer rounded-md bg-muted bg-[length:200%_100%]", className)}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent 25%, var(--muted-foreground) 50%, transparent 75%)",
        backgroundBlendMode: "soft-light",
      }}
      {...props}
    />
  );
}

export { Skeleton };
