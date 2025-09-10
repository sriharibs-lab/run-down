import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, MessageCircle } from "lucide-react";
import RaceCard from "./RaceCard";
import { useNavigate } from "react-router-dom";

// Mock race data
import trailRaceImage from "@/assets/trail-race.jpg";
import cityMarathonImage from "@/assets/city-marathon.jpg";
import coastalRaceImage from "@/assets/coastal-race.jpg";

interface AISearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AISearchModal = ({ open, onOpenChange }: AISearchModalProps) => {
  const [messages, setMessages] = useState<Array<{type: 'user' | 'ai', content: string, races?: any[]}>>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const examplePrompts = [
    "Find me a flat marathon for a PR attempt",
    "Family-friendly 5K races this summer",
    "Trail races within 2 hours of Seattle"
  ];

  const mockRaces = [
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
      name: "Boston Qualifier Fast Track",
      date: "November 3, 2024",
      location: "Austin, TX",
      distances: ["Marathon"],
      difficulty: "Easy" as const,
      participants: 8000
    }
  ];

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { type: 'user', content: message }]);
    setInputValue("");

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = "I found several flat marathon courses perfect for PR attempts. These races feature minimal elevation gain and fast, certified courses:";
      setMessages(prev => [...prev, { 
        type: 'ai', 
        content: aiResponse,
        races: mockRaces
      }]);
      setIsLoading(false);
    }, 1500);
  };

  const handleRaceClick = (raceId: string) => {
    navigate(`/race/${raceId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0 gap-0 bg-white shadow-xl border border-border z-50">
        <DialogHeader className="p-6 border-b bg-white">
          <DialogTitle className="flex items-center gap-2 text-xl font-heading">
            <Sparkles className="h-5 w-5 text-primary" />
            Run Down AI Search
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Conversation Area */}
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-6">
              {messages.length === 0 ? (
                <div className="text-center space-y-6 py-12">
                  <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto flex items-center justify-center">
                    <MessageCircle className="h-8 w-8 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-heading font-semibold">Ask me anything about races!</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      I can help you find races based on location, distance, terrain, difficulty, and more.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Try these examples:</p>
                    <div className="space-y-2">
                      {examplePrompts.map((prompt, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendMessage(prompt)}
                          className="text-left w-full max-w-md mx-auto block"
                        >
                          "{prompt}"
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message, index) => (
                    <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] ${
                        message.type === 'user' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-foreground'
                      } rounded-lg p-4`}>
                        <p className="text-sm">{message.content}</p>
                        
                        {message.races && (
                          <div className="mt-4 space-y-3">
                            {message.races.map((race) => (
                              <div key={race.id} className="bg-white rounded-lg p-1">
                                <RaceCard
                                  {...race}
                                  onClick={() => handleRaceClick(race.id)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-4">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="p-6 border-t bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask me about races..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                  className="flex-1"
                />
                <Button 
                  onClick={() => handleSendMessage(inputValue)}
                  disabled={!inputValue.trim() || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AISearchModal;