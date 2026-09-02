export const REVOLUT_HANDLE = "lcsbarber";
export const REVOLUT_BASE_URL = "https://revolut.me/lcsbarber";

/**
 * Acompte = moitié de la prestation.
 * Si la prestation est inférieure à 20€, l'acompte est de 10€.
 */
export const calculateDeposit = (totalPrice: number): number => {
  if (!totalPrice || totalPrice <= 0) return 0;
  if (totalPrice < 20) return 10;
  return Math.round((totalPrice / 2) * 100) / 100;
};

export const getRevolutLink = (amount: number) =>
  `${REVOLUT_BASE_URL}/${amount.toFixed(2).replace(/\.00$/, "")}EUR`;

export const LATE_POLICY = {
  graceMinutes: 20,
  noticeHours: 1,
  lines: [
    "Un acompte est demandé pour confirmer le rendez-vous : la moitié de la prestation (minimum 10€ si la prestation est inférieure à 20€).",
    "Le rendez-vous n'est confirmé qu'une fois l'acompte reçu et vérifié.",
    "En cas de retard possible, il faut prévenir au moins 1h à l'avance.",
    "Au-delà de 20 minutes de retard, l'acompte est encaissé et le rendez-vous peut être annulé pour ne pas décaler les clients suivants.",
  ],
} as const;
