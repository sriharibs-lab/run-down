import { useState, useRef, useEffect } from "react";
import { Sparkles, Search, Loader2, X, Mic, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useVoiceSearch, type VoiceState } from "@/hooks/useVoiceSearch";

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onAISearch?: (query: string) => void;
  isAISearching?: boolean;
  onLogoClick?: () => void;
}

const Header = ({ searchQuery, onSearchChange, onAISearch, isAISearching, onLogoClick }: HeaderProps) => {
  const [localQuery, setLocalQuery] = useState(searchQuery || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingVoiceSearch = useRef(false);

  const {
    voiceState,
    startRecording,
    stopRecording,
    error: voiceError,
    clearError: clearVoiceError,
  } = useVoiceSearch((text: string) => {
    setLocalQuery(text);
    onSearchChange?.(text);
    pendingVoiceSearch.current = true;
  });

  useEffect(() => {
    if (searchQuery !== undefined) setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Auto-trigger AI search after voice transcription
  useEffect(() => {
    if (pendingVoiceSearch.current && localQuery.trim()) {
      pendingVoiceSearch.current = false;
      onAISearch?.(localQuery.trim());
    }
  }, [localQuery]);

  const handleChange = (value: string) => {
    setLocalQuery(value);
    onSearchChange?.(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && localQuery.trim() && onAISearch && !isAISearching) {
      onAISearch(localQuery.trim());
    }
  };

  const handleClear = () => {
    setLocalQuery("");
    onSearchChange?.("");
    inputRef.current?.focus();
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" onClick={() => { onLogoClick?.(); handleClear(); }} className="flex items-center space-x-2 hover:opacity-80 transition-opacity flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
              RD
            </div>
            <span className="text-xl font-heading font-bold text-foreground hidden sm:inline">
              Run Down
            </span>
          </Link>

          {/* AI Search Bar - Center, bigger and highlighted */}
          <div className="flex-1 max-w-2xl mx-4">
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  ref={inputRef}
                  placeholder="Ask AI: 'flat half marathon near Seattle in fall'"
                  value={localQuery}
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isAISearching}
                  className="pl-11 pr-10 h-12 text-sm rounded-xl border-primary/30 shadow-md shadow-primary/5 focus:shadow-lg focus:shadow-primary/10 focus:border-primary bg-white transition-all duration-200"
                />
                {localQuery && (
                  <button
                    onClick={handleClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                onClick={() => localQuery.trim() && onAISearch?.(localQuery.trim())}
                disabled={isAISearching || !localQuery.trim()}
                size="lg"
                className="h-12 px-5 rounded-xl shadow-md shadow-primary/10"
              >
                {isAISearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Search</span>
                  </>
                )}
              </Button>
              <Button
                variant={voiceState === "recording" ? "destructive" : "outline"}
                size="icon"
                onClick={() => {
                  clearVoiceError();
                  if (voiceState === "recording") stopRecording();
                  else if (voiceState === "idle") startRecording();
                }}
                disabled={isAISearching || voiceState === "transcribing"}
                className="relative h-12 w-12 rounded-xl flex-shrink-0"
                title={voiceState === "recording" ? "Stop recording" : "Voice search"}
              >
                {voiceState === "transcribing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : voiceState === "recording" ? (
                  <>
                    <Square className="h-3.5 w-3.5 fill-current" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  </>
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </div>
            {/* Voice state indicators */}
            {voiceState === "recording" && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Recording... click stop or wait 10s
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  Voice powered by Fireworks Whisper
                </span>
              </div>
            )}
            {voiceState === "transcribing" && (
              <div className="mt-1.5">
                <span className="text-xs text-muted-foreground">Transcribing audio...</span>
              </div>
            )}
            {voiceError && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-destructive">{voiceError}</span>
                <button
                  onClick={clearVoiceError}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  dismiss
                </button>
              </div>
            )}
          </div>

          {/* Right side - Navigation */}
          <div className="flex items-center space-x-6 flex-shrink-0">
            <Link
              to="/roadmap"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:inline"
            >
              Roadmap
            </Link>
            <a
              href="https://srihari.page"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 hidden md:flex"
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
