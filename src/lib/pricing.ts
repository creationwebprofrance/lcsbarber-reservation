export interface HourlySupplementSettings {
  earlyHourThreshold: number;
  earlyHourFee: number;
  lateHourThreshold: number;
  lateHourFee: number;
  sameDayFee: number;
  sundayFee: number;
}

const defaultHourlySettings: HourlySupplementSettings = {
  earlyHourThreshold: 10,
  earlyHourFee: 5,
  lateHourThreshold: 20,
  lateHourFee: 5,
  sameDayFee: 5,
  sundayFee: 10,
};

export const calculatePricing = (
  basePrice: number, 
  time: string, 
  travelFees: number = 0,
  settings?: HourlySupplementSettings,
  appointmentDate?: Date
) => {
  const hour = parseInt(time.split(':')[0]);
  const hourlySettings = settings || defaultHourlySettings;
  
  let supplement = 0;
  let sameDayFee = 0;
  let sundayFee = 0;
  
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
  
  // Frais pour réservation le jour même et le dimanche
  if (appointmentDate) {
    const today = new Date();
    const isToday = appointmentDate.toDateString() === today.toDateString();
    if (isToday) {
      sameDayFee = hourlySettings.sameDayFee;
    }
    
    // Supplément dimanche (0 = dimanche)
    const isSunday = appointmentDate.getDay() === 0;
    if (isSunday) {
      sundayFee = hourlySettings.sundayFee;
    }
  }
  
  const totalPrice = basePrice + supplement + travelFees + sameDayFee + sundayFee;
  
  return {
    basePrice,
    supplement,
    travelFees,
    sameDayFee,
    sundayFee,
    totalPrice,
    hasTimeSupplement: supplement > 0,
    hasTravelFees: travelFees > 0,
    hasSameDayFee: sameDayFee > 0,
    hasSundayFee: sundayFee > 0
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
