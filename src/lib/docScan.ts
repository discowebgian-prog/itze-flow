/* eslint-disable */
// @ts-nocheck
import { askClaude } from './claude';

const MAX_LONG_EDGE = 1800;
const JPEG_QUALITY = 0.8;

const SCAN_PROMPT = `Extract identity document data. Return ONLY valid JSON:
{"firstName":"","lastName":"","fullName":"","docNumber":"","docType":"INE","nationality":"MX","birthDate":""}
fullName = given names first, then surnames (a Mexican INE prints surnames first, so reorder them).
docNumber = for a Mexican INE use the 18-character CURP (not the CLAVE DE ELECTOR); for a passport from any country use the passport number, keeping its letters. Its label varies by country ("Número/Number", "Passport No.", "Pasaporte No.", "No."). If the label is missing or unclear, take it from the first 9 characters of the second line of the machine-readable zone at the bottom of the page (the lines with <<<), dropping any < filler. Never use a personal ID number such as a DNI.
docType = INE|Pasaporte|Otro. nationality = the holder's nationality as a 2-letter ISO code (a passport shows it as 3 letters in the "Nationality" field and in the machine-readable zone, e.g. CAN → CA, DEU or D → DE, GBR → GB); a Mexican INE is always MX. birthDate = the holder's date of birth as YYYY-MM-DD ("Fecha de nacimiento", "Date of birth", "Date de naissance"…); on a passport you can also take it from characters 14–19 (YYMMDD) of the second line of the machine-readable zone. Leave a field empty if unclear.`;

// Las fotos de celular pesan varios MB y Vercel acepta hasta 4.5 MB por pedido.
const compressPhoto = async (file) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    });

    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

// Devuelve los datos leídos, o null si Claude no encontró datos en la foto.
export async function scanDocument(file) {
  const dataUrl = await compressPhoto(file);
  const raw = await askClaude({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: dataUrl.split(',')[1] } },
          { type: 'text', text: SCAN_PROMPT },
        ],
      },
    ],
    maxTokens: 4000,
    effort: 'low',
  });

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  return parsed.docNumber || parsed.firstName || parsed.fullName ? parsed : null;
}
