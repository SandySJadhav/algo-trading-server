import Firebase from './instance';
import { instrument_prop, ltp_prop, strategy_prop } from '../types';
import { getISTTime, getMomentPayload } from '../helpers';

type SearchProps = {
  searchTerm: string;
};

const months: string[] = [
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

const getFilteredResults = (results: instrument_prop[], query: string[]) => {
  let maxMatched = 0;
  results.forEach((result: instrument_prop) => {
    // count matching records
    let matches = 0;
    query.forEach((item: string) => {
      result.rel_keywords?.forEach((keyword: string) => {
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

  results.sort(function (a: instrument_prop, b: instrument_prop) {
    if (a.matches > b.matches) {
      return -1;
    } else if (a.matches < b.matches || a.symbol.endsWith('FUT')) {
      return 1;
    }
    return 0;
  });

  return results.filter((res: instrument_prop) => res.matches > maxMatched - 1);
};

export const searchInFirestore = async (params: SearchProps) => {
  try {
    const { searchTerm } = params;
    const keywords = searchTerm.toUpperCase().trim();
    const allKeywords = keywords.split(' ');
    const instruments_collection = Firebase.db.collection('instruments');
    let response;

    if (allKeywords.length > 1) {
      const allKeywordsWithoutName = keywords
        .substring(allKeywords[0].length + 1)
        .split(' ');
      response = await instruments_collection
        .where('rel_keywords', 'array-contains-any', allKeywordsWithoutName)
        .orderBy('name')
        .startAt(allKeywords[0])
        .endAt(allKeywords[0] + '\uf8ff')
        .limit(10)
        .get();
    } else {
      response = await instruments_collection
        .where('name_keywords', 'array-contains-any', allKeywords)
        .orderBy('name')
        .startAt(allKeywords[0])
        .endAt(allKeywords[0] + '\uf8ff')
        .limit(5)
        .get();
    }

    if (response.empty) {
      return {
        status: 'SUCCESS',
        statusCode: 200,
        data: []
      };
    }

    const results: instrument_prop[] = [];
    response.forEach((res: any) => {
      const resData: instrument_prop = res.data();
      const { symbol, exch_seg, name, instrumenttype, expiry } = resData;
      if (exch_seg !== 'NSE') {
        const payload = getMomentPayload(expiry);
        const expiryDate = getISTTime().set(payload);
        let newSymbol: string = name;
        const month = months[expiryDate.month()]; // month = JAN
        const expDate = expiry.split(month)[0]; // expDate = 31

        newSymbol += ' ' + expDate + ' ' + month + ' ' + expiryDate.year();

        if (['FUTCOM', 'FUTSTK', 'FUTIDX'].includes(instrumenttype)) {
          newSymbol += ' FUT';
        } else if (['OPTFUT', 'OPTSTK', 'OPTIDX'].includes(instrumenttype)) {
          let wrdStr = symbol.substring(name.length);
          const optionType: string = wrdStr.endsWith('CE') ? 'CE' : 'PE';
          wrdStr = wrdStr.substring(0, wrdStr.length - 2);
          if (instrumenttype === 'OPTFUT') {
            // MCX option
            wrdStr = wrdStr.substring(5); // output = 7000
          } else {
            // NFO option
            wrdStr = wrdStr.substring(7); // output = 7000
          }
          newSymbol += ' ' + wrdStr + ' ' + optionType;
        }

        results.push({
          ...resData,
          displayName: newSymbol
        });
      } else {
        results.push(resData);
      }
    });

    const data: instrument_prop[] = getFilteredResults(results, allKeywords);

    return {
      status: 'SUCCESS',
      statusCode: 200,
      data
    };
  } catch (error) {
    console.log(error);
    let responseJSON;
    try {
      const jsonRes = JSON.parse(JSON.stringify(error));
      if (jsonRes.code === 8) {
        // daily quota exceeded in firestore;
        responseJSON = {
          status: 'ERROR',
          statusCode: 503,
          message: 'Service Unavailable',
          error: jsonRes
        };
      } else {
        responseJSON = {
          status: 'ERROR',
          statusCode: 500,
          message: 'Internal Server Error',
          error: jsonRes
        };
      }
    } catch (err) {
      responseJSON = {
        status: 'ERROR',
        statusCode: 500,
        message: 'Internal Server Error',
        error
      };
    }
    return responseJSON;
  }
};

const getStrike = (price: number) => {
  const priceLength = price.toString().length;
  if (priceLength === 2 || priceLength === 3) {
    return parseInt((price / 10).toString()) * 10;
  } else if (priceLength === 4 || priceLength === 5) {
    return parseInt((price / 100).toString()) * 100;
  } else if (priceLength === 6 || priceLength === 7) {
    return parseInt((price / 1000).toString()) * 1000;
  } else if (priceLength === 8 || priceLength === 9) {
    return parseInt((price / 10000).toString()) * 10000;
  } else {
    return price;
  }
};

export const getSearchTerm = (
  { instrument_to_watch }: strategy_prop,
  item: ltp_prop
) => {
  return (
    instrument_to_watch.name + ' ' + getStrike(Number(item.last_traded_price))
  );
};
