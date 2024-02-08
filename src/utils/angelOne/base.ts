import address from 'address';
import WebSocket from 'ws';
import Cron from 'croner';
import API from './api';
import { ACTION, CONSTANTS, EXCHANGES, MODE } from './constants';
import { postRequest } from '../http.interceptor';
import { fetchAllActiveStrategies } from '../firebase/strategies';
import { Parser } from 'binary-parser';
import { instrument_prop, ltp_prop, strategy_prop } from '../types';
import { _atos, commonPrint, getISTTime, toNumber } from '../helpers';
import generateTOTP from '../totp/base';
import { placeOrder } from './order';
import { getSearchTerm, searchInFirestore } from '../firebase/search';

const formatNumberInTime = (num: number): string => {
  return num > 9 ? num.toString() : '0' + num;
};

class Angel {
  LOGIN_RETRY = 3;
  HEARTBEAT_CRON: any;
  LIVE_CRON: any;
  STRATEGIES_CRONER: any;
  WS: any;
  WS_WATCH_LIST_PAYLOADS: string[] = [];
  FEEDTOKEN = '';
  REFRESHTOKEN = '';
  JWTTOKEN = '';
  USERID = '';
  PWD = '';
  ACTIVE_STRATEGIES: strategy_prop[] = [];
  TOTP = '';
  headers = {
    'X-ClientLocalIP': '',
    'X-MACAddress': '',
    'Content-Type': '',
    Accept: '',
    'X-UserType': '',
    'X-SourceID': '',
    'X-PrivateKey': process.env.ANGEL_API_KEY,
    'X-ClientPublicIP': '',
    Authorization: ''
  };

  constructor() {
    this.USERID = process.env.ANGEL_USERID + '';
    this.PWD = process.env.ANGEL_PWD + '';
    this.WS_WATCH_LIST_PAYLOADS = [];
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-PrivateKey': process.env.ANGEL_API_KEY,
      'X-ClientLocalIP': '',
      'X-ClientPublicIP': '',
      'X-MACAddress': '',
      Authorization: ''
    };

