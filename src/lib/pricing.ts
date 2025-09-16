export const calculatePricing = (basePrice: number, time: string) => {
  const hour = parseInt(time.split(':')[0]);
  const isEarlyMorning = hour < 10;
  const isLateEvening = hour >= 20;
  
  const supplement = (isEarlyMorning || isLateEvening) ? 5 : 0;
  const totalPrice = basePrice + supplement;
  
  return {
    basePrice,
    supplement,
    totalPrice,
    hasTimeupplement: supplement > 0
  };
};

export const getTimeSupplementText = (time: string) => {
  const hour = parseInt(time.split(':')[0]);
  if (hour < 10) return "Tôt le matin (+5€)";
  if (hour >= 20) return "Tard le soir (+5€)";
  return null;
};