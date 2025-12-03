export interface HourlySupplementSettings {
  earlyHourThreshold: number;
  earlyHourFee: number;
  lateHourThreshold: number;
  lateHourFee: number;
}

const defaultHourlySettings: HourlySupplementSettings = {
  earlyHourThreshold: 10,
  earlyHourFee: 5,
  lateHourThreshold: 20,
  lateHourFee: 5,
};

export const calculatePricing = (
  basePrice: number, 
  time: string, 
  travelFees: number = 0,
  settings?: HourlySupplementSettings
) => {
  const hour = parseInt(time.split(':')[0]);
  const hourlySettings = settings || defaultHourlySettings;
  
  let supplement = 0;
  
  // Calcul du supplément pour les heures avant le seuil du matin
  if (hour < hourlySettings.earlyHourThreshold) {
    const hoursBefore = hourlySettings.earlyHourThreshold - hour;
    supplement += hoursBefore * hourlySettings.earlyHourFee;
  }
  
  // Calcul du supplément pour les heures après le seuil du soir
  if (hour >= hourlySettings.lateHourThreshold) {
    const hoursAfter = hour - (hourlySettings.lateHourThreshold - 1);
    supplement += hoursAfter * hourlySettings.lateHourFee;
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

export const getTimeSupplementText = (
  time: string,
  settings?: HourlySupplementSettings
) => {
  const hour = parseInt(time.split(':')[0]);
  const hourlySettings = settings || defaultHourlySettings;
  
  if (hour < hourlySettings.earlyHourThreshold) {
    const hoursBefore = hourlySettings.earlyHourThreshold - hour;
    return `Tôt le matin (+${hoursBefore * hourlySettings.earlyHourFee}€)`;
  }
  
  if (hour >= hourlySettings.lateHourThreshold) {
    const hoursAfter = hour - (hourlySettings.lateHourThreshold - 1);
    return `Tard le soir (+${hoursAfter * hourlySettings.lateHourFee}€)`;
  }
  
  return null;
};
