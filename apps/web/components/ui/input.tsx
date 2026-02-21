import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, autoComplete, ...props }, ref) => {
    // Suppress password managers only when autoComplete is not explicitly set to a real value
    const suppressPM = !autoComplete || autoComplete === "off";
    return (
      <input
        type={type}
        autoComplete={autoComplete ?? "off"}
        {...(suppressPM && {
          "data-1p-ignore": true,
          "data-lpignore": "true",
          "data-form-type": "other",
        })}
        className={cn(
          "flex h-9 w-full select-none rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus:select-text focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
