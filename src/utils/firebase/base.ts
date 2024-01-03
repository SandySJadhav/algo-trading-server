import Cron from "croner";
import Firebase from "./instance";
import fetch from "node-fetch";
import { Timestamp } from "firebase-admin/firestore";

const supportedSegments = ["NSE", "NFO", "MCX"];

const fetchAllInstruments = async () => {
    let data: string = "";
    let response: any = {};
    console.log("Downloading all instrument data From Angel One...");
    await new Promise((resolve: any) => {
        fetch('https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json')
            .then(response => response.body)
            .then(res => res.on('readable', () => {
                let chunk;
                while (null !== (chunk = res.read())) {
                    data += chunk.toString();
                }
            }).on('end', () => {
                if (!response.hasError) {
                    console.log("Downloaded all instrument data From Angel One");
                    response.instruments = JSON.parse(data);
                    resolve("SUCCESS");
                }
            }))
            .catch(err => {
                response.hasError = true;
                console.log("Downloaded all instrument data From Angel One ended with error", err);
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

const processInstruments = async (instruments: any, collection: any, isDelete: any = false) => {
    const chunkSize = 500;
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
    console.log(isDelete ? "Deleted all records from Firestore" : "Pushed all records to Firestore");
};

const processDataToFirebase = async (instruments: any) => {
    const collection = await Firebase.db.collection("instruments");
    // delete existing data from firestore if already expired
    const docs = await collection.where(
        "expiry_timestamp",
        "<",
        Timestamp.fromDate(new Date())
    ).get();
    const deleteInstrumentList: any[] = [];
    docs.forEach((doc: any) => {
        deleteInstrumentList.push(doc.ref);
    });
    if (deleteInstrumentList.length > 0) {
        // proceed to delete instruments from database;
        await processInstruments(deleteInstrumentList, collection, true);
        // now create new payload to upload new data
        const selectedInstruments = instruments
            .filter((instrument: any) => supportedSegments.includes(instrument.exch_seg))
            .map(({
                token,
                symbol,
                name,
                expiry,
                lotsize,
                instrumenttype,
                exch_seg,
                tick_size
            }: any) => ({
                token,
                symbol,
                name,
                lotsize,
                instrumenttype,
                exch_seg,
                expiry,
                tick_size,
                expiry_timestamp: Timestamp.fromDate(new Date(expiry || '12DEC9999'))
            }));
        if (selectedInstruments?.length > 0) {
            console.log("Pushing NSE, NFO & MCX records to Firestore ---> Count: ", selectedInstruments.length);
            await processInstruments(selectedInstruments, collection, false);
        } else {
            console.log("No records to delete. Everything already up to date");
        }
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
    if (process.env.environment === 'dev') {
        maxRuns = 1;
        scheduledTimer = "* * * * * *";
    }
    // for dev mode, run cron job im
    Cron(scheduledTimer, { maxRuns }, async () => {
        // run cron job at 11.30PM in night

        const response = await fetchAllInstruments();
        if (!response.hasError) {
            // store this data in Firebase database
            processDataToFirebase(response.instruments);
        } else {
            console.log("Cancelling data processing because of currupt data");
        }
    });
};
