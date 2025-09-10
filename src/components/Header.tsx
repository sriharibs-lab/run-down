import { Search, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface HeaderProps {
  onSearchClick?: () => void;
}

const Header = ({ onSearchClick }: HeaderProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
              RD
            </div>
            <span className="text-xl font-heading font-bold text-foreground">
              Run Down
            </span>
          </div>

          {/* AI Search Bar - Center */}
          <div className="flex-1 max-w-2xl mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ask me anything... 'scenic half marathon in April near water'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={onSearchClick}
                className="pl-10 pr-12 py-3 text-sm search-enhanced cursor-pointer"
                readOnly
              />
              <Button
                size="sm"
                onClick={onSearchClick}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-primary hover:bg-primary-dark"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Right side - could add user menu later */}
          <div className="w-32"></div>
        </div>
      </div>
    </header>
  );
};

export default Header;