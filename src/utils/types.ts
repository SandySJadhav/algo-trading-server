export interface instrument_prop {
  id?: string;
  token: any;
  symbol: string;
  name: string;
  expiry: string;
  lotsize: any;
  instrumenttype:
    | 'OPTFUT'
    | 'FUTCOM'
    | 'OPTSTK'
    | 'OPTIDX'
    | 'FUTSTK'
    | 'FUTIDX';
  exch_seg: string;
  tick_size: any;
  rel_keywords?: string[];
  matches?: any;
  display_name?: string;
  strike?: number;
  option_type?: string;
}

export interface strategy_prop {
  id: string;
  buffer_points: number;
  candle_timeframe: 'ONE_HOUR';
  start_entry_after: number;
  stop_entry_after: number;
  max_entries_per_day: number;
  entries_taken_today: number;
  previous_candle: 'CROSSES';
  status: string;
  instrument_to_watch: instrument_prop;
  trailing_sl_points: number;
  market_status?: 'OPEN' | 'CLOSED';
  order_status:
    | 'IDLE'
    | 'STRIKE_SELECTION'
    | 'PLACED'
    | 'PENDING'
    | 'COMPLETED'
    | 'FAILED'
    | 'RESET';
  call_instrument_to_trade?: instrument_prop;
  put_instrument_to_trade?: instrument_prop;
  lots: number;
  entry_countdown_in_seconds: number;

  // these are local variables, no need to sync with firestore
  data: any;
  entry_price: number;
  exit_price: number;
  profit_points: number;
  trailed_sl: number;
  trade_type: 'CE' | 'PE';
  target: number;
  target_difference_points: number;
  achieved_target: number;
  averaging_trade: boolean;

  // entry countdowns
  call_entry_countdown_status: 'IDLE' | 'INPROGRESS' | 'COMPLETE';
  put_entry_countdown_status: 'IDLE' | 'INPROGRESS' | 'COMPLETE';
}

export interface ltp_prop {
  exchange_timestamp: string;
  exchange_type: string;
  last_traded_price: string | number;
  sequence_number: string;
  subscription_mode: string;
  token: string;
}
