/**
 * @param text String
 * @returns String
 */
export const generateHash = async (text: string) => {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text, 'utf-8').digest('hex');
};

/**
 * @param text String
 * @returns String
 */
export const sanitizeText = (text: string) =>
  text
    .replace(/[^a-zA-Z0-9\s:]/g, '')
    .trim()
    .toUpperCase();

export const toNumber = (number: number) => number.toString();

export const _atos = (array: any) => {
  const newarray = [];
  try {
    for (let i = 0; i < array.length; i++) {
      newarray.push(String.fromCharCode(array[i]));
    }
  } catch (e: any) {
    throw new Error(e);
  }

  const token: string = JSON.stringify(newarray.join(''));
  return token.replace(/\\u0000/g, '');
};
