import heroImage from "@/assets/hero-runners.jpg";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search } from "lucide-react";

interface HeroSectionProps {
  onSearchClick?: () => void;
}

const HeroSection = ({ onSearchClick }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Runners at race start line"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Main Headline */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-heading font-bold text-white leading-tight">
              Discover Your
              <span className="block bg-gradient-hero bg-clip-text text-transparent drop-shadow-lg" style={{
                textShadow: '0 0 30px rgba(0, 102, 255, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3)',
                WebkitTextStroke: '1px rgba(255, 255, 255, 0.1)'
              }}>
                Perfect Race
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed">
              AI-powered search for running events across America. 
              Find races by distance, location, and terrain preferences.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              onClick={onSearchClick}
              className="btn-hero text-lg px-8 py-4 group"
            >
              <Search className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              Start AI Search
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="btn-ghost-primary text-lg px-8 py-4 bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white hover:text-primary"
            >
              Browse All Races
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto pt-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">10,000+</div>
              <div className="text-sm text-white/80">Active Races</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">50</div>
              <div className="text-sm text-white/80">States Covered</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">1M+</div>
              <div className="text-sm text-white/80">Happy Runners</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/70 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;