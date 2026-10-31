"use client";

import * as React from "react";
import { subDays, format } from "date-fns";
import { FaCalendarAlt } from "react-icons/fa";

import { cn } from "../lib/utils";
import { Calendar, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";

export default function DatePickerWithRange({ className, align = "right" }) {
  // Real dynamic range: last 30 days
  const [date, setDate] = React.useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            id="date"
            type="button"
            className={cn(
              "inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-border-default/70 bg-surface/90 hover:bg-surface-subtle text-foreground shadow-xs transition hover:border-action-primary/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring-focus min-w-[15rem] justify-start text-left",
              !date && "text-foreground-muted"
            )}
          >
            <FaCalendarAlt className="w-3.5 h-3.5 text-action-primary shrink-0" />
            <span className="truncate">
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} – {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span className="text-foreground-muted">Select date window</span>
              )}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-3 bg-surface border border-border-default rounded-2xl shadow-2xl backdrop-blur-xl"
          align={align}
        >
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
