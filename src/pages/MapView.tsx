import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import RaceCard from "@/components/RaceCard";
import FilterSidebar from "@/components/FilterSidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Grid, Filter, X } from "lucide-react";
import { getRacesWithCoordinates } from "@/lib/raceData";

const MapView = () => {
  const navigate = useNavigate();
  const [selectedRace, setSelectedRace] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showRaceList, setShowRaceList] = useState(false);

  // Get race data with coordinates from JSON
  const races = getRacesWithCoordinates();

  const selectedRaceData = races.find(race => race.id === selectedRace);

  const handleRaceClick = (raceId: string) => {
    navigate(`/race/${raceId}`);
  };

  const handlePinClick = (raceId: string) => {
    setSelectedRace(raceId);
    setShowRaceList(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Mobile Controls */}
      <div className="lg:hidden bg-white border-b border-border p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMobileFilters(true)}
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Desktop Filter Sidebar */}
        <div className="hidden lg:block w-80 border-r border-border bg-white">
          <div className="p-4 border-b">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Grid View
            </Button>
          </div>
          <div className="p-4">
            <FilterSidebar className="w-full sticky top-0 shadow-none border-0" />
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          {/* Map Placeholder */}
          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-green-50 relative overflow-hidden">
            {/* Simulated Map Background */}
            <div className="absolute inset-0 opacity-20">
              <div className="w-full h-full bg-gradient-to-br from-primary/10 via-secondary/5 to-primary/10"></div>
            </div>
            
            {/* Map Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4 bg-white/90 backdrop-blur-sm p-8 rounded-xl shadow-lg">
                <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-heading font-semibold">Interactive Map Coming Soon</h3>
                  <p className="text-muted-foreground max-w-md">
                    We're building an interactive map with Mapbox integration to show race locations, 
                    course previews, and detailed geographic information.
                  </p>
                </div>
                
                {/* Mock Race Pins */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                  {races.map((race) => (
                    <Card 
                      key={race.id}
                      className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handlePinClick(race.id)}
                    >
                      <div className="text-center space-y-2">
                        <div className="w-8 h-8 bg-primary rounded-full mx-auto flex items-center justify-center text-white text-xs font-bold">
                          {race.id}
                        </div>
                        <div className="text-sm font-medium">{race.name}</div>
                        <div className="text-xs text-muted-foreground">{race.location}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Selected Race Card - Desktop */}
          {selectedRaceData && (
            <Card className="absolute bottom-6 left-6 right-6 lg:left-auto lg:right-6 lg:w-96 bg-white shadow-lg">
              <div className="p-1">
                <RaceCard
                  {...selectedRaceData}
                  onClick={() => handleRaceClick(selectedRaceData.id)}
                />
              </div>
            </Card>
          )}
        </div>
      </div>

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

      {/* Mobile Race List Bottom Sheet */}
      {showRaceList && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowRaceList(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl max-h-[70vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-heading font-semibold">Races in This Area</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRaceList(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              {races.map((race) => (
                <RaceCard
                  key={race.id}
                  {...race}
                  onClick={() => handleRaceClick(race.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;