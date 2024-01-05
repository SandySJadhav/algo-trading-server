import Cron from "croner";
import Firebase from "./instance";
import fetch from "node-fetch";
import { Timestamp } from "firebase-admin/firestore";
import { sanitizeText } from "../helpers";

const supportedSegments = ["NSE", "NFO", "MCX"];
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

const keywordExists = (list: any = [], text: string) =>
  list.indexOf(text) !== -1;

type Prop = {
  token: any;
  symbol: string;
  name: string;
  expiry: string;
  lotsize: any;
  instrumenttype?: string;
  exch_seg: string;
  tick_size: any;
};

const getPayload = ({
  token,
  symbol,
  name,
  expiry,
  lotsize,
  instrumenttype,
  exch_seg,
  tick_size,
}: Prop) => {
  let priority: number = 1;
  const dtEnd = new Date(expiry || "12DEC9999");
  dtEnd.setHours(23, 59, 59, 999);
  const keywords: any = [];

  // For NSE, NFO & MCX
  // push all combinations of symbol
  for (let i = 1; i < symbol.length; i++) {
    const text = sanitizeText(symbol.substring(0, i + 1));
    if (!keywordExists(keywords, text)) {
      keywords.push(text);
    }
  }
  /**
   * we have 3 types of instruments in MCX
   * 1. FUTCOM
   * 2. OPTFUT
   * 3. COMDTY - ignored for now, skipped
   */
  if (exch_seg === "MCX" && instrumenttype === "FUTCOM") {
    priority = 2;
    const month = months[dtEnd.getMonth()]; // output = JAN
    if (!keywordExists(keywords, month)) {
      keywords.push(month);
    }
    const actualExp = expiry.split(month); // output = [31, 2024]
    if (!keywordExists(keywords, actualExp[0])) {
      keywords.push(actualExp[0]); // 31
    }
    if (!keywordExists(keywords, actualExp[1])) {
      keywords.push(actualExp[1]); // 2024
    }
    const shortYear = actualExp[1].split("20")[1];
    if (!keywordExists(keywords, shortYear)) {
      keywords.push(shortYear); // 24
    }
    // all symbols ends with FUT string
    if (!keywordExists(keywords, "FUT")) {
      keywords.push("FUT");
    }
  } else if (
    (exch_seg === "MCX" && instrumenttype === "OPTFUT") ||
    exch_seg === "NFO"
  ) {
    priority = 3;
    // SILVERM24APR86250PE
    // BANKNIFTY17JAN2452500PE
    const month = months[dtEnd.getMonth()]; // output = JAN
    if (!keywordExists(keywords, month)) {
      keywords.push(month);
    }
    const actualExp = expiry.split(month); // output = [31, 2024]
    if (!keywordExists(keywords, actualExp[0])) {
      keywords.push(actualExp[0]); // 31
    }
    if (!keywordExists(keywords, actualExp[1])) {
      keywords.push(actualExp[1]); // 2024
    }
    const shortYear = actualExp[1].split("20")[1];
    if (!keywordExists(keywords, shortYear)) {
      keywords.push(shortYear); // 24
    }
    // extract remaining string
    let wrdStr = symbol.substring(name.length);
    if (wrdStr.endsWith("PE") || wrdStr.endsWith("CE")) {
      // put or call option
      const val = wrdStr.endsWith("CE") ? "CE" : "PE";
      wrdStr = wrdStr.substring(0, wrdStr.length - 2);
      if (exch_seg === "MCX") {
        // here we can trim 5 characters from start - 24APR 86250
        wrdStr = wrdStr.substring(5); // output - 86250
      } else {
        // NFO
        wrdStr = wrdStr.substring(7);
      }
      for (let i = 1; i < wrdStr.length; i++) {
        const text = sanitizeText(wrdStr.substring(0, i + 1));
        if (!keywordExists(keywords, text)) {
          keywords.push(text);
        }
      }
      if (!keywordExists(keywords, wrdStr)) {
        keywords.push(wrdStr);
      }
      if (!keywordExists(keywords, val)) {
        keywords.push(val);
      }
    }
  }

  return {
    token,
    symbol,
    name,
    lotsize,
    instrumenttype,
    exch_seg,
    expiry,
    tick_size,
    expiry_timestamp: Timestamp.fromDate(dtEnd),
    keywords,
    priority,
  };
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
    const selectedInstruments = instruments
      .filter(({ exch_seg, expiry, symbol, instrumenttype }: any) => {
        if (
          !supportedSegments.includes(exch_seg) ||
          instrumenttype === "COMDTY"
        ) {
          // segment and actual comdty not needed
          return false;
        } else if (!expiry) {
          if (symbol.endsWith("-EQ")) {
            // store only equity
            return true;
          }
          return false;
        } else if (expiry) {
          // expiry value is there. now we need to load only next 2 months of data
          const expiryDate = new Date(expiry);
          // set time as day end
          expiryDate.setHours(23, 59, 59, 999);

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
          } else {
            // ignore this record as it's expiry date is more than 61 days away
            return false;
          }
        }
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
        }: Prop) =>
          getPayload({
            token,
            symbol,
            name,
            expiry,
            lotsize,
            instrumenttype,
            exch_seg,
            tick_size,
          })
      );
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
