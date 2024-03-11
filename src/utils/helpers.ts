import moment from 'moment-timezone';
moment.tz.setDefault('Asia/Kolkata');

export const getISTTime = () => moment();

export const commonPrint = () => {
  const time = getISTTime();
  return ` => Execution Date-> ${time.date()}-${time.month() + 1}-${time.year()} ~ Time-> ${time.hours()}:${time.minutes()}:${time.seconds()}`;
};

export const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC'
];

export const getMomentPayload = (str: string) => {
  const expDate = str.substring(0, 2); // expDate = 31
  const month = str.substring(2, 5); // month = JAN
  const year = str.substring(5); // month = JAN

  const payload: any = {
    hour: 23,
    minute: 59,
    second: 59,
    millisecond: 999
  };

  if (!isNaN(Number(expDate))) {
    payload.date = Number(expDate);
  }
  if (MONTHS.indexOf(month) !== -1) {
    payload.month = MONTHS.indexOf(month);
  }
  if (!isNaN(Number(year))) {
    payload.year = Number(year);
  }

  return payload;
};

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

export const formatNumberInTime = (num: number): string => {
  return num > 9 ? num.toString() : '0' + num;
};
