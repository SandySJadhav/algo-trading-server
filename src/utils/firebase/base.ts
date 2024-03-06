import Cron from 'croner';
import Firebase from './instance';
import fetch from 'node-fetch';
import { Timestamp } from 'firebase-admin/firestore';
import {
  MONTHS,
  commonPrint,
  getISTTime,
  getMomentPayload,
  sanitizeText
} from '../helpers';
import { instrument_prop } from '../types';
import { cleanAllStrategies } from './strategies';

/*
  const NSE = [
    "", // stocks - only consider stocks ending with -EQ postfix
    // "AMXIDX", // not supported
  ];
*/

const supportedInstruments: any = {
  MCX: {
    OPTFUT: true, // commodity options
    FUTCOM: true // commodity futures
    // "COMDTY", // not supported
    // "FUTIDX", // not supported
    // "AMXIDX", // not supported
  },
  NFO: {
    OPTSTK: true, // stock options
    OPTIDX: true, // index options
    FUTSTK: true, // stock futures
    FUTIDX: true // index futures
  }
};

/**
 *
 * @param list - String[]
 * @param text - String
 * @returns
 */
const keywordExists = (list: any = [], text: string) =>
  !text || list.indexOf(text) !== -1 || list.length >= 30;

const formatPayload = ({
  token,
  symbol,
  name,
  expiry,
  lotsize,
  instrumenttype,
  exch_seg,
  tick_size
}: instrument_prop) => {
  // name_keywords are related to name
  const name_keywords: any = [];
  // rel_keywords are related to symbol
  const rel_keywords: any = [];
  const payload = getMomentPayload(expiry || '12DEC9999');
  const expiryDate = getISTTime().set(payload);
  let strike;
  let option_type;

  let display_name = name;

  if (exch_seg !== 'NSE') {
    // stocks don't have expiry
    if (!keywordExists(rel_keywords, payload.date + '')) {
      rel_keywords.push(payload.date + ''); // 07
      display_name += ' ' + payload.date;
    }
    if (
      MONTHS[payload.month] &&
      !keywordExists(rel_keywords, MONTHS[payload.month])
    ) {
      rel_keywords.push(MONTHS[payload.month]); // JAN
      display_name += ' ' + MONTHS[payload.month];
    }
    if (!keywordExists(rel_keywords, expiryDate.year() + '')) {
      rel_keywords.push(expiryDate.year() + ''); // 2024
      display_name += ' ' + expiryDate.year();
    }
    if (['FUTCOM', 'FUTSTK', 'FUTIDX'].includes(instrumenttype)) {
      if (!keywordExists(rel_keywords, 'FUT')) {
        option_type = 'FUT';
        rel_keywords.push('FUT');
      }
    } else if (['OPTFUT', 'OPTSTK', 'OPTIDX'].includes(instrumenttype)) {
      let wrdStr = symbol.substring(name.length);
      const optionType = wrdStr.endsWith('CE')
        ? 'CE'
        : wrdStr.endsWith('PE')
          ? 'PE'
          : '';
      if (optionType) {
        if (!keywordExists(rel_keywords, optionType)) {
          rel_keywords.push(optionType); // CE or PE
        }
        // remove CT or PE at end
        wrdStr = wrdStr.substring(0, wrdStr.length - 2); // output -> MCX = 24FEB7000 and for NFO = 24FEB247000
        if (instrumenttype === 'OPTFUT') {
          // MCX option
          wrdStr = wrdStr.substring(5); // output = 7000
        } else {
          // NFO option
          wrdStr = wrdStr.substring(7); // output = 7000
        }
        if (!isNaN(Number(wrdStr))) {
          strike = Number(wrdStr);
          display_name += ' ' + strike;
        }
        if (!keywordExists(rel_keywords, wrdStr)) {
          rel_keywords.push(wrdStr); // 7000
        }

        option_type = optionType;

        const midVal: number = parseInt('' + wrdStr.length / 2);
        const minWordLen: number = midVal > 2 ? midVal : 3;

        for (let i = wrdStr.length; i >= minWordLen; i--) {
          const word = wrdStr.substring(0, i);
          if (!keywordExists(rel_keywords, word)) {
            rel_keywords.push(word);
          }
        }
      } else {
        console.log(
          'Something is missing with ["OPTFUT", "OPTSTK", "OPTIDX"], found option with do not ends with CE or PE',
          symbol
        );
      }
    }
    display_name += ' ' + option_type;
  }

  if (
    ['FUTCOM', 'FUTSTK', 'FUTIDX'].includes(instrumenttype) ||
    exch_seg === 'NSE'
  ) {
    const midVal: number = parseInt('' + name.length / 2);
    const minWordLen: number = midVal > 1 ? midVal : 2;

    for (let i = name.length; i >= minWordLen; i--) {
      const word = name.substring(0, i);
      const text = sanitizeText(word);
      if (!keywordExists(name_keywords, text)) {
        name_keywords.push(text);
      }
      if (!keywordExists(name_keywords, word)) {
        name_keywords.push(word);
      }
    }
  }

  return {
    expiry_timestamp: Timestamp.fromMillis(expiryDate.valueOf()),
    token,
    symbol,
    name,
    display_name,
    lotsize,
    instrumenttype,
    exch_seg,
    expiry,
    tick_size,
    name_keywords,
    rel_keywords,
    strike,
    option_type
  };
};

