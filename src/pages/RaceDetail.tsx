import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Users, 
  TrendingUp, 
  Mountain, 
  Route,
  Clock,
  ExternalLink,
  Share2,
  Heart
} from "lucide-react";

// Import images
import cityMarathonImage from "@/assets/city-marathon.jpg";
import Header from "@/components/Header";

const RaceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isFavorited, setIsFavorited] = useState(false);

  // Mock race data - in real app, this would be fetched based on ID
  const race = {
    id: "1",
    name: "Chicago Lakefront Marathon",
    image: cityMarathonImage,
    date: "October 15, 2024",
    location: "Chicago, IL",
    distances: ["Marathon", "Half Marathon", "10K"],
    difficulty: "Easy",
    participants: 45000,
    elevationGain: 150,
    courseType: "Road",
    startTime: "7:00 AM",
    description: "Experience the beauty of Chicago's lakefront with this fast and scenic marathon course. Run alongside Lake Michigan with stunning city skyline views while aiming for your personal best. This USATF certified course offers ideal conditions for Boston Qualifier attempts with minimal elevation gain and excellent crowd support throughout the 26.2 mile journey.",
    highlights: [
      "USATF certified & Boston Qualifier eligible",
      "Spectacular Lake Michigan views",
      "World-class organization & support",
      "Post-race celebration in Grant Park",
      "Professional timing & photography"
    ],
    weatherExpected: "Cool and clear, 45-55°F",
    registrationStatus: "Open",
    price: "$120-180"
  };

  const keyDetails = [
    { label: "Distance Options", value: race.distances.join(", "), icon: Route },
    { label: "Difficulty Level", value: race.difficulty, icon: TrendingUp },
    { label: "Elevation Gain", value: `${race.elevationGain} ft`, icon: Mountain },
    { label: "Course Type", value: race.courseType, icon: Route },
    { label: "Start Time", value: race.startTime, icon: Clock },
    { label: "Expected Participants", value: race.participants.toLocaleString(), icon: Users }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <div className="relative h-[60vh] overflow-hidden">
        <img
          src={race.image}
          alt={race.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Back Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 bg-white/90 backdrop-blur-sm border-white/20"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Action Buttons */}
        <div className="absolute top-6 right-6 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFavorited(!isFavorited)}
            className="bg-white/90 backdrop-blur-sm border-white/20"
          >
            <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/90 backdrop-blur-sm border-white/20"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Race Title & Details */}
        <div className="absolute bottom-8 left-6 right-6">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-3">
              <Badge className="badge-easy border font-medium bg-white/20 backdrop-blur-sm">
                {race.difficulty}
              </Badge>
              <Badge variant="outline" className="bg-white/20 backdrop-blur-sm border-white/30 text-white">
                {race.registrationStatus}
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-4">
              {race.name}
            </h1>
            <div className="flex flex-wrap items-center gap-6 text-white/90">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">{race.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <span className="font-medium">{race.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span className="font-medium">{race.participants.toLocaleString()} runners</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-semibold text-lg">{race.name}</h2>
              <p className="text-sm text-muted-foreground">{race.price} • {race.date}</p>
            </div>
            <Button className="btn-hero">
              <ExternalLink className="h-4 w-4 mr-2" />
              Visit Race Website
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Key Details */}
            <Card className="p-6">
              <h3 className="font-heading font-semibold text-xl mb-6">Race Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {keyDetails.map((detail, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <detail.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{detail.label}</div>
                      <div className="font-medium">{detail.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* About Section */}
            <Card className="p-6">
              <h3 className="font-heading font-semibold text-xl mb-4">About This Race</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {race.description}
              </p>
              
              <div className="space-y-3">
                <h4 className="font-heading font-medium">Race Highlights</h4>
                <ul className="space-y-2">
                  {race.highlights.map((highlight, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                      <span className="text-muted-foreground">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            {/* Course Map Placeholder */}
            <Card className="p-6">
              <h3 className="font-heading font-semibold text-xl mb-4">Course Map</h3>
              <div className="bg-muted rounded-lg h-64 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">Interactive course map coming soon</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Card */}
            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-foreground">{race.price}</div>
                  <div className="text-sm text-muted-foreground">Registration Fee</div>
                </div>
                <Separator />
                <Button className="w-full btn-hero">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Register Now
                </Button>
                <p className="text-xs text-muted-foreground">
                  You'll be redirected to the official race website
                </p>
              </div>
            </Card>

            {/* Weather Info */}
            <Card className="p-6">
              <h4 className="font-heading font-medium mb-3">Expected Weather</h4>
              <p className="text-muted-foreground text-sm">{race.weatherExpected}</p>
            </Card>

            {/* Distance Options */}
            <Card className="p-6">
              <h4 className="font-heading font-medium mb-3">Distance Options</h4>
              <div className="space-y-2">
                {race.distances.map((distance, index) => (
                  <Badge key={index} variant="outline" className="mr-2">
                    {distance}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RaceDetail;