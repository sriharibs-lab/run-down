import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface FilterSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

const FilterSidebar = ({ isOpen = true, onClose, className }: FilterSidebarProps) => {
  const [selectedDistances, setSelectedDistances] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const distances = ["5K", "10K", "Half Marathon", "Marathon", "Ultra"];
  
  const states = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
    "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
    "Wisconsin", "Wyoming"
  ];

  const handleDistanceChange = (distance: string, checked: boolean) => {
    if (checked) {
      setSelectedDistances([...selectedDistances, distance]);
    } else {
      setSelectedDistances(selectedDistances.filter(d => d !== distance));
    }
  };

  const clearFilters = () => {
    setSelectedDistances([]);
    setSelectedState("");
    setDateRange(undefined);
  };

  return (
    <Card className={cn("w-80 p-6 h-fit sticky top-24", className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold text-lg">Filters</h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {/* Distance Filter */}
        <div className="space-y-3">
          <h3 className="font-medium font-heading">Distance</h3>
          <div className="space-y-2">
            {distances.map((distance) => (
              <div key={distance} className="flex items-center space-x-2">
                <Checkbox
                  id={distance}
                  checked={selectedDistances.includes(distance)}
                  onCheckedChange={(checked) => 
                    handleDistanceChange(distance, checked as boolean)
                  }
                />
                <label
                  htmlFor={distance}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {distance}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-3">
          <h3 className="font-medium font-heading">Date Range</h3>
          <div className="space-y-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* State Filter */}
        <div className="space-y-3">
          <h3 className="font-medium font-heading">State</h3>
          <Select value={selectedState} onValueChange={setSelectedState}>
            <SelectTrigger>
              <SelectValue placeholder="Select a state" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {states.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters */}
        <Button 
          variant="outline" 
          onClick={clearFilters}
          className="w-full"
        >
          Clear All Filters
        </Button>
      </div>
    </Card>
  );
};

export default FilterSidebar;