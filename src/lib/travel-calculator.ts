const LOUVRES_COORDINATES = [2.6336, 49.0425]; // Gare de Louvres, 95380 Louvres (point de départ LCS Barber)

export interface TravelCalculation {
  duration: number; // en minutes
  fees: number; // en euros
  distance: number; // en mètres
}

export interface TravelFeeSettings {
  freeMinutes: number;
  intervalMinutes: number;
  feePerInterval: number;
}

const defaultTravelSettings: TravelFeeSettings = {
  freeMinutes: 20,
  intervalMinutes: 20,
  feePerInterval: 10,
};

export const calculateTravelFees = async (
  address: string, 
  mapboxToken: string,
  settings?: TravelFeeSettings
): Promise<TravelCalculation> => {
  if (!address.trim() || !mapboxToken.trim()) {
    return { duration: 0, fees: 0, distance: 0 };
  }

  const travelSettings = settings || defaultTravelSettings;

  try {
    // Géocoder l'adresse du client
    const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&country=FR&limit=1`;
    
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = await geocodingResponse.json();
    
    if (!geocodingData.features || geocodingData.features.length === 0) {
      throw new Error('Adresse non trouvée');
    }
    
    const clientCoordinates = geocodingData.features[0].center;
    
    // Calculer la route depuis Louvres vers l'adresse du client
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${LOUVRES_COORDINATES[0]},${LOUVRES_COORDINATES[1]};${clientCoordinates[0]},${clientCoordinates[1]}?access_token=${mapboxToken}&geometries=geojson`;
    
    const directionsResponse = await fetch(directionsUrl);
    const directionsData = await directionsResponse.json();
    
    if (!directionsData.routes || directionsData.routes.length === 0) {
      throw new Error('Impossible de calculer la route');
    }
    
    const route = directionsData.routes[0];
    const durationInMinutes = Math.ceil(route.duration / 60);
    const distanceInMeters = route.distance;
    
    // Calculer les frais selon les paramètres configurables
    const fees = durationInMinutes < travelSettings.freeMinutes 
      ? 0 
      : Math.floor(durationInMinutes / travelSettings.intervalMinutes) * travelSettings.feePerInterval;
    
    return {
      duration: durationInMinutes,
      fees,
      distance: distanceInMeters
    };
    
  } catch (error) {
    console.error('Erreur calcul frais de déplacement:', error);
    throw error;
  }
};

export const formatTravelTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h${remainingMinutes.toString().padStart(2, '0')}`;
};

export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${meters} m`;
  }
  
  const kilometers = (meters / 1000).toFixed(1);
  return `${kilometers} km`;
};
