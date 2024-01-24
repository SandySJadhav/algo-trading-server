export interface instrument_prop {
  id?: string;
  token: any;
  symbol: string;
  name: string;
  expiry: string;
  lotsize: any;
  instrumenttype:
    | "OPTFUT"
    | "FUTCOM"
    | "OPTSTK"
    | "OPTIDX"
    | "FUTSTK"
    | "FUTIDX";
  exch_seg: string;
  tick_size: any;
  rel_keywords?: any;
  matches?: any;
  displayName?: string;
}

export interface strategy_prop {
  id: string;
  buffer_points: number;
  candle_timeframe: "ONE_HOUR";
  start_entry_after: number;
  stop_entry_after: number;
  max_entries_per_day: number;
  entries_taken_today: number;
  previous_candle: "CROSSES";
  status: string;
  instrument_to_watch: instrument_prop;
  trailing_sl_points: number;
  data: any;
  market_status?: "OPEN" | "CLOSED";
  order_status?:
    | "IDLE"
    | "OPEN"
    | "PLACED"
    | "PENDING"
    | "COMPLETED"
    | "CANCELLED";
  call_instrument_to_trade: instrument_prop;
  put_instrument_to_trade: instrument_prop;
  strike_selection_in_progress?: boolean;
  order_in_progress?: boolean;
}

export interface ltp_prop {
  exchange_timestamp: string;
  exchange_type: string;
  last_traded_price: string | number;
  sequence_number: string;
  subscription_mode: string;
  token: string;
}
