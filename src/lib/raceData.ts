import { DateRange } from 'react-day-picker';

// Import race data
import racesData from '@/data/races.json';

// Type definitions for the race data
export interface Race {
  id: string;
  name: string;
  date: string;
  city: string;
  state: string;
  distance: string;
  difficulty: 'Easy' | 'Moderate' | 'Challenging' | 'Beginner';
  description: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  hasKidsRace: boolean;
  registrationUrl: string;
  participants?: number;
  distanceOptions?: string[];
  elevationGain?: number;
  courseType?: string;
  startTime?: string;
  registrationFee?: string;
}

// Transform JSON data to match the expected format for RaceCard components
export const transformRaceForCard = (race: Race) => {
  const transformed = {
    id: race.id,
    image: race.imageUrl,
    name: race.name,
    date: formatDate(race.date),
    location: `${race.city}, ${race.state}`,
    distances: [mapDistanceToFilter(race.distance)],
    difficulty: race.difficulty
  };
  
  // Only include participants if the data is available and greater than 0
  if (race.participants && race.participants > 0) {
    return { ...transformed, participants: race.participants };
  }
  
  return transformed;
};

// Format date from various formats to readable format
const formatDate = (dateString: string): string => {
  try {
    let date: Date;
    
    // Handle different date formats
    if (dateString.includes('/')) {
      // Handle MM/DD/YYYY format
      const [month, day, year] = dateString.split('/');
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      // Handle YYYY-MM-DD format
      date = new Date(dateString);
    }
    
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

// Map RunSignUp distance formats to standardized filter options
const mapDistanceToFilter = (distance: string): string => {
  const distanceLower = distance.toLowerCase();
  
  // Check for longer distances first to avoid partial matches
  if (distanceLower.includes('26.2') || distanceLower.includes('marathon')) {
    return 'Marathon';
  } else if (distanceLower.includes('13.1') || distanceLower.includes('half')) {
    return 'Half Marathon';
  } else if (distanceLower.includes('ultra') || distanceLower.includes('50k') || distanceLower.includes('100k') || distanceLower.includes('100 mile') || distanceLower.includes('53.8')) {
    return 'Ultra';
  } else if (distanceLower.includes('10k') || distanceLower.includes('6.2')) {
    return '10K';
  } else if (distanceLower.includes('3.1')) {
    return '5K';
  } else if (distanceLower.includes('5k') && !distanceLower.includes('0.5')) {
    return '5K';
  } else if (distanceLower.includes('1k') || distanceLower.includes('2k') || distanceLower.includes('3k') || 
             distanceLower.includes('1 mile') || distanceLower.includes('2 mile') || distanceLower.includes('3 mile') ||
             distanceLower.includes('0.5') || distanceLower.includes('800') || distanceLower.includes('400') ||
             distanceLower.includes('100') || distanceLower.includes('200') || distanceLower.includes('300')) {
    return 'Less than 5K';
  }
  
  return distance; // Return original if no match
};

// Check if race is within next 6 months
const isWithinNext6Months = (dateString: string): boolean => {
  try {
    let raceDate: Date;
    
    // Handle different date formats
    if (dateString.includes('/')) {
      // Handle MM/DD/YYYY format
      const [month, day, year] = dateString.split('/');
      raceDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      // Handle YYYY-MM-DD format
      raceDate = new Date(dateString);
    }
    
    if (isNaN(raceDate.getTime())) {
      return false;
    }
    
    const today = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(today.getMonth() + 6);
    
    return raceDate >= today && raceDate <= sixMonthsFromNow;
  } catch (error) {
    return false;
  }
};

// Deduplicate races by name + date combination
const deduplicateRaces = (races: Race[]): Race[] => {
  const seen = new Set<string>();
  return races.filter(race => {
    const key = `${race.name.toLowerCase().trim()}_${race.date}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

// Get all races (filtered to next 6 months and WA/OR/CA only, deduplicated)
export const getAllRaces = (): Race[] => {
  const filteredRaces = (racesData as Race[]).filter(race => {
    // Filter by date (next 6 months)
    const isWithinTimeframe = isWithinNext6Months(race.date);
    
    // Filter by state (WA, OR, CA only)
    const isInTargetStates = ['WA', 'OR', 'CA'].includes(race.state);
    
    return isWithinTimeframe && isInTargetStates;
  });
  
  return deduplicateRaces(filteredRaces);
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


// Sort original race data before transformation
const sortOriginalRaces = (races: Race[], sortBy: string): Race[] => {
  const sortedRaces = [...races];
  
  switch (sortBy) {
    case 'date':
      return sortedRaces.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });
    
    case 'distance':
      const distanceOrder = { 'Less than 5K': 1, '5K': 2, '10K': 3, 'Half Marathon': 4, 'Marathon': 5, 'Ultra': 6 };
      return sortedRaces.sort((a, b) => {
        const distanceA = mapDistanceToFilter(a.distance);
        const distanceB = mapDistanceToFilter(b.distance);
        const orderA = distanceOrder[distanceA as keyof typeof distanceOrder] || 999;
        const orderB = distanceOrder[distanceB as keyof typeof distanceOrder] || 999;
        return orderA - orderB;
      });
    
    case 'location':
      return sortedRaces.sort((a, b) => {
        const locationA = `${a.city}, ${a.state}`;
        const locationB = `${b.city}, ${b.state}`;
        return locationA.localeCompare(locationB);
      });
    
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
  // Start with base filtered data (6 months, WA/OR/CA only)
  const baseFilteredRaces = (racesData as Race[]).filter(race => {
    // Filter by date (next 6 months)
    const isWithinTimeframe = isWithinNext6Months(race.date);
    
    // Filter by state (WA, OR, CA only)
    const isInTargetStates = ['WA', 'OR', 'CA'].includes(race.state);
    
    return isWithinTimeframe && isInTargetStates;
  });

  // Apply additional filters
  const filteredRaces = baseFilteredRaces.filter(race => {
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
    
    // Distance filter (use mapped distance)
    if (filters.distances && filters.distances.length > 0) {
      const mappedDistance = mapDistanceToFilter(race.distance);
      if (!filters.distances.includes(mappedDistance)) {
        return false;
      }
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
  });
  
  // Sort original data first, then deduplicate and transform
  const sortedRaces = sortOriginalRaces(filteredRaces, sortBy);
  return deduplicateRaces(sortedRaces).map(transformRaceForCard);
};