const filterInstruments = (instruments: instrument_prop[]) => {
  return instruments
    .filter(({ exch_seg, expiry, instrumenttype }: instrument_prop) => {
      // TODO - We will consider only MCX data for now.
      if (
        supportedInstruments[exch_seg]?.[instrumenttype] &&
        expiry &&
        exch_seg === 'MCX'
      ) {
        // either NFO or MCX, load only next 1 month of data
        const payload = getMomentPayload(expiry);
        const expiryDate = getISTTime().set(payload);

        // get todays date for comparison
        const todayDate = getISTTime().set({
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0
        });
        // get difference in missiseconds
        const diffTime = expiryDate.valueOf() - todayDate.valueOf();
        // conver to days
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // check if difference is not more than 36 days and not less than today's date
        return diffDays > 0 && diffDays < 36;
      }
      /* TODO - temporary remove all stocks & rest of stuff
      return (
        exch_seg === 'NSE' &&
        symbol.endsWith('-EQ') &&
        !instrumenttype &&
        !expiry
      );
      */
      return false;
    })
    .map(
      ({
        token,
        symbol,
        name,
        expiry,
        lotsize,
        instrumenttype,
        exch_seg,
        tick_size
      }: instrument_prop) => {
        return formatPayload({
          token,
          symbol,
          name,
          expiry,
          lotsize,
          instrumenttype,
          exch_seg,
          tick_size
        });
      }
    );
};

const fetchAllInstruments = async () => {
  let data = '';
  const response: any = {};
  console.log('Downloading all instrument data From Angel One...');
  await new Promise((resolve: any) => {
    fetch(
      'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json'
    )
      .then((response: any) => response.body)
      .then((res: any) =>
        res
          .on('readable', () => {
            let chunk;
            while (null !== (chunk = res.read())) {
              data += chunk.toString();
            }
          })
          .on('end', () => {
            if (!response.hasError) {
              console.log('Downloaded all instrument data From Angel One');
              response.instruments = JSON.parse(data);
              resolve('SUCCESS');
            }
          })
      )
      .catch((err: any) => {
        response.hasError = true;
        console.log(
          'Downloaded all instruments from Angel One failed ********',
          err
        );
        resolve('FAILED');
      });
  });
  return response;
};

const createBatchAndDeleteDocs = async (instruments: any) => {
  const batch = Firebase.db.batch();
  instruments.forEach((instrument: any) => {
    batch.delete(instrument);
  });
  return batch.commit();
};

const createBatchAndPushDocs = async (instruments: any, collection: any) => {
  // Get a new write batch
  const batch = Firebase.db.batch();
  instruments.forEach((instrument: any) => {
    batch.set(collection.doc(instrument.token), instrument);
  });
  return batch.commit();
};

const processInstruments = async (
  instruments: any,
  collection: any,
  isDelete: any = false
) => {
  const chunkSize = 50;
  const allRecords = [];
  for (let i = 0; i < instruments.length; i += chunkSize) {
    const chunk = instruments.slice(i, i + chunkSize);
    if (chunk.length > 0) {
      if (isDelete) {
        allRecords.push(createBatchAndDeleteDocs(chunk));
      } else {
        allRecords.push(createBatchAndPushDocs(chunk, collection));
      }
    }
  }
  await Promise.all(allRecords);
  console.log(
    isDelete
      ? `Deleted ${instruments.length} records from Firestore 🏄`
      : `Pushed all records to Firestore in ${allRecords.length} batches 🏄`
  );
};

const initiateDataSync = async () => {
  const collection = await Firebase.db.collection('instruments');
  // delete existing data from firestore if already expired
  const deleteInstrumentList: any[] = [];

  try {
    const dtStart = getISTTime().set({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0
    });

    // find contracts expired at 12AM midnight
    const docs = await collection
      .where('expiry_timestamp', '<', Timestamp.fromMillis(dtStart.valueOf()))
      .get();
    // all these documents are going to be delete because they are expired
    docs.forEach((doc: any) => {
      deleteInstrumentList.push(doc.ref);
    });
  } catch (error) {
    console.log(JSON.parse(JSON.stringify(error)));
    return;
  }
  if (deleteInstrumentList.length > 0) {
    // proceed to delete instruments from database;
    console.log(`🚀 Found expired ${deleteInstrumentList.length} instruments`);
    await processInstruments(deleteInstrumentList, collection, true);

    // fetch all instruments from Angel one free json file
    const { instruments, hasError } = await fetchAllInstruments();
    if (hasError) {
      // store this data in Firebase database
      return;
    }

    // now create new payload to upload new data
    const selectedInstruments = filterInstruments(instruments);
    if (selectedInstruments?.length > 0) {
      console.log('🚀 Record Count: ', selectedInstruments.length);
      await processInstruments(selectedInstruments, collection, false);
    } else {
      console.log('🚀 Everything up to date 🏄 ', commonPrint());
    }
  } else {
    console.log('🚀 Everything up to date 🏄 ', commonPrint());
  }
};

/**
 * Croner to sync all instruments from Angel to Firestore
 */
export const startCronerToSyncInstruments = () => {
  /**
   * ┌──────────────── (optional) second (0 - 59)
   * │ ┌────────────── minute (0 - 59)
   * │ │ ┌──────────── hour (0 - 23)
   * │ │ │ ┌────────── day of month (1 - 31)
   * │ │ │ │ ┌──────── month (1 - 12, JAN-DEC)
   * │ │ │ │ │ ┌────── day of week (0 to 6 are Sunday to Saturday; 7 is Sunday, the same as 0)
   * │ │ │ │ │ │
   * * * * * * *
   */

  // At 05:00 on every day-of-week from Monday through Friday.
  Cron('0 0 5 * * 1-5', async () => {
    console.log(
      '🚀 Starting data sync with Angel and 🔥 store ',
      commonPrint()
    );
    cleanAllStrategies();
    initiateDataSync();
  });
};
