import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Search,
  Loader2,
  Calendar,
  MapPin,
  TrendingUp,
  X,
  Zap,
  Mic,
  Square,
} from "lucide-react";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";

interface RaceResult {
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
}

interface SearchResponse {
  answer: string;
  races: RaceResult[];
  latency: {
    embedding_ms: number;
    search_ms: number;
    llm_ms: number;
    total_ms: number;
  };
}

const NLSearch = () => {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const pendingVoiceSearch = useRef(false);

  const onTranscription = useCallback(
    (text: string) => {
      setQuery(text);
      pendingVoiceSearch.current = true;
    },
    []
  );

  const {
    voiceState,
    startRecording,
    stopRecording,
    error: voiceError,
    clearError: clearVoiceError,
  } = useVoiceSearch(onTranscription);

  const handleSearch = async (searchQuery?: string) => {
    const trimmed = (searchQuery ?? query).trim();
    if (!trimmed) return;

    if (searchQuery !== undefined) setQuery(trimmed);

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const data: SearchResponse = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-trigger search when voice transcription sets the query
  useEffect(() => {
    if (pendingVoiceSearch.current && query.trim()) {
      pendingVoiceSearch.current = false;
      handleSearch(query);
    }
  }, [query]);

  const handleMicClick = () => {
    clearVoiceError();
    if (voiceState === "recording") {
      stopRecording();
    } else if (voiceState === "idle") {
      startRecording();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSearch();
    }
  };

  const clearResults = () => {
    setResult(null);
    setError(null);
    setQuery("");
    inputRef.current?.focus();
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "bg-green-50 border-green-200 text-green-700";
      case "Moderate":
        return "bg-yellow-50 border-yellow-200 text-yellow-700";
      case "Challenging":
        return "bg-red-50 border-red-200 text-red-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      let date: Date;
      if (dateStr.includes("/")) {
        const [month, day, year] = dateStr.split("/");
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        date = new Date(dateStr);
      }
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full">
      {/* Search Input */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <Input
              ref={inputRef}
              placeholder="Find your race... e.g. 'flat half marathon near Seattle in fall'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="pl-10 pr-4 py-3 text-sm border-primary/30 focus:border-primary"
            />
          </div>
          <Button
            onClick={() => handleSearch()}
            disabled={isLoading || !query.trim()}
            className="px-6"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant={voiceState === "recording" ? "destructive" : "outline"}
            size="icon"
            onClick={handleMicClick}
            disabled={isLoading || voiceState === "transcribing"}
            className="relative flex-shrink-0"
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
          {result && (
            <Button variant="ghost" size="icon" onClick={clearResults}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Voice state indicators */}
        {voiceState === "recording" && (
          <div className="flex items-center gap-2 mt-2">
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
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">
              Transcribing audio...
            </span>
          </div>
        )}
        {voiceError && (
          <div className="flex items-center gap-2 mt-2">
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

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">
              Searching across 4,891 races with AI...
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="mt-4 p-4 border-destructive/30 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-6">
          {/* AI Answer Card */}
          <Card className="p-5 bg-gradient-to-br from-primary/5 to-blue-500/5 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-heading font-semibold text-sm text-primary mb-2">
                  AI Recommendation
                </h4>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {result.answer}
                </p>
              </div>
            </div>
          </Card>

          {/* Matched Races */}
          <div className="space-y-3">
            <h4 className="font-heading font-semibold text-sm text-muted-foreground">
              Top Matches
            </h4>
            <div className="grid gap-3">
              {result.races.map((race) => (
                <Card
                  key={race.id}
                  className="p-4 cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-200 group"
                  onClick={() => navigate(`/race/${race.id}`)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-heading font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {race.metadata.name}
                      </h5>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(race.metadata.date)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {race.metadata.city}, {race.metadata.state}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="h-3 w-3" />
                          {race.metadata.distance}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className={getDifficultyColor(race.metadata.difficulty)}
                      >
                        {race.metadata.difficulty}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-primary/5 border-primary/20 text-primary text-xs tabular-nums"
                      >
                        {Math.round(race.score * 100)}% match
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Latency Footer */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span>
              Found in {(result.latency.total_ms / 1000).toFixed(1)}s via
              Fireworks (embed: {result.latency.embedding_ms}ms | search:{" "}
              {result.latency.search_ms}ms | LLM: {result.latency.llm_ms}ms)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NLSearch;
