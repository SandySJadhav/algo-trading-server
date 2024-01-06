import Cron from "croner";
import Firebase from "./instance";
import fetch from "node-fetch";
import { Timestamp } from "firebase-admin/firestore";
import { sanitizeText } from "../helpers";

/*
  const NSE = [
    "", // stocks - only consider stocks ending with -EQ postfix
    // "AMXIDX", // not supported
  ];
*/

const supportedInstruments: any = {
  MCX: [
    "OPTFUT", // commodity futures
    "FUTCOM", // commodity futures
    // "COMDTY", // not supported
    // "FUTIDX", // not supported
    // "AMXIDX", // not supported
  ],
  NFO: [
    "OPTSTK", // stock options
    "OPTIDX", // index options
    "FUTSTK", // stock futures
    "FUTIDX", // index futures
  ],
};

const months = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/**
 *
 * @param list - String[]
 * @param text - String
 * @returns
 */
const keywordExists = (list: any = [], text: string) =>
  !text || list.indexOf(text) !== -1 || list.length >= 30;

type Prop = {
  token: any;
  symbol: string;
  name: string;
  expiry: string;
  lotsize: any;
  instrumenttype: string;
  exch_seg: string;
  tick_size: any;
};

const formatPayload = ({
  token,
  symbol,
  name,
  expiry,
  lotsize,
  instrumenttype,
  exch_seg,
  tick_size,
}: Prop) => {
  // name_keywords are related to name
  const name_keywords: any = [];
  // rel_keywords are related to symbol
  const rel_keywords: any = [];

  const expiryDate = new Date(expiry || "12DEC9999");
  expiryDate.setHours(23, 59, 59, 999);

  if (exch_seg !== "NSE") {
    // stocks don't have expiry
    const month = months[expiryDate.getMonth()]; // month = JAN
    const expDate = expiry.split(month)[0]; // expDate = 31
    if (!keywordExists(rel_keywords, month)) {
      rel_keywords.push(month); // JAN
    }
    if (!keywordExists(rel_keywords, expDate)) {
      rel_keywords.push(expDate); // 31
    }
    if (["FUTCOM", "FUTSTK", "FUTIDX"].includes(instrumenttype)) {
      if (!keywordExists(rel_keywords, "FUT")) {
        rel_keywords.push("FUT");
      }
    } else if (["OPTFUT", "OPTSTK", "OPTIDX"].includes(instrumenttype)) {
      let wrdStr = symbol.substring(name.length);
      const optionType = wrdStr.endsWith("CE")
        ? "CE"
        : wrdStr.endsWith("PE")
        ? "PE"
        : "";
      if (optionType) {
        if (!keywordExists(rel_keywords, optionType)) {
          rel_keywords.push(optionType); // CE or PE
        }
        // remove CT or PE at end
        wrdStr = wrdStr.substring(0, wrdStr.length - 2); // output -> MCX = 24FEB7000 and for NFO = 24FEB247000
        if (instrumenttype === "OPTFUT") {
          // MCX option
          wrdStr = wrdStr.substring(5); // output = 7000
        } else {
          // NFO option
          wrdStr = wrdStr.substring(7); // output = 7000
        }
        if (!keywordExists(rel_keywords, wrdStr)) {
          rel_keywords.push(wrdStr); // 7000
        }

        const midVal: number = parseInt("" + wrdStr.length / 2);
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
  }

  const midVal: number = parseInt("" + name.length / 2);
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

  return {
    expiry_timestamp: Timestamp.fromDate(expiryDate),
    token,
    symbol,
    name,
    lotsize,
    instrumenttype,
    exch_seg,
    expiry,
    tick_size,
    name_keywords,
    rel_keywords,
  };
};

const filterInstruments = (instruments: Prop[] = []) => {
  return instruments
    .filter(({ exch_seg, expiry, symbol, instrumenttype }: Prop) => {
      if (supportedInstruments[exch_seg]?.[instrumenttype] && expiry) {
        // either NFO or MCX, load only next 1 month of data
        const expiryDate = new Date(expiry);
        // set time as day end
        expiryDate.setHours(23, 59, 59, 999);
        // get todays date for comparison
        const todayDate = new Date();
        // set time as day start
        todayDate.setHours(0, 0, 0, 0);
        // get difference in missiseconds
        const diffTime = expiryDate.valueOf() - todayDate.valueOf();
        // conver to days
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // check if difference is not more than 62 days and not less than today's date
        if (diffDays > 0 && diffDays < 32) {
          // date difference is not more than 61 days
          return true;
        }
        // expiry date is faar away more than what we need
        return false;
      }
      return (
        exch_seg === "NSE" &&
        !instrumenttype &&
        symbol.endsWith("-EQ") &&
        !expiry
      );
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
        tick_size,
      }: Prop) => {
        return formatPayload({
          token,
          symbol,
          name,
          expiry,
          lotsize,
          instrumenttype,
          exch_seg,
          tick_size,
        });
      }
    );
};

const fetchAllInstruments = async () => {
  let data: string = "";
  let response: any = {};
  console.log("Downloading all instrument data From Angel One...");
  await new Promise((resolve: any) => {
    fetch(
      "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
    )
      .then((response) => response.body)
      .then((res) =>
        res
          .on("readable", () => {
            let chunk;
            while (null !== (chunk = res.read())) {
              data += chunk.toString();
            }
          })
          .on("end", () => {
            if (!response.hasError) {
              console.log("Downloaded all instrument data From Angel One");
              response.instruments = JSON.parse(data);
              resolve("SUCCESS");
            }
          })
      )
      .catch((err) => {
        response.hasError = true;
        console.log(
          "Downloaded all instruments from Angel One failed ********",
          err
        );
        resolve("FAILED");
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
      ? "Deleted all records from Firestore"
      : `Pushed all records to Firestore in ${allRecords.length} batches`
  );
};

const processDataToFirebase = async () => {
  const collection = await Firebase.db.collection("instruments");
  // delete existing data from firestore if already expired
  const deleteInstrumentList: any[] = [];

  try {
    const dtStart = new Date();
    dtStart.setHours(0, 0, 0, 0);
    // find contracts expired at 12AM midnight
    const docs = await collection
      .where("expiry_timestamp", "<", Timestamp.fromDate(dtStart))
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
    await processInstruments(deleteInstrumentList, collection, true);

    // fetch all instruments from Angel one free json file
    const { instruments, hasError } = await fetchAllInstruments();
    if (hasError) {
      // store this data in Firebase database
      console.log("Failed to download instruments from Angel One");
      return;
    }

    // now create new payload to upload new data
    const selectedInstruments = filterInstruments();
    if (selectedInstruments?.length > 0) {
      console.log(
        "Pushing NSE, NFO & MCX records to Firestore ---> Count: ",
        selectedInstruments.length
      );
      await processInstruments(selectedInstruments, collection, false);
    } else {
      console.log(
        "No records to delete. Everything already up to date in Firestore"
      );
    }
  } else {
    console.log(
      "No records to delete. Everything already up to date in Firestore"
    );
  }
};

/**
 * ┌──────────────── (optional) second (0 - 59)
 * │ ┌────────────── minute (0 - 59)
 * │ │ ┌──────────── hour (0 - 23)
 * │ │ │ ┌────────── day of month (1 - 31)
 * │ │ │ │ ┌──────── month (1 - 12, JAN-DEC)
 * │ │ │ │ │ ┌────── day of week (0 - 6, SUN-Mon), (0 to 6 are Sunday to Saturday; 7 is Sunday, the same as 0)
 * │ │ │ │ │ │
 * * * * * * *
 */

export const startCronerToSyncInstruments = () => {
  let maxRuns: any = undefined;
  let scheduledTimer: string = "0 0 5 * * 1-5";
  if (process.env.environment === "dev") {
    maxRuns = 1;
    scheduledTimer = "* * * * * *";
  }
  // for dev mode, run cron job im
  Cron(scheduledTimer, { maxRuns }, async () => {
    // run cron job at 11.30PM in night
    processDataToFirebase();
  });
};
