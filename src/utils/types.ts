export interface instrument_prop {
  token: any;
  symbol: string;
  name: string;
  expiry: string;
  lotsize: any;
  instrumenttype: string;
  exch_seg: string;
  tick_size: any;
  rel_keywords?: any;
  matches?: any;
  displayName?: string;
}

export interface strategy_prop {
  buffer_points: number;
  candle_timeframe: string;
  end_time: string;
  entry_start_after: string;
  instrument_to_trade: any;
  instrument_to_watch: any;
  max_entries_per_day: number;
  previous_candle: string;
  status: string;
  stop_entry_after: string;
  trailing_sl: number;
}
