import address from "address";
import WebSocket from "ws";
import Cron from "croner";
import API from "./api";
import { ACTION, CONSTANTS, EXCHANGES, MODE } from "./constants";
import { postRequest } from "../http.interceptor";
import { fetchAllActiveStrategies } from "../firebase/strategies";
import { Parser } from "binary-parser";
import { instrument_prop, ltp_prop, strategy_prop } from "../types";
import { _atos, toNumber } from "../helpers";
import generateTOTP from "../totp/base";
import { placeOrder } from "./order";
import { getSearchTerm, searchInFirestore } from "../firebase/search";

const formatNumberInTime = (num: number): string => {
  return num > 9 ? num.toString() : "0" + num;
};

class Angel {
  LOGIN_RETRY = 3;
  HEARTBEAT_CRON: any;
  LIVE_CRON: any;
  STRATEGIES_CRONER: any;
  WS: any;
  WS_WATCH_LIST_PAYLOADS: string[] = [];
  FEEDTOKEN = "";
  REFRESHTOKEN = "";
  JWTTOKEN = "";
  USERID = "";
  PWD = "";
  ACTIVE_STRATEGIES: strategy_prop[] = [];
  TOTP = "";
  headers = {
    "X-ClientLocalIP": "",
    "X-MACAddress": "",
    "Content-Type": "",
    Accept: "",
    "X-UserType": "",
    "X-SourceID": "",
    "X-PrivateKey": process.env.ANGEL_API_KEY,
    "X-ClientPublicIP": "",
    Authorization: "",
  };

  constructor() {
    this.USERID = process.env.ANGEL_USERID + "";
    this.PWD = process.env.ANGEL_PWD + "";
    this.WS_WATCH_LIST_PAYLOADS = [];
    this.headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-PrivateKey": process.env.ANGEL_API_KEY,
      "X-ClientLocalIP": "",
      "X-ClientPublicIP": "",
      "X-MACAddress": "",
      Authorization: "",
    };

    address((err, addrs) => {
      if (err) {
        console.log("🔥 Failed to get address...", err);
      }
      this.headers["X-ClientLocalIP"] =
        addrs !== undefined ? addrs.ip + "" : "192.168.168.168";
      this.headers["X-MACAddress"] =
        addrs !== undefined ? addrs.mac + "" : "fe80::216e:6507:4b90:3719";
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
    this.FEEDTOKEN = "";
    this.REFRESHTOKEN = "";
    this.JWTTOKEN = "";
    this.USERID = "";
    this.PWD = "";
    this.ACTIVE_STRATEGIES = [];
    this.TOTP = "";
    this.headers = {
      "X-ClientLocalIP": "",
      "X-MACAddress": "",
      "Content-Type": "",
      Accept: "",
      "X-UserType": "",
      "X-SourceID": "",
      "X-PrivateKey": "",
      "X-ClientPublicIP": "",
      Authorization: "",
    };
    console.log("🚀 Cleanup completed ", new Date().toString());
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
      console.log("🚀 No any active strategies found 🏄!");
      return this.cleanup();
    }
    // fetch candle history for above strategies
    const activeCandles = await this.getAllInstrumentCandleHistory();
    if (!activeCandles) {
      console.log("🚀 All markets are closed now 🏄!");
      return this.cleanup();
    }
    // initiate new live feed
    this.initiateLiveFeed();
  }

