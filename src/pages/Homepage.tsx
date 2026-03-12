import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import RaceCard from "@/components/RaceCard";
import NLSearchResults from "@/components/NLSearchResults";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, Map, Calendar as CalendarIcon } from "lucide-react";
import { getFilteredAndSortedRaces } from "@/lib/raceData";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchResponse {
  answer: string;
  tool_used: string;
  tool_args: Record<string, string>;
  races: {
    id: string;
    score: number;
    metadata: {
      name: string;
      city: string;
      state: string;
      distance: string;
      difficulty: string;
      date: string;
    };
  }[];
  latency: {
    routing_ms: number;
    embedding_ms: number;
    search_ms: number;
    llm_ms: number;
    total_ms: number;
  };
}

const Homepage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [selectedDistances, setSelectedDistances] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showMapView, setShowMapView] = useState(false);
  const [allRaces, setAllRaces] = useState<any[]>([]);
  const [totalAvailableRaces, setTotalAvailableRaces] = useState(0);
  const [isLoadingRaces, setIsLoadingRaces] = useState(true);
  const navigate = useNavigate();

  // AI search state
  const [aiResult, setAiResult] = useState<SearchResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAISearching, setIsAISearching] = useState(false);

  // Debounce search query with 300ms delay
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Load initial race data
  useEffect(() => {
    const loadInitialRaces = async () => {
      setIsLoadingRaces(true);
      try {
        const races = await getFilteredAndSortedRaces({}, sortBy);
        setTotalAvailableRaces(races.length);
        setAllRaces(races);
      } catch (error) {
        console.error('Failed to load races:', error);
      } finally {
        setIsLoadingRaces(false);
      }
    };
    loadInitialRaces();
  }, [sortBy]);

  const handleRaceClick = (raceId: string) => {
    navigate(`/race/${raceId}`);
  };

  const handleBrowseClick = () => {
    const racesSection = document.querySelector('.races-section');
    if (racesSection) {
      racesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDistanceChange = (distance: string, checked: boolean) => {
    if (checked) {
      setSelectedDistances([...selectedDistances, distance]);
    } else {
      setSelectedDistances(selectedDistances.filter(d => d !== distance));
    }
  };

  const handleStateChange = (state: string, checked: boolean) => {
    if (checked) {
      setSelectedStates([...selectedStates, state]);
    } else {
      setSelectedStates(selectedStates.filter(s => s !== state));
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedDistances([]);
    setSelectedStates([]);
    setDateRange(undefined);
  };

  // AI Search handler
  const handleAISearch = async (query: string) => {
    setIsAISearching(true);
    setAiError(null);
    setAiResult(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const data: SearchResponse = await res.json();
      setAiResult(data);

      // Scroll to results
      setTimeout(() => {
        const el = document.querySelector('.ai-results');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsAISearching(false);
    }
  };

  const clearAIResults = () => {
    setAiResult(null);
    setAiError(null);
  };

  // Filter and sort races based on selected criteria
  const [filteredAndSortedRaces, setFilteredAndSortedRaces] = useState<any[]>([]);
  const [filteredTotalCount, setFilteredTotalCount] = useState(0);
  const [isFiltering, setIsFiltering] = useState(false);

  useEffect(() => {
    const applyFilters = async () => {
      setIsFiltering(true);
      try {
        const filters = {
          searchQuery: debouncedSearchQuery.trim() || undefined,
          distances: selectedDistances.length > 0 ? selectedDistances : undefined,
          state: selectedStates.length > 0 ? selectedStates : undefined,
          dateRange: dateRange
        };
        const races = await getFilteredAndSortedRaces(filters, sortBy);
        setFilteredTotalCount(races.length);
        setFilteredAndSortedRaces(races);
      } catch (error) {
        console.error('Failed to filter races:', error);
      } finally {
        setIsFiltering(false);
      }
    };
    applyFilters();
  }, [debouncedSearchQuery, sortBy, selectedDistances, selectedStates, dateRange]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAISearch={handleAISearch}
        isAISearching={isAISearching}
      />

      {/* AI Search Results - full page when active */}
      {(aiResult || aiError || isAISearching) ? (
        <div className="ai-results container mx-auto px-4 pt-10 pb-12">
          <NLSearchResults
            result={aiResult}
            error={aiError}
            isLoading={isAISearching}
            onClear={clearAIResults}
          />
        </div>
      ) : (
      <>
      {/* Hero Section */}
      <HeroSection onBrowseClick={handleBrowseClick} />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filter Sidebar */}
          <div className="w-full lg:w-80">
            <div className="bg-white rounded-lg border p-6 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  <h3 className="font-heading font-semibold text-lg">Filters</h3>
                </div>
                {(searchQuery || selectedDistances.length > 0 || selectedStates.length > 0 || dateRange) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all duration-200"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Date Range Filter */}
              <div className="space-y-4 pb-6">
                <h4 className="font-medium font-heading text-foreground">Date Range</h4>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal hover:bg-accent hover:text-accent-foreground transition-colors duration-200"
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
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Distance Filter */}
              <div className="space-y-4 pb-6">
                <h4 className="font-medium font-heading text-foreground">Distance</h4>
                <div className="space-y-3">
                  {['Less than 5K', '5K', '10K', 'Half Marathon', 'Marathon', 'Ultra'].map((distance) => (
                    <div key={distance} className="flex items-center space-x-3 group">
                      <Checkbox
                        id={distance}
                        checked={selectedDistances.includes(distance)}
                        onCheckedChange={(checked) =>
                          handleDistanceChange(distance, checked as boolean)
                        }
                        className="transition-all duration-200 group-hover:scale-110"
                      />
                      <label
                        htmlFor={distance}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer group-hover:text-primary transition-colors duration-200"
                      >
                        {distance}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* State Filter */}
              <div className="space-y-4">
                <h4 className="font-medium font-heading text-foreground">State</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {['WA', 'OR', 'CA'].map((state) => (
                    <div key={state} className="flex items-center space-x-3 group">
                      <Checkbox
                        id={state}
                        checked={selectedStates.includes(state)}
                        onCheckedChange={(checked) =>
                          handleStateChange(state, checked as boolean)
                        }
                        className="transition-all duration-200 group-hover:scale-110"
                      />
                      <label
                        htmlFor={state}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer group-hover:text-primary transition-colors duration-200"
                      >
                        {state}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-heading font-bold text-foreground">
                  Discover Races
                </h2>
                <p className="text-muted-foreground">
                  {filteredAndSortedRaces.length} races found in WA, OR, and CA (next 6 months)
                </p>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  variant={showMapView ? "default" : "outline"}
                  onClick={() => setShowMapView(!showMapView)}
                  className="flex items-center gap-2 hover:scale-105 transition-transform duration-200"
                >
                  <Map className="h-4 w-4" />
                  {showMapView ? "List View" : "Map View"}
                </Button>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48 hover:border-primary transition-colors duration-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white shadow-lg border border-border z-50">
                    <SelectItem value="date" className="hover:bg-accent hover:text-accent-foreground transition-colors duration-150">Sort by: Date</SelectItem>
                    <SelectItem value="distance" className="hover:bg-accent hover:text-accent-foreground transition-colors duration-150">Sort by: Distance</SelectItem>
                    <SelectItem value="location" className="hover:bg-accent hover:text-accent-foreground transition-colors duration-150">Sort by: Location</SelectItem>
                    <SelectItem value="name" className="hover:bg-accent hover:text-accent-foreground transition-colors duration-150">Sort by: Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Race Display */}
            <div className="races-section">
              {isLoadingRaces || isFiltering ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading races...</p>
                  </div>
                </div>
              ) : showMapView ? (
                <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Map view coming soon!</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {filteredAndSortedRaces.length} races would be displayed on the map
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
                  {filteredAndSortedRaces.map((race) => (
                    <RaceCard
                      key={race.id}
                      {...race}
                      onClick={() => handleRaceClick(race.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default Homepage;
