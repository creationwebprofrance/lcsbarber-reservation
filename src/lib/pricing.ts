export const calculatePricing = (basePrice: number, time: string, travelFees: number = 0) => {
  const hour = parseInt(time.split(':')[0]);
  
  let supplement = 0;
  
  // Calcul du supplément pour les heures avant 10h
  if (hour < 10) {
    // Nombre d'heures avant 10h (8h = 2 heures, 9h = 1 heure)
    const hoursBefore10 = 10 - hour;
    supplement += hoursBefore10 * 5;
  }
  
  // Calcul du supplément pour les heures après 20h
  if (hour >= 20) {
    // Nombre d'heures après 19h (20h = 1 heure, 21h = 2 heures, 22h = 3 heures)
    const hoursAfter19 = hour - 19;
    supplement += hoursAfter19 * 5;
  }
  
  const totalPrice = basePrice + supplement + travelFees;
  
  return {
    basePrice,
    supplement,
    travelFees,
    totalPrice,
    hasTimeupplement: supplement > 0,
    hasTravelFees: travelFees > 0
  };
};

export const getTimeSupplementText = (time: string) => {
  const hour = parseInt(time.split(':')[0]);
  
  if (hour < 10) {
    const hoursBefore10 = 10 - hour;
    return `Tôt le matin (+${hoursBefore10 * 5}€)`;
  }
  
  if (hour >= 20) {
    const hoursAfter19 = hour - 19;
    return `Tard le soir (+${hoursAfter19 * 5}€)`;
  }
  
  return null;
};