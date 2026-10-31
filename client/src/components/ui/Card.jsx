import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

const cardVariants = {
  default:
    "bg-surface border-border-subtle shadow-xs",
  raised:
    "bg-surface-raised border-border-subtle shadow-md",
  subtle:
    "bg-surface-subtle border-border-subtle",
  interactive:
    "bg-surface border-border-subtle shadow-xs hover:shadow-md hover:border-border-default transition-all duration-200 cursor-pointer",
};

export const Card = forwardRef(
  ({ children, className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border text-foreground",
          cardVariants[variant] || cardVariants.default,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export const CardHeader = forwardRef(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-5 pb-3", className)}
      {...props}
    >
      {children}
    </div>
  );
});
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef(({ children, className, as: Tag = "h3", ...props }, ref) => {
  return (
    <Tag
      ref={ref}
      className={cn("text-base font-semibold leading-none tracking-tight text-foreground", className)}
      {...props}
    >
      {children}
    </Tag>
  );
});
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef(({ children, className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-xs text-foreground-secondary leading-normal", className)}
      {...props}
    >
      {children}
    </p>
  );
});
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef(({ children, className, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("p-5 pt-0", className)} {...props}>
      {children}
    </div>
  );
});
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex items-center p-5 pt-0 border-t border-border-subtle mt-3 pt-3", className)}
      {...props}
    >
      {children}
    </div>
  );
});
CardFooter.displayName = "CardFooter";

export default Card;
