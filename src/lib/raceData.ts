import { DateRange } from 'react-day-picker';

// Import race data
import racesData from '@/data/races';

// Type definitions for the race data
export interface Race {
  id: string;
  name: string;
  date: string;
  city: string;
  state: string;
  distance: string;
  difficulty: 'Easy' | 'Moderate' | 'Challenging';
  description: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  hasKidsRace: boolean;
  registrationUrl: string;
  participants: number;
}

// Transform JSON data to match the expected format for RaceCard components
export const transformRaceForCard = (race: Race) => ({
  id: race.id,
  image: race.imageUrl,
  name: race.name,
  date: formatDate(race.date),
  location: `${race.city}, ${race.state}`,
  distances: [race.distance],
  difficulty: race.difficulty,
  participants: race.participants
});

// Format date from YYYY-MM-DD to readable format
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original string if invalid date
    }
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (error) {
    return dateString; // Return original string if error
  }
};

// Get all races
export const getAllRaces = (): Race[] => {
  return racesData as Race[];
};

// Get race by ID
export const getRaceById = (id: string): Race | undefined => {
  return racesData.find(race => race.id === id) as Race | undefined;
};

// Get races for RaceCard components
export const getRacesForCards = () => {
  return racesData.map(transformRaceForCard);
};

// Get races with coordinates for map view
export const getRacesWithCoordinates = () => {
  return racesData.map(race => ({
    ...transformRaceForCard(race),
    coordinates: { lat: race.latitude, lng: race.longitude }
  }));
};

// Filter races by various criteria
export const filterRaces = (filters: {
  searchQuery?: string;
  distances?: string[];
  difficulty?: string;
  state?: string | string[];
  hasKidsRace?: boolean;
  dateRange?: DateRange;
}) => {
  return racesData.filter(race => {
    // Search query filter
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      const searchableText = [
        race.name,
        race.city,
        race.state,
        race.distance,
        race.difficulty,
        race.description
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchLower)) {
        return false;
      }
    }
    
    // Distance filter
    if (filters.distances && filters.distances.length > 0 && !filters.distances.includes(race.distance)) {
      return false;
    }
    
    // Difficulty filter
    if (filters.difficulty && race.difficulty !== filters.difficulty) {
      return false;
    }
    
    // State filter
    if (filters.state) {
      if (Array.isArray(filters.state)) {
        if (filters.state.length > 0 && !filters.state.includes(race.state)) {
          return false;
        }
      } else {
        if (race.state !== filters.state) {
          return false;
        }
      }
    }
    
    // Kids race filter
    if (filters.hasKidsRace !== undefined && race.hasKidsRace !== filters.hasKidsRace) {
      return false;
    }
    
    // Date range filter
    if (filters.dateRange) {
      const raceDate = new Date(race.date);
      if (raceDate < filters.dateRange.from || (filters.dateRange.to && raceDate > filters.dateRange.to)) {
        return false;
      }
    }
    
    return true;
  }).map(transformRaceForCard);
};

// Sort races by various criteria
export const sortRaces = (races: ReturnType<typeof transformRaceForCard>[], sortBy: string) => {
  const sortedRaces = [...races];
  
  switch (sortBy) {
    case 'date':
      return sortedRaces.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });
    
    case 'distance':
      const distanceOrder = { '5K': 1, '10K': 2, 'Half Marathon': 3, 'Marathon': 4, 'Ultra': 5 };
      return sortedRaces.sort((a, b) => {
        const distanceA = distanceOrder[a.distances[0] as keyof typeof distanceOrder] || 0;
        const distanceB = distanceOrder[b.distances[0] as keyof typeof distanceOrder] || 0;
        return distanceA - distanceB;
      });
    
    case 'location':
      return sortedRaces.sort((a, b) => a.location.localeCompare(b.location));
    
    case 'participants':
      return sortedRaces.sort((a, b) => (b.participants || 0) - (a.participants || 0));
    
    case 'name':
    default:
      return sortedRaces.sort((a, b) => a.name.localeCompare(b.name));
  }
};

// Combined filter and sort function
export const getFilteredAndSortedRaces = (
  filters: {
    searchQuery?: string;
    distances?: string[];
    difficulty?: string;
    state?: string | string[];
    hasKidsRace?: boolean;
    dateRange?: DateRange;
  },
  sortBy: string = 'date'
) => {
  const filteredRaces = filterRaces(filters);
  return sortRaces(filteredRaces, sortBy);
};