  async initiateLiveFeed() {
    console.log("🚀 Initiate live feed ", new Date().toString());
    // TODO - supported only mcx instruments for now
    const allMCXInstruments: string[] = [];

    this.ACTIVE_STRATEGIES.forEach((strategy: any) => {
      if (strategy.instrument_to_watch.exch_seg === "MCX") {
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
        tokenList: [],
      },
    };

    if (allMCXInstruments.length > 0) {
      payload.params.tokenList.push({
        exchangeType: EXCHANGES.mcx_fo,
        tokens: allMCXInstruments,
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
    const newDate = new Date();
    const day = newDate.getDate();
    const month = newDate.getMonth();
    const year = newDate.getFullYear();

    this.ACTIVE_STRATEGIES.forEach(
      ({
        instrument_to_watch,
        candle_timeframe: interval,
        start_entry_after,
      }: strategy_prop) => {
        const fromdate = `${year}-${formatNumberInTime(
          month + 1
        )}-${formatNumberInTime(day)} ${
          formatNumberInTime(start_entry_after - 1) +
          ":" +
          formatNumberInTime(0)
        }`;

        const todate = `${year}-${formatNumberInTime(
          month + 1
        )}-${formatNumberInTime(day)} ${formatNumberInTime(
          start_entry_after
        )}:${formatNumberInTime(0)}`;

        responses.push(
          postRequest(
            API.root + API.candle_data,
            {
              exchange: instrument_to_watch.exch_seg,
              symboltoken: instrument_to_watch.token,
              interval,
              fromdate,
              todate,
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
        this.ACTIVE_STRATEGIES[i].market_status = "OPEN";
        this.ACTIVE_STRATEGIES[i].data = item.data;
      } else if (item.errorcode === "AB1004") {
        this.ACTIVE_STRATEGIES[i].market_status = "CLOSED";
      } else {
        console.log(
          "🔥 Failed to fetch candlestick data ",
          new Date().toString(),
          item
        );
        this.ACTIVE_STRATEGIES[i].market_status = "CLOSED";
      }
    });

    return checker;
  }

  async login() {
    console.log("🚀 Angel Login in progress ", new Date().toString());
    const response = await postRequest(
      API.root + API.user_login,
      {
        clientcode: this.USERID,
        password: this.PWD,
        totp: generateTOTP(),
      },
      this.headers
    );
    if (response.status) {
      this.REFRESHTOKEN = response.data.refreshToken;
      this.JWTTOKEN = response.data.jwtToken;
      this.FEEDTOKEN = response.data.feedToken;
      this.headers.Authorization = `Bearer ${this.JWTTOKEN}`;
      console.log("🚀 Angel Login Success 🥳 ", new Date().toString());
      this.initiateStrategyLoaderCroner();
    } else {
      this.REFRESHTOKEN = "";
      this.JWTTOKEN = "";
      this.FEEDTOKEN = "";
      this.headers.Authorization = "";
      console.log(
        "🔥 Angel Login failed message: ",
        response.message,
        new Date().toString()
      );
      setTimeout(() => {
        if (this.LOGIN_RETRY) {
          console.log("🚀 Retry login ", new Date().toString());
          this.login();
          this.LOGIN_RETRY--;
        } else {
          console.log("🔥 Login retry limit reached. ", new Date().toString());
        }
      }, 5000);
    }
  }

  closeOldFeeds() {
    console.log("🚀 Closing old feeds ", new Date().toString());
    // close previous live feed
    const allMCXInstruments: string[] = [];
    this.ACTIVE_STRATEGIES.forEach((strategy: any) => {
      if (strategy.instrument_to_watch.exch_seg === "MCX") {
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
      action: ACTION.Unsubscribe,
      params: {
        mode: MODE.LTP,
        tokenList: [],
      },
    };

    if (allMCXInstruments.length > 0) {
      payload.params.tokenList.push({
        exchangeType: EXCHANGES.mcx_fo,
        tokens: allMCXInstruments,
      });
    }

    if (payload.params.tokenList.length > 0) {
      this.WS.send(JSON.stringify(payload));
    }
    if (this.HEARTBEAT_CRON) {
      this.HEARTBEAT_CRON.stop();
      this.HEARTBEAT_CRON = null;
    }
    this.WS.close?.();
    this.WS = null;
    console.log("🚀 Closed old feeds ", new Date().toString());
  }

  initiateStrategyLoaderCroner() {
    console.log(
      "🚀 Initializing strategy loader croner ",
      new Date().toString()
    );
    // Runs at every 15th minute past every hour from 9-23 on every day-of-week from Monday-Friday
    let strategyScheduledTimer = "*/15 9-23 * * 1-5";
    let strategyCronerMaxRuns;
    if (process.env.environment === "dev") {
      strategyCronerMaxRuns = 1;
      strategyScheduledTimer = "* * * * * *";
    }
    this.STRATEGIES_CRONER = Cron(
      strategyScheduledTimer,
      { maxRuns: strategyCronerMaxRuns },
      async () => {
        console.log(
          "🚀 Strategy loader 15 minute croner execution Success 🥳 ",
          new Date().toString()
        );
        if (this.WS) {
          this.closeOldFeeds();
        }
        this.loadStrategies();
      }
    );
    if (process.env.environment !== "dev") {
      const newDate = new Date();
      if (newDate.getHours() > 9 && newDate.getHours() < 23) {
        this.STRATEGIES_CRONER.trigger();
      }
    }
  }

  async connect_websocket() {
    this.WS = new WebSocket(CONSTANTS.websocketURL, {
      headers: {
        Authorization: this.headers.Authorization,
        "x-api-key": process.env.ANGEL_MARKET_FEED_API_KEY,
        "x-client-code": process.env.ANGEL_USERID,
        "x-feed-token": this.FEEDTOKEN,
      },
    });

    this.WS.on("close", () => {
      if (this.HEARTBEAT_CRON) {
        this.HEARTBEAT_CRON.stop();
        this.HEARTBEAT_CRON = null;
      }
      this.WS = null;
      console.log("🔥 Websocket connection closed!");
    });

    this.WS.on("error", (err: any) => {
      if (this.HEARTBEAT_CRON) {
        this.HEARTBEAT_CRON.stop();
        this.HEARTBEAT_CRON = null;
      }
      this.WS = null;
      console.log("🔥 Websocket connection error ", err);
    });

    this.WS.on("open", () => {
      this.HEARTBEAT_CRON = Cron("*/25 * * * * *", () => {
        this.WS.send("ping");
      });
      if (this.WS_WATCH_LIST_PAYLOADS.length > 0) {
        this.WS_WATCH_LIST_PAYLOADS.forEach((payload) => {
          this.WS.send(payload);
        });
        this.WS_WATCH_LIST_PAYLOADS = [];
      }
      console.log("🚀 Websockets is ❤️ ", new Date().toString());
    });

    this.WS.on("message", async (data: any) => {
      const subscription_mode = new Parser().uint8("subscription_mode");

      if (subscription_mode.parse(data)?.subscription_mode === MODE.LTP) {
        const res = await this.getLTP(data);
        res.token = JSON.parse(res.token);
        const matched_index: number = this.ACTIVE_STRATEGIES.findIndex(
          (strategy: any) => strategy.instrument_to_watch.token === res.token
        );
        if (matched_index !== -1) {
          const tick_size = Number(
            this.ACTIVE_STRATEGIES[matched_index].instrument_to_watch.tick_size
          );
          if (tick_size > 1) {
            res.last_traded_price = Number(res.last_traded_price) / tick_size;
          } else {
            res.last_traded_price = Number(res.last_traded_price);
          }
          this.handleExecution(res, matched_index);
        }
      } else if (data.toString() !== "pong") {
        console.log(
          "🔥 Untracked message -> ",
          data.toString(),
          new Date().toString()
        );
      }
    });
  }

  async getLTP(data: any) {
    const ltp = new Parser()
      .endianness("little")
      .int8("subscription_mode", { formatter: toNumber })
      .int8("exchange_type", { formatter: toNumber })
      .array("token", {
        type: "uint8",
        length: 25,
        formatter: _atos,
      })
      .int64("sequence_number", { formatter: toNumber })
      .int64("exchange_timestamp", { formatter: toNumber })
      .int32("last_traded_price", { formatter: toNumber });

    return ltp.parse(data);
  }

  async updateCALLPUTStrikes(searchTerm: string, matched_index: number) {
    const response = await searchInFirestore({ searchTerm });
    if (response.statusCode === 200 && response.data?.length === 2) {
      let checker = 0;
      const call_instrument_to_trade = <instrument_prop>(
        response.data.find(
          (item: instrument_prop) => item.rel_keywords.indexOf("CE") !== -1
        )
      );
      if (call_instrument_to_trade) {
        this.ACTIVE_STRATEGIES[matched_index].call_instrument_to_trade =
          call_instrument_to_trade;
        ++checker;
      }
      const put_instrument_to_trade = <instrument_prop>(
        response.data.find(
          (item: instrument_prop) => item.rel_keywords.indexOf("PE") !== -1
        )
      );
      if (put_instrument_to_trade) {
        this.ACTIVE_STRATEGIES[matched_index].put_instrument_to_trade =
          put_instrument_to_trade;
        ++checker;
      }
      if (checker === 2) {
        console.log(
          "🚀 Matching call & put instruments found ",
          new Date().toString()
        );
        this.ACTIVE_STRATEGIES[matched_index].strike_selection_in_progress =
          false;
      }
    } else {
      console.log(
        `🔥 Strike price selection failed for ${searchTerm}`,
        response,
        new Date().toString()
      );
    }
  }

  handleExecution(item: ltp_prop, matched_index: number) {
    const matched_strategy = this.ACTIVE_STRATEGIES[matched_index];

    if (this.ACTIVE_STRATEGIES[matched_index].order_in_progress) {
      console.log(
        `🚀 Order placement in progress ${item.token}`,
        new Date().toString()
      );
    } else if (
      this.ACTIVE_STRATEGIES[matched_index].strike_selection_in_progress
    ) {
      console.log(`🚀 Strike selection ${item.token}`, new Date().toString());
      return;
    } else if (
      !matched_strategy.call_instrument_to_trade ||
      !matched_strategy.put_instrument_to_trade
    ) {
      console.log(
        "🚀 Searching for call & put instruments ",
        new Date().toString()
      );
      this.ACTIVE_STRATEGIES[matched_index].strike_selection_in_progress = true;
      const searchTerm = getSearchTerm(matched_strategy, item);
      this.updateCALLPUTStrikes(searchTerm, matched_index);
      return;
    }

    if (
      matched_strategy.entries_taken_today <
        matched_strategy.max_entries_per_day &&
      matched_strategy.order_status === "IDLE"
    ) {
      if (
        matched_strategy.previous_candle === "CROSSES" &&
        matched_strategy.instrument_to_watch.exch_seg === "MCX"
      ) {
        this.handleCrossing(item, matched_index);
      } else {
        console.log(
          "🔥 Handle for this type of execution is not written!!! ",
          new Date().toString()
        );
      }
    }
  }

  async handleCrossing(item: any, matched_index: number) {
    const newDate = new Date();
    const hours = newDate.getHours();
    const minutes = newDate.getMinutes();

    const matched_strategy = this.ACTIVE_STRATEGIES[matched_index];
    if (
      Number(hours + "." + minutes) >= matched_strategy.start_entry_after &&
      Number(hours + "." + minutes) <= matched_strategy.stop_entry_after
    ) {
      const previous_candle_high = this.getPreviousCandleHigh(
        matched_strategy.data
      );
      const previous_candle_low = this.getPreviousCandleLow(
        matched_strategy.data
      );
      // we can take entry here
      console.log(
        `🚀 LTP: ${Number(item.last_traded_price)}, >= ${
          previous_candle_high + matched_strategy.buffer_points
        } or <= ${previous_candle_low - matched_strategy.buffer_points}`,
        new Date().toString()
      );
      if (
        Number(item.last_traded_price) >=
        previous_candle_high + matched_strategy.buffer_points
      ) {
        // pattern here for data field -  [timestamp, open, high, low, close, volume]
        // buy CE here
        this.ACTIVE_STRATEGIES[matched_index].entries_taken_today++;
        this.ACTIVE_STRATEGIES[matched_index].order_status = "PENDING";
        this.ACTIVE_STRATEGIES[matched_index].order_in_progress = true;
        console.log(
          `🚀 CE Order placement criteria met for strategy ${this.ACTIVE_STRATEGIES[matched_index].id}`,
          new Date().toString()
        );
        await placeOrder(
          {
            duration: "DAY",
            exchange:
              this.ACTIVE_STRATEGIES[matched_index].call_instrument_to_trade
                .exch_seg,
            ordertype: "MARKET",
            producttype: "CARRYFORWARD",
            quantity:
              this.ACTIVE_STRATEGIES[matched_index].call_instrument_to_trade
                .lotsize,
            variety: "NORMAL",
            transactiontype: "BUY",
            symboltoken:
              this.ACTIVE_STRATEGIES[matched_index].call_instrument_to_trade
                .token,
            tradingsymbol:
              this.ACTIVE_STRATEGIES[matched_index].call_instrument_to_trade
                .symbol,
          },
          this.headers,
          this.ACTIVE_STRATEGIES[matched_index]
        );
        this.ACTIVE_STRATEGIES[matched_index].order_in_progress = false;
      } else if (
        Number(item.last_traded_price) <=
        previous_candle_low - matched_strategy.buffer_points
      ) {
        // pattern here for data field -  [timestamp, open, high, low, close, volume]
        // buy PE here
        this.ACTIVE_STRATEGIES[matched_index].entries_taken_today++;
        this.ACTIVE_STRATEGIES[matched_index].order_status = "PENDING";
        this.ACTIVE_STRATEGIES[matched_index].order_in_progress = true;
        console.log(
          `🚀 PE Order placement criteria met for strategy ${this.ACTIVE_STRATEGIES[matched_index].id}`,
          new Date().toString()
        );
        await placeOrder(
          {
            duration: "DAY",
            exchange:
              this.ACTIVE_STRATEGIES[matched_index].put_instrument_to_trade
                .exch_seg,
            ordertype: "MARKET",
            producttype: "CARRYFORWARD",
            quantity:
              this.ACTIVE_STRATEGIES[matched_index].put_instrument_to_trade
                .lotsize,
            variety: "NORMAL",
            transactiontype: "BUY",
            symboltoken:
              this.ACTIVE_STRATEGIES[matched_index].put_instrument_to_trade
                .token,
            tradingsymbol:
              this.ACTIVE_STRATEGIES[matched_index].put_instrument_to_trade
                .symbol,
          },
          this.headers,
          this.ACTIVE_STRATEGIES[matched_index]
        );
        this.ACTIVE_STRATEGIES[matched_index].order_in_progress = false;
      }
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
