import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FilterSidebar from "@/components/FilterSidebar";
import RaceCard from "@/components/RaceCard";
import AISearchModal from "@/components/AISearchModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Map, Grid, Filter } from "lucide-react";

// Import race images
import trailRaceImage from "@/assets/trail-race.jpg";
import cityMarathonImage from "@/assets/city-marathon.jpg";
import coastalRaceImage from "@/assets/coastal-race.jpg";
import family5kImage from "@/assets/family-5k.jpg";
import ultraDesertImage from "@/assets/ultra-desert.jpg";

const Homepage = () => {
  const [showAISearch, setShowAISearch] = useState(false);
  const [sortBy, setSortBy] = useState("date");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const navigate = useNavigate();

  // Mock race data
  const races = [
    {
      id: "1",
      image: cityMarathonImage,
      name: "Chicago Lakefront Marathon",
      date: "October 15, 2024",
      location: "Chicago, IL",
      distances: ["Marathon"],
      difficulty: "Easy" as const,
      participants: 45000
    },
    {
      id: "2",
      image: coastalRaceImage,
      name: "Pacific Coast Half Marathon",
      date: "November 3, 2024",
      location: "San Diego, CA",
      distances: ["Half Marathon", "10K"],
      difficulty: "Moderate" as const,
      participants: 12000
    },
    {
      id: "3",
      image: trailRaceImage,
      name: "Mountain Trail Challenge",
      date: "September 28, 2024",
      location: "Boulder, CO",
      distances: ["Ultra", "Marathon"],
      difficulty: "Challenging" as const,
      participants: 3500
    },
    {
      id: "4",
      image: family5kImage,
      name: "Family Fun Run & 5K",
      date: "October 20, 2024",
      location: "Austin, TX",
      distances: ["5K"],
      difficulty: "Easy" as const,
      participants: 8500
    },
    {
      id: "5",
      image: ultraDesertImage,
      name: "Desert Ultra Challenge",
      date: "December 1, 2024",
      location: "Phoenix, AZ",
      distances: ["Ultra"],
      difficulty: "Challenging" as const,
      participants: 1200
    },
    {
      id: "6",
      image: cityMarathonImage,
      name: "NYC Bridge Run",
      date: "November 15, 2024",
      location: "New York, NY",
      distances: ["10K", "Half Marathon"],
      difficulty: "Moderate" as const,
      participants: 25000
    },
    {
      id: "7",
      image: coastalRaceImage,
      name: "Miami Beach Marathon",
      date: "January 28, 2025",
      location: "Miami, FL",
      distances: ["Marathon", "Half Marathon"],
      difficulty: "Easy" as const,
      participants: 20000
    },
    {
      id: "8",
      image: trailRaceImage,
      name: "Appalachian Trail 50K",
      date: "October 5, 2024",
      location: "Harpers Ferry, WV",
      distances: ["Ultra"],
      difficulty: "Challenging" as const,
      participants: 800
    },
    {
      id: "9",
      image: family5kImage,
      name: "Turkey Trot 5K",
      date: "November 28, 2024",
      location: "Portland, OR",
      distances: ["5K"],
      difficulty: "Easy" as const,
      participants: 15000
    },
    {
      id: "10",
      image: cityMarathonImage,
      name: "Boston Qualifier",
      date: "October 12, 2024",
      location: "Seattle, WA",
      distances: ["Marathon", "Half Marathon"],
      difficulty: "Moderate" as const,
      participants: 8000
    },
    {
      id: "11",
      image: coastalRaceImage,
      name: "Big Sur International",
      date: "April 27, 2025",
      location: "Big Sur, CA",
      distances: ["Marathon"],
      difficulty: "Challenging" as const,
      participants: 4500
    },
    {
      id: "12",
      image: trailRaceImage,
      name: "Rocky Mountain High",
      date: "August 15, 2024",
      location: "Aspen, CO",
      distances: ["10K", "Half Marathon"],
      difficulty: "Challenging" as const,
      participants: 2800
    }
  ];

  const handleRaceClick = (raceId: string) => {
    navigate(`/race/${raceId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onSearchClick={() => setShowAISearch(true)} />
      
      {/* Hero Section */}
      <HeroSection onSearchClick={() => setShowAISearch(true)} />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block">
            <FilterSidebar />
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {/* Mobile Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8 lg:hidden">
              <Button
                variant="outline"
                onClick={() => setShowMobileFilters(true)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/map')}
                className="flex items-center gap-2"
              >
                <Map className="h-4 w-4" />
                Map View
              </Button>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-heading font-bold text-foreground">
                  Discover Races
                </h2>
                <p className="text-muted-foreground">
                  {races.length} races found across the United States
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden lg:flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/map')}
                    className="flex items-center gap-2"
                  >
                    <Map className="h-4 w-4" />
                    Map View
                  </Button>
                </div>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white shadow-lg border border-border z-50">
                    <SelectItem value="date">Sort by: Date</SelectItem>
                    <SelectItem value="distance">Sort by: Distance</SelectItem>
                    <SelectItem value="location">Sort by: Location</SelectItem>
                    <SelectItem value="participants">Sort by: Popularity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Race Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {races.map((race) => (
                <RaceCard
                  key={race.id}
                  {...race}
                  onClick={() => handleRaceClick(race.id)}
                />
              ))}
            </div>

            {/* Load More */}
            <div className="text-center mt-12">
              <Button variant="outline" size="lg">
                Load More Races
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Search Modal */}
      <AISearchModal 
        open={showAISearch}
        onOpenChange={setShowAISearch}
      />

      {/* Mobile Filters Modal */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowMobileFilters(false)} />
          <div className="fixed right-0 top-0 h-full w-80 max-w-[90vw] bg-white overflow-y-auto">
            <FilterSidebar 
              onClose={() => setShowMobileFilters(false)}
              className="sticky top-0 shadow-none border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Homepage;