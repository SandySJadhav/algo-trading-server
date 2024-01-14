type Order = {
  duration: "DAY" | "IOC";
  transactiontype: "BUY" | "SELL";
  variety: "NORMAL" | "STOPLOSS" | "AMO" | "ROBO";
  exchange: "BSE" | "NSE" | "NFO" | "MCX" | "BFO" | "CDS";
  ordertype: "MARKET" | "LIMIT" | "STOPLOSS_LIMIT" | "STOPLOSS_MARKET";
  producttype: "DELIVERY" | "CARRYFORWARD" | "MARGIN" | "INTRADAY" | "BO";
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

export const placeOrder = () => {};
