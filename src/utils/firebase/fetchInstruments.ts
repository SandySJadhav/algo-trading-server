import { instrument_prop, strategy_prop } from "../types";
import Firebase from "./instance";

export const fetchInstrumentsToWatch = async () => {
  const strategies_colllection = Firebase.db.collection("strategies");
  const response = await strategies_colllection
    .where("status", "==", "active")
    .get();

  if (response.empty) {
    return [];
  }

  return new Promise(async (resolve, reject) => {
    const data: strategy_prop[] = [];
    const result: strategy_prop[] = [];
    const ids: string[] = [];

    response.forEach(async (res: any) => {
      const resData: strategy_prop = res.data();
      if (ids.indexOf(resData.instrument_to_watch.id) === -1) {
        ids.push(resData.instrument_to_watch.id);
      }
      data.push(resData);
    });

    const instruments_collection = Firebase.db.collection("instruments");
    const actual_instruments = await instruments_collection
      .where("token", "in", ids)
      .get();

    actual_instruments.forEach((instrument) => {
      const matchedData = data.find(
        (ms) => ms.instrument_to_watch.id === instrument.id
      );
      if (matchedData) {
        matchedData.instrument_to_watch = instrument.data();
        result.push(matchedData);
      }
    });

    resolve(result);
  });
};
