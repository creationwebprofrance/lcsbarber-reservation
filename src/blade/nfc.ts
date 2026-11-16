// Cartes NFC (Web NFC) : disponible dans Chrome sur Android uniquement.
// Sur iPhone, une carte déjà écrite s'ouvre toute seule quand on approche le téléphone.

type NdefRecord = { recordType: string; data?: DataView; encoding?: string };
type NdefReader = {
  write: (message: { records: { recordType: string; data: string }[] }, options?: { signal?: AbortSignal }) => Promise<void>;
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
  onreading: ((event: { message: { records: NdefRecord[] } }) => void) | null;
  onreadingerror: (() => void) | null;
};
type NdefCtor = new () => NdefReader;

export const nfcSupported = () => typeof window !== 'undefined' && 'NDEFReader' in window;
const reader = () => new (window as unknown as { NDEFReader: NdefCtor }).NDEFReader();

export function nfcErrorText(e: unknown) {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError') return 'Autorise l’accès NFC dans Chrome, puis réessaie.';
  if (name === 'NotSupportedError') return 'Le NFC est désactivé ou absent sur ce téléphone.';
  if (name === 'AbortError') return 'Lecture NFC arrêtée.';
  if (name === 'NetworkError') return 'Carte retirée trop tôt : garde-la contre le téléphone jusqu’à la confirmation.';
  return 'Écriture NFC impossible. Vérifie que le NFC est activé et que la carte n’est pas verrouillée.';
}

/** Écrit un lien sur la carte NFC approchée du téléphone. */
export async function writeNfcUrl(url: string, signal?: AbortSignal) {
  await reader().write({ records: [{ recordType: 'url', data: url }] }, { signal });
}

/** Attend une carte NFC et renvoie le premier lien lu. */
export function readNfcUrl(signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = reader();
    r.onreading = event => {
      for (const record of event.message.records) {
        if ((record.recordType === 'url' || record.recordType === 'text') && record.data) {
          resolve(new TextDecoder(record.encoding || 'utf-8').decode(record.data));
          return;
        }
      }
      reject(new Error('Cette carte ne contient pas de lien BLADE.'));
    };
    r.onreadingerror = () => reject(new Error('Carte illisible. Réessaie en la gardant contre le téléphone.'));
    r.scan({ signal }).catch(reject);
  });
}
