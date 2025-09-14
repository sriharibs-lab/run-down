import { useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Search, 
  Users, 
  MapPin, 
  Filter, 
  Calendar,
  Brain,
  MessageSquare,
  Heart,
  Target,
  Cloud,
  Mountain,
  Camera,
  Zap,
  ArrowRight,
  CheckCircle,
  Clock,
  Star
} from "lucide-react";

const Roadmap = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const phases = [
    {
      id: 1,
      title: "Core Discovery",
      subtitle: "Current",
      status: "completed",
      description: "The foundation for race discovery with essential filtering and browsing capabilities.",
      features: [
        { icon: Search, text: "Browse 50+ sample races across the US" },
        { icon: Filter, text: "Advanced filtering by distance, date, state" },
        { icon: Calendar, text: "Date range selection" },
        { icon: Star, text: "Sort by date, distance, popularity" }
      ],
      color: "bg-green-500",
      borderColor: "border-green-200",
      bgColor: "bg-green-50/50"
    },
    {
      id: 2,
      title: "AI-Powered Search",
      subtitle: "Q1 2025",
      status: "in-progress",
      description: "Intelligent race discovery powered by AI to understand natural language queries.",
      features: [
        { icon: Brain, text: "Natural language search queries" },
        { icon: Heart, text: "Personalized race recommendations" },
        { icon: Target, text: "'Races like this' feature" },
        { icon: MessageSquare, text: "ChatGPT-powered race assistant" },
        { icon: Zap, text: "Smart race matching algorithm" },
        { icon: MapPin, text: "Interactive map view" },
        { icon: Search, text: "Real race data integration" }
      ],
      color: "bg-blue-500",
      borderColor: "border-blue-200",
      bgColor: "bg-blue-50/50"
    },
    {
      id: 3,
      title: "Community Features",
      subtitle: "Q2 2025",
      status: "planned",
      description: "Building a community around running with reviews, training plans, and social features.",
      features: [
        { icon: Users, text: "Race reviews and ratings" },
        { icon: Target, text: "Personalized training plans" },
        { icon: Heart, text: "Group registration discounts" },
        { icon: Calendar, text: "Race day meetups" },
        { icon: Star, text: "Runner achievement system" }
      ],
      color: "bg-purple-500",
      borderColor: "border-purple-200",
      bgColor: "bg-purple-50/50"
    }
  ];

  const upcomingFeatures = [
    {
      icon: Zap,
      title: "ChatGPT-Powered Race Assistant",
      description: "Ask questions like 'Find me a scenic half marathon in California this spring'",
      category: "AI"
    },
    {
      icon: Target,
      title: "Strava Integration",
      description: "Import your training data to get personalized race recommendations",
      category: "Integration"
    },
    {
      icon: Calendar,
      title: "Training Plan Matcher",
      description: "Get training plans tailored to your race goals and timeline",
      category: "Training"
    },
    {
      icon: Cloud,
      title: "Weather Predictions",
      description: "Historical weather data to help you pick the perfect race day",
      category: "Data"
    },
    {
      icon: Mountain,
      title: "Elevation Profiles",
      description: "Detailed elevation charts for every race course",
      category: "Course"
    },
    {
      icon: Camera,
      title: "Photo Galleries",
      description: "Browse photos from past races to see the course and atmosphere",
      category: "Visual"
    },
    {
      icon: Users,
      title: "Race Day Meetups",
      description: "Connect with other runners before, during, and after races",
      category: "Social"
    },
    {
      icon: Heart,
      title: "Personal Race Journal",
      description: "Track your race history, PRs, and memorable moments",
      category: "Personal"
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "in-progress":
        return <Clock className="h-5 w-5 text-blue-500" />;
      case "planned":
        return <Calendar className="h-5 w-5 text-purple-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Completed</Badge>;
      case "in-progress":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">In Progress</Badge>;
      case "planned":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Planned</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/10 to-blue-500/10 px-4 py-2 rounded-full text-sm font-medium text-primary mb-6">
            <Sparkles className="h-4 w-4" />
            Product Roadmap
          </div>
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-foreground mb-6">
            The Future of{" "}
            <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
              Run Down
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Building the smartest race discovery platform that understands runners, 
            learns from preferences, and connects communities.
          </p>
        </div>

        {/* Phases Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-heading font-bold text-center text-foreground mb-12">
            Development Phases
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {phases.map((phase, index) => (
              <Card 
                key={phase.id} 
                className={`relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl ${phase.borderColor} ${phase.bgColor} group`}
              >
                <div className={`absolute top-0 left-0 w-full h-1 ${phase.color}`} />
                
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full ${phase.color} flex items-center justify-center text-white font-bold text-sm`}>
                        {phase.id}
                      </div>
                      <div>
                        <CardTitle className="text-xl font-heading">{phase.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{phase.subtitle}</p>
                      </div>
                    </div>
                    {getStatusIcon(phase.status)}
                  </div>
                  {getStatusBadge(phase.status)}
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {phase.description}
                  </p>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {phase.features.map((feature, featureIndex) => (
                      <div 
                        key={featureIndex}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/50 transition-colors duration-200 group-hover:translate-x-1"
                        style={{ transitionDelay: `${featureIndex * 50}ms` }}
                      >
                        <feature.icon className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground">{feature.text}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Upcoming Features Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-heading font-bold text-foreground mb-4">
              Upcoming Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Exciting features in development to make your race discovery experience even better.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {upcomingFeatures.map((feature, index) => (
              <Card 
                key={index}
                className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50 hover:border-primary/30"
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary/10 to-primary/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <Badge variant="outline" className="mb-2 text-xs">
                        {feature.category}
                      </Badge>
                      <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-200">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <Card className="bg-gradient-to-r from-primary/5 to-blue-500/5 border-primary/20">
          <CardContent className="p-8 text-center">
            <div className="max-w-2xl mx-auto">
              <h3 className="text-2xl font-heading font-bold text-foreground mb-4">
                Stay Updated on Our Progress
              </h3>
              <p className="text-muted-foreground mb-6">
                Want to be the first to know when new features launch? 
                Follow our development journey and share your feedback.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="group">
                  Get Early Access
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
                <Button variant="outline">
                  Join Our Community
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Roadmap;
