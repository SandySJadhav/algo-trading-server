import { Filter } from "firebase-admin/firestore";
import Firebase from "./instance";

type SearchProps = {
  searchTerm: string;
};

const months: string[] = [
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

type Prop = {
  token: any;
  symbol: string;
  name: string;
  expiry: string;
  lotsize: any;
  instrumenttype: string;
  exch_seg: string;
  tick_size: any;
  rel_keywords: any;
  matches: any;
  displayName?: string;
};

const getFilteredResults = (results: Prop[], query: string[]) => {
  let maxMatched = 0;
  results.forEach((result: Prop) => {
    // count matching records
    let matches = 0;
    query.forEach((item: string) => {
      result.rel_keywords.forEach((keyword: string) => {
        if (keyword === item) {
          matches++;
        }
      });
    });
    if (matches > maxMatched) {
      maxMatched = matches;
    }
    result.matches = matches;
  });

  results.sort(function (a: Prop, b: Prop) {
    if (a.matches > b.matches) {
      return -1;
    } else if (a.matches < b.matches || a.symbol.endsWith("FUT")) {
      return 1;
    }
    return 0;
  });

  return results.filter((res: Prop) => res.matches > maxMatched - 1);
};

export const searchInFirestore = async (params: SearchProps) => {
  try {
    const { searchTerm } = params;
    const keywords = searchTerm.toUpperCase().trim();
    const allKeywords = keywords.split(" ");
    let allKeywordsWithoutName;
    let response;
    const instruments = Firebase.db.collection("instruments");

    if (allKeywords.length > 1) {
      allKeywordsWithoutName = keywords
        .substring(allKeywords[0].length + 1)
        .split(" ");

      response = await instruments
        .where("rel_keywords", "array-contains-any", allKeywordsWithoutName)
        .orderBy("name")
        .startAt(allKeywords[0])
        .endAt(allKeywords[0] + "\uf8ff")
        .limit(10)
        .get();
    } else {
      response = await instruments
        .where(
          Filter.or(
            Filter.where("symbol", "==", keywords),
            Filter.where("symbol", "==", keywords + "-" + "EQ")
          )
        )
        .limit(2)
        .get();
    }

    if (response.empty) {
      return {
        status: "SUCCESS",
        statusCode: 200,
        data: [],
      };
    }

    const results: Prop[] = [];
    response.forEach((res: any) => {
      const resData: Prop = res.data();
      const { symbol, exch_seg, name, instrumenttype, expiry } = resData;
      console.log(name + " : " + symbol);
      if (exch_seg !== "NSE") {
        const expiryDate = new Date(expiry);
        expiryDate.setHours(23, 59, 59, 999);
        let newSymbol: string = name;

        const month = months[expiryDate.getMonth()]; // month = JAN

        const expDate = expiry.split(month)[0]; // expDate = 31

        newSymbol +=
          " " + expDate + " " + month + " " + expiryDate.getFullYear();

        if (["FUTCOM", "FUTSTK", "FUTIDX"].includes(instrumenttype)) {
          newSymbol += " FUT";
        } else if (["OPTFUT", "OPTSTK", "OPTIDX"].includes(instrumenttype)) {
          let wrdStr = symbol.substring(name.length);
          const optionType: string = wrdStr.endsWith("CE") ? "CE" : "PE";
          wrdStr = wrdStr.substring(0, wrdStr.length - 2);
          if (instrumenttype === "OPTFUT") {
            // MCX option
            wrdStr = wrdStr.substring(5); // output = 7000
          } else {
            // NFO option
            wrdStr = wrdStr.substring(7); // output = 7000
          }
          newSymbol += " " + wrdStr + " " + optionType;
        }

        results.push({
          ...resData,
          displayName: newSymbol,
        });
      } else {
        results.push(resData);
      }
    });

    const data: Prop[] = getFilteredResults(results, allKeywords);

    return {
      status: "SUCCESS",
      statusCode: 200,
      data,
    };
  } catch (error) {
    console.log(error);
    let responseJSON;
    try {
      const jsonRes = JSON.parse(JSON.stringify(error));
      if (jsonRes.code === 8) {
        // daily quota exceeded in firestore;
        responseJSON = {
          status: "ERROR",
          statusCode: 503,
          message: "Service Unavailable",
          error: jsonRes,
        };
      } else {
        responseJSON = {
          status: "ERROR",
          statusCode: 500,
          message: "Internal Server Error",
          error: jsonRes,
        };
      }
    } catch (err) {
      responseJSON = {
        status: "ERROR",
        statusCode: 500,
        message: "Internal Server Error",
        error,
      };
    }
    return responseJSON;
  }
};
