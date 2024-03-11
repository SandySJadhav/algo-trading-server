import { updateOrderStatus } from '../firebase/strategies';
import { commonPrint } from '../helpers';
import { postRequest } from '../http.interceptor';
import { strategy_prop } from '../types';
import API from './api';

type Order = {
  variety: 'NORMAL'; // | "STOPLOSS" | "AMO" | "ROBO";
  transactiontype: 'BUY' | 'SELL';
  ordertype: 'MARKET'; // | "LIMIT" | "STOPLOSS_LIMIT" | "STOPLOSS_MARKET";
  producttype: 'CARRYFORWARD' | 'INTRADAY'; // "DELIVERY" | "CARRYFORWARD" | "MARGIN" | "INTRADAY" | "BO";
  duration: 'DAY'; // | "IOC";
  exchange: string; //"BSE" | "NFO" | "NSE" | "BFO" | "CDS";
  tradingsymbol: string;
  symboltoken: string;
  quantity: string;
  // price: string (for LIMIT orders)
  // triggerprice: string (SL, SL-M)
  // squareoff: string 	Only For ROBO (Bracket Order)
  // stoploss: string 	Only For ROBO (Bracket Order)
  // trailingStopLoss: string 	Only For ROBO (Bracket Order)
  // disclosedquantity	Quantity to disclose publicly (for equity trades)
  // ordertag: string // It is optional to apply to an order to identify.
};

type OrderResponse = {
  data: any;
  errorcode: string | null;
  message: string | null;
  status: boolean;
};

export const placeOrder = async (
  params: Order,
  headers: any,
  matched_strategy: strategy_prop
) => {
  const response: OrderResponse = await postRequest(
    API.root + API.order_place,
    params,
    headers
  );
  let data: any = {
    ...params,
    strategy_id: matched_strategy.id,
    time: commonPrint()
  };
  if (response.status) {
    data = {
      ...data,
      ...response.data
    };
    updateOrderStatus(matched_strategy, data);
  } else {
    data.errorcode = response.errorcode;
    updateOrderStatus(
      {
        ...matched_strategy,
        order_status: 'FAILED'
      },
      data
    );
  }
  console.log(data);
  return response;
};
