import { Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const Header = ({ searchQuery, onSearchChange }: HeaderProps) => {

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
              RD
            </div>
            <span className="text-xl font-heading font-bold text-foreground">
              Run Down
            </span>
          </Link>

          {/* Search Bar - Center */}
          <div className="flex-1 max-w-2xl mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search races by name, location, or description..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-3 text-sm"
              />
            </div>
          </div>

          {/* Right side - Navigation */}
          <div className="flex items-center space-x-6">
            <Link 
              to="/roadmap" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Roadmap
            </Link>
            <a 
              href="https://srihari.lovable.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              About
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;