    address((err, addrs) => {
      if (err) {
        console.log('🔥 Failed to get address...', err);
      }
      this.headers['X-ClientLocalIP'] =
        addrs !== undefined ? addrs.ip + '' : '192.168.168.168';
      this.headers['X-MACAddress'] =
        addrs !== undefined ? addrs.mac + '' : 'fe80::216e:6507:4b90:3719';
      // initiate login process
      this.login();
    });
  }

  cleanup() {
    this.LOGIN_RETRY = 3;
    if (this.STRATEGIES_CRONER) {
      this.STRATEGIES_CRONER.stop();
      this.STRATEGIES_CRONER = null;
    }
    this.WS_WATCH_LIST_PAYLOADS = [];
    this.FEEDTOKEN = '';
    this.REFRESHTOKEN = '';
    this.JWTTOKEN = '';
    this.USERID = '';
    this.PWD = '';
    this.ACTIVE_STRATEGIES = [];
    this.TOTP = '';
    this.headers = {
      'X-ClientLocalIP': '',
      'X-MACAddress': '',
      'Content-Type': '',
      Accept: '',
      'X-UserType': '',
      'X-SourceID': '',
      'X-PrivateKey': '',
      'X-ClientPublicIP': '',
      Authorization: ''
    };
    console.log('🚀 Cleanup done ', commonPrint());
  }

  /**
   * Strategy timing checker and loader
   */
  async loadStrategies() {
    // get all strategies from firestore
    const ALL_STRATEGIES = await fetchAllActiveStrategies();

    ALL_STRATEGIES.forEach((strategy: strategy_prop) => {
      const strategy_already_running = this.ACTIVE_STRATEGIES.findIndex(
        (active_strategy) => active_strategy.id === strategy.id
      );
      if (strategy_already_running === -1) {
        // we need to find perfect option instrument to buy and cell
        // strategy.call_instrument_to_trade =
        this.ACTIVE_STRATEGIES.push(strategy);
      }
    });
    if (this.ACTIVE_STRATEGIES.length === 0) {
      console.log('🚀 No any active strategies found 🏄!');
      return;
    }
    // fetch candle history for above strategies
    const activeCandles = await this.getAllInstrumentCandleHistory();
    if (!activeCandles) {
      console.log('🚀 All markets are closed now 🏄!');
      return;
    }
    // initiate new live feed
    this.initiateLiveFeed();
  }

  async initiateLiveFeed() {
    console.log('🚀 Initiate live feed ', commonPrint());
    // TODO - supported only mcx instruments for now
    const allMCXInstruments: string[] = [];

    this.ACTIVE_STRATEGIES.forEach((strategy: any) => {
      if (strategy.instrument_to_watch.exch_seg === 'MCX') {
        allMCXInstruments.push(strategy.instrument_to_watch.token);
      }
    });

    const payload: {
      action: number;
      params: {
        mode: number;
        tokenList: any[];
      };
    } = {
      action: ACTION.Subscribe,
      params: {
        mode: MODE.LTP,
        tokenList: []
      }
    };

    if (allMCXInstruments.length > 0) {
      payload.params.tokenList.push({
        exchangeType: EXCHANGES.mcx_fo,
        tokens: allMCXInstruments
      });
    }

    if (payload.params.tokenList.length > 0) {
      this.WS_WATCH_LIST_PAYLOADS.push(JSON.stringify(payload));
      this.connect_websocket();
    }
  }

  async getAllInstrumentCandleHistory() {
    let checker = 0;
    const responses: any = [];
    const newDate = getISTTime();
    const day = newDate.date();
    const month = newDate.month();
    const year = newDate.year();

    this.ACTIVE_STRATEGIES.forEach(
      ({
        instrument_to_watch,
        candle_timeframe: interval,
        start_entry_after
      }: strategy_prop) => {
        const fromdate = `${year}-${formatNumberInTime(
          month + 1
        )}-${formatNumberInTime(day)} ${
          formatNumberInTime(start_entry_after - 1) +
          ':' +
          formatNumberInTime(0)
        }`;

        const todate = `${year}-${formatNumberInTime(
          month + 1
        )}-${formatNumberInTime(day)} ${formatNumberInTime(
          start_entry_after - 1
        )}:${formatNumberInTime(59)}`;

        responses.push(
          postRequest(
            API.root + API.candle_data,
            {
              exchange: instrument_to_watch.exch_seg,
              symboltoken: instrument_to_watch.token,
              interval,
              fromdate,
              todate
            },
            this.headers
          )
        );
      }
    );

    const data = await Promise.all(responses);

    data.forEach((item, i) => {
      if (item.status) {
        checker++;
        this.ACTIVE_STRATEGIES[i].market_status = 'OPEN';
        this.ACTIVE_STRATEGIES[i].data = item.data;
      } else if (item.errorcode === 'AB1004') {
        this.ACTIVE_STRATEGIES[i].market_status = 'CLOSED';
      } else {
        console.log(
          '🔥 Failed to fetch candlestick data ',
          commonPrint(),
          item
        );
        this.ACTIVE_STRATEGIES[i].market_status = 'CLOSED';
      }
    });

    return checker;
  }

  async login() {
    console.log('🚀 Angel Login in progress ', commonPrint());
    const response = await postRequest(
      API.root + API.user_login,
      {
        clientcode: this.USERID,
        password: this.PWD,
        totp: generateTOTP()
      },
      this.headers
    );
    if (response.status) {
      this.REFRESHTOKEN = response.data.refreshToken;
      this.JWTTOKEN = response.data.jwtToken;
      this.FEEDTOKEN = response.data.feedToken;
      this.headers.Authorization = `Bearer ${this.JWTTOKEN}`;
      console.log('🚀 Angel Login Success 🥳 ', commonPrint());
      this.initiateStrategyLoaderCroner();
    } else {
      this.REFRESHTOKEN = '';
      this.JWTTOKEN = '';
      this.FEEDTOKEN = '';
      this.headers.Authorization = '';
      console.log(
        '🔥 Angel Login failed message: ',
        response.message,
        commonPrint()
      );
      setTimeout(() => {
        if (this.LOGIN_RETRY) {
          console.log('🚀 Retry login ', commonPrint());
          this.login();
          this.LOGIN_RETRY--;
        } else {
          console.log('🔥 Login retry limit reached. ', commonPrint());
        }
      }, 5000);
    }
  }

  initiateStrategyLoaderCroner() {
    console.log('🚀 Initializing strategy loader croner ', commonPrint());
    // Runs at every 15th minute past every hour from 9-23 on every day-of-week from Monday-Friday
    let strategyScheduledTimer = '*/15 9-23 * * 1-5';
    let strategyCronerMaxRuns;
    if (process.env.ENVIRONMENT === 'dev') {
      strategyCronerMaxRuns = 1;
      strategyScheduledTimer = '* * * * * *';
    }
    this.STRATEGIES_CRONER = Cron(
      strategyScheduledTimer,
      { maxRuns: strategyCronerMaxRuns },
      async () => {
        console.log(
          '🚀 Strategy loader 15 minute croner execution Success 🥳 ',
          commonPrint()
        );
        // close old connections
        this.WS?.close?.();
        // trigger new strategy
        this.loadStrategies();
      }
    );
    if (process.env.ENVIRONMENT !== 'dev') {
      const newDate = getISTTime();
      if (newDate.hour() > 9 && newDate.hour() < 23) {
        this.STRATEGIES_CRONER.trigger();
      }
    }
  }

  async connect_websocket() {
    this.WS = new WebSocket(CONSTANTS.websocketURL, {
      headers: {
        Authorization: this.headers.Authorization,
        'x-api-key': process.env.ANGEL_MARKET_FEED_API_KEY,
        'x-client-code': process.env.ANGEL_USERID,
        'x-feed-token': this.FEEDTOKEN
      }
    });

    this.WS.on('close', () => {
      if (this.HEARTBEAT_CRON) {
        this.HEARTBEAT_CRON.stop();
        this.HEARTBEAT_CRON = null;
      }
      this.WS = null;
      console.log('🔥 Websocket connection closed!');
    });

    this.WS.on('error', (err: any) => {
      if (this.HEARTBEAT_CRON) {
        this.HEARTBEAT_CRON.stop();
        this.HEARTBEAT_CRON = null;
      }
      this.WS = null;
      console.log('🔥 Websocket connection error ', err);
    });

    this.WS.on('open', () => {
      this.HEARTBEAT_CRON = Cron('*/25 * * * * *', () => {
        this.WS.send('ping');
      });
      if (this.WS_WATCH_LIST_PAYLOADS.length > 0) {
        this.WS_WATCH_LIST_PAYLOADS.forEach((payload) => {
          this.WS.send(payload);
        });
        this.WS_WATCH_LIST_PAYLOADS = [];
      }
      console.log('🚀 Websockets is ❤️ ', commonPrint());
    });

    this.WS.on('message', async (data: any) => {
      const subscription_mode = new Parser().uint8('subscription_mode');

      if (subscription_mode.parse(data)?.subscription_mode === MODE.LTP) {
        const res = await this.getLTP(data);
        res.token = JSON.parse(res.token);
        const ltp = Number(res.last_traded_price);
        this.ACTIVE_STRATEGIES.forEach((strategy: any, index) => {
          if (strategy.instrument_to_watch.token === res.token) {
            const tick_size = Number(
              this.ACTIVE_STRATEGIES[index].instrument_to_watch.tick_size
            );
            if (tick_size > 1) {
              res.last_traded_price = ltp / tick_size;
            } else {
              res.last_traded_price = ltp;
            }
            this.handleExecution(res, index);
          }
        });
      } else if (data.toString() !== 'pong') {
        console.log('🔥 Untracked message -> ', data.toString(), commonPrint());
      }
    });
  }

  async getLTP(data: any) {
    const ltp = new Parser()
      .endianness('little')
      .int8('subscription_mode', { formatter: toNumber })
      .int8('exchange_type', { formatter: toNumber })
      .array('token', {
        type: 'uint8',
        length: 25,
        formatter: _atos
      })
      .int64('sequence_number', { formatter: toNumber })
      .int64('exchange_timestamp', { formatter: toNumber })
      .int32('last_traded_price', { formatter: toNumber });

    return ltp.parse(data);
  }

  async updateCALLPUTStrikes(searchTerm: string, matched_index: number) {
    const response = await searchInFirestore({ searchTerm });
    if (response.statusCode === 200 && response.data?.length === 2) {
      const call_instrument_to_trade = <instrument_prop>(
        response.data.find((item: instrument_prop) =>
          item.rel_keywords?.includes('CE')
        )
      );
      if (call_instrument_to_trade) {
        this.ACTIVE_STRATEGIES[matched_index].call_instrument_to_trade =
          call_instrument_to_trade;
      }
      const put_instrument_to_trade = <instrument_prop>(
        response.data.find((item: instrument_prop) =>
          item.rel_keywords?.includes('PE')
        )
      );
      if (put_instrument_to_trade) {
        this.ACTIVE_STRATEGIES[matched_index].put_instrument_to_trade =
          put_instrument_to_trade;
      }
      if (
        this.ACTIVE_STRATEGIES[matched_index].call_instrument_to_trade &&
        this.ACTIVE_STRATEGIES[matched_index].put_instrument_to_trade
      ) {
        console.log(
          `🚀 Call instrument matched -> ${this.ACTIVE_STRATEGIES[matched_index].call_instrument_to_trade?.displayName}`,
          commonPrint()
        );
        console.log(
          `🚀 Put instrument matched -> ${this.ACTIVE_STRATEGIES[matched_index].put_instrument_to_trade?.displayName}`,
          commonPrint()
        );
        this.ACTIVE_STRATEGIES[matched_index].order_status = 'IDLE';
      }
    } else {
      console.log(
        `🔥 Strike price selection API failed for ${searchTerm}`,
        response,
        commonPrint()
      );
    }
  }

  restOrderStatus(order_status: string, id: string) {
    if (order_status === 'FAILED') {
      console.log(`🚀 Orders failed for strategy ${id} `, commonPrint());
      return;
    } else if (order_status === 'COMPLETED') {
      return;
    } else if (order_status === 'STRIKE_SELECTION') {
      console.log(`🔥 Order stuck in strike price selection -> ${id}`);
      return;
    } else {
      console.log(
        `🚀 Strategy: ${id}, Operation in progress -> ${order_status} `,
        commonPrint()
      );
      return;
    }
  }

  handleExecution(item: ltp_prop, matched_index: number) {
    const matched_strategy = this.ACTIVE_STRATEGIES[matched_index];
    const {
      id,
      order_status,
      call_instrument_to_trade,
      put_instrument_to_trade,
      entries_taken_today,
      max_entries_per_day,
      previous_candle,
      instrument_to_watch
    } = matched_strategy;

    if (order_status === 'PLACED') {
      // placed order, waiting for exit trigger
      this.handleExitStrategy(item, matched_index);
      return;
    } else if (order_status !== 'IDLE') {
      this.restOrderStatus(order_status, id);
      return;
    } else if (!call_instrument_to_trade || !put_instrument_to_trade) {
      console.log('🚀 Searching for call & put instruments ', commonPrint());
      this.ACTIVE_STRATEGIES[matched_index].order_status = 'STRIKE_SELECTION';
      const matchedSearchTerm = getSearchTerm(matched_strategy, item);
      this.updateCALLPUTStrikes(matchedSearchTerm, matched_index);
      return;
    } else if (entries_taken_today < max_entries_per_day) {
      if (
        previous_candle === 'CROSSES' &&
        instrument_to_watch.exch_seg === 'MCX'
      ) {
        this.handleCrossing(item, matched_index);
      } else {
        this.ACTIVE_STRATEGIES.splice(matched_index, 1);
        console.log(
          '🔥 Handle for this type of execution is not written!!! ',
          commonPrint()
        );
      }
    }
  }

  async exitOrder(matched_index: number) {
    const matched_strategy = this.ACTIVE_STRATEGIES[matched_index];
    const type = matched_strategy.trade_type;

    const instrument_to_trade =
      type === 'CE'
        ? matched_strategy.call_instrument_to_trade
        : matched_strategy.put_instrument_to_trade;

    if (type === 'CE') {
      this.ACTIVE_STRATEGIES[matched_index].profit_points =
        matched_strategy.exit_price - matched_strategy.entry_price - 2;
    } else {
      this.ACTIVE_STRATEGIES[matched_index].profit_points =
        matched_strategy.entry_price - matched_strategy.exit_price - 2;
    }
    this.ACTIVE_STRATEGIES[matched_index].order_status = 'COMPLETED';

    const order = await placeOrder(
      {
        duration: 'DAY',
        exchange: instrument_to_trade?.exch_seg + '',
        ordertype: 'MARKET',
        producttype: 'CARRYFORWARD',
        quantity: instrument_to_trade?.lotsize,
        variety: 'NORMAL',
        transactiontype: 'SELL',
        symboltoken: instrument_to_trade?.token,
        tradingsymbol: instrument_to_trade?.symbol + ''
      },
      this.headers,
      this.ACTIVE_STRATEGIES[matched_index]
    );
    this.ACTIVE_STRATEGIES.splice(matched_index, 1);
    if (order.status) {
      console.log(
        `🚀 Trade completed for ${matched_strategy.id}`,
        commonPrint()
      );
      // unsubscribe from websocket listenings
      const payload: {
        action: number;
        params: {
          mode: number;
          tokenList: any[];
        };
      } = {
        action: ACTION.Unsubscribe,
        params: {
          mode: MODE.LTP,
          tokenList: [
            {
              exchangeType: EXCHANGES.mcx_fo,
              tokens: [instrument_to_trade?.token]
            }
          ]
        }
      };
      this.WS.send(JSON.stringify(payload));
    } else {
      console.log(`🔥 failed to exit strategy ${matched_strategy.id}`);
    }
  }

  async handleExitStrategy(item: ltp_prop, matched_index: number) {
    const newDate = getISTTime();
    const hours = newDate.hour();
    const minutes = newDate.minute();
    const matched_strategy = this.ACTIVE_STRATEGIES[matched_index];
    const type = matched_strategy.trade_type;
    const ltp = Number(item.last_traded_price);

    if (
      Number(hours + '.' + minutes) > matched_strategy.stop_entry_after ||
      (type === 'CE' && ltp < matched_strategy.trailed_sl) ||
      (type === 'PE' && ltp > matched_strategy.trailed_sl)
    ) {
      this.ACTIVE_STRATEGIES[matched_index].exit_price = ltp;
      // check stoploss
      console.log(`🚀 SL hit for ${matched_strategy.id}`, commonPrint());
      this.exitOrder(matched_index);
    } else {
      // check for target, increase the sl
      if (
        type === 'CE' &&
        ltp >=
          matched_strategy.entry_price + matched_strategy.trailing_sl_points &&
        ltp > matched_strategy.trailed_sl + matched_strategy.trailing_sl_points
      ) {
        this.ACTIVE_STRATEGIES[matched_index].trailed_sl =
          ltp - matched_strategy.trailing_sl_points;
      } else if (
        type === 'PE' &&
        ltp <=
          matched_strategy.entry_price - matched_strategy.trailing_sl_points &&
        ltp < matched_strategy.trailed_sl - matched_strategy.trailing_sl_points
      ) {
        this.ACTIVE_STRATEGIES[matched_index].trailed_sl =
          ltp + matched_strategy.trailing_sl_points;
      }
      console.log(`🚀 Trailing sl for ${matched_strategy.id}`, commonPrint());
    }
  }

  async placeMarketOrder(type: 'CE' | 'PE', matched_index: number) {
    this.ACTIVE_STRATEGIES[matched_index].entries_taken_today++;
    this.ACTIVE_STRATEGIES[matched_index].order_status = 'PENDING';
    this.ACTIVE_STRATEGIES[matched_index].trade_type = type;

    console.log(
      `🚀 ${type} Order placement criteria met for strategy ${this.ACTIVE_STRATEGIES[matched_index].id}`,
      commonPrint()
    );
    const instrument_to_trade =
      type === 'CE'
        ? this.ACTIVE_STRATEGIES[matched_index].call_instrument_to_trade
        : this.ACTIVE_STRATEGIES[matched_index].put_instrument_to_trade;

    this.ACTIVE_STRATEGIES[matched_index].order_status = 'PLACED';

    const order = await placeOrder(
      {
        duration: 'DAY',
        exchange: instrument_to_trade?.exch_seg + '',
        ordertype: 'MARKET',
        producttype: 'CARRYFORWARD',
        quantity: instrument_to_trade?.lotsize,
        variety: 'NORMAL',
        transactiontype: 'BUY',
        symboltoken: instrument_to_trade?.token,
        tradingsymbol: instrument_to_trade?.symbol + ''
      },
      this.headers,
      this.ACTIVE_STRATEGIES[matched_index]
    );
    if (order.status) {
      if (type === 'CE') {
        delete this.ACTIVE_STRATEGIES[matched_index].put_instrument_to_trade;
      } else {
        delete this.ACTIVE_STRATEGIES[matched_index].call_instrument_to_trade;
      }
    } else {
      this.ACTIVE_STRATEGIES[matched_index].order_status = 'FAILED';
    }
  }

  async handleCrossing(item: ltp_prop, matched_index: number) {
    const newDate = getISTTime();
    const hours = newDate.hour();
    const minutes = newDate.minute();
    const ltp = Number(item.last_traded_price);
    // pattern here for data field -  [timestamp, open, high, low, close, volume]
    const matched_strategy = this.ACTIVE_STRATEGIES[matched_index];
    if (
      Number(hours + '.' + minutes) >= matched_strategy.start_entry_after &&
      Number(hours + '.' + minutes) <= matched_strategy.stop_entry_after
    ) {
      this.ACTIVE_STRATEGIES[matched_index].previous_candle_high =
        this.getPreviousCandleHigh(matched_strategy.data);
      this.ACTIVE_STRATEGIES[matched_index].previous_candle_low =
        this.getPreviousCandleLow(matched_strategy.data);
      // we can take entry here
      console.log(
        `🚀 Waiting for entry -> LTP: ${ltp}, >= ${
          this.ACTIVE_STRATEGIES[matched_index].previous_candle_high +
          matched_strategy.buffer_points
        } or <= ${
          this.ACTIVE_STRATEGIES[matched_index].previous_candle_low -
          matched_strategy.buffer_points
        }`,
        commonPrint()
      );
      if (
        ltp >=
        this.ACTIVE_STRATEGIES[matched_index].previous_candle_high +
          matched_strategy.buffer_points
      ) {
        this.ACTIVE_STRATEGIES[matched_index].trailed_sl =
          this.ACTIVE_STRATEGIES[matched_index].previous_candle_low - 5;
        this.ACTIVE_STRATEGIES[matched_index].entry_price = ltp;
        this.placeMarketOrder('CE', matched_index);
      } else if (
        ltp <=
        this.ACTIVE_STRATEGIES[matched_index].previous_candle_low -
          matched_strategy.buffer_points
      ) {
        this.ACTIVE_STRATEGIES[matched_index].trailed_sl =
          this.ACTIVE_STRATEGIES[matched_index].previous_candle_high + 5;
        this.ACTIVE_STRATEGIES[matched_index].entry_price = ltp;
        this.placeMarketOrder('PE', matched_index);
      }
    } else {
      console.log(
        `🚀 Timeline not matching for strategy ${matched_strategy.id}, so removing it from active strategies`,
        commonPrint()
      );
      this.ACTIVE_STRATEGIES.splice(matched_index, 1);
    }
  }

  getPreviousCandleHigh(data: any) {
    let high = 0;
    data.forEach((item: any[]) => {
      if (item[2] > high) {
        high = item[2];
      }
    });
    return high;
  }

  getPreviousCandleLow(data: any) {
    let low = 999999;
    data.forEach((item: any[]) => {
      if (item[3] < low) {
        low = item[3];
      }
    });
    return low;
  }
}

export default Angel;
