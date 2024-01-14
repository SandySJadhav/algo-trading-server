import address from "address";
import WebSocket from "ws";
import Cron from "croner";
import API from "./api";
import { ACTION, CONSTANTS, EXCHANGES, MODE } from "./constants";
import { postRequest } from "../http.interceptor";
import { fetchInstrumentsToWatch } from "../firebase/fetchInstruments";
import { Parser } from "binary-parser";

class Angel {
  HEARTBEAT_CRON: any;
  WS: any;
  FEEDTOKEN = "";
  REFRESHTOKEN = "";
  JWTTOKEN = "";
  USERID = "";
  PWD = "";
  ALL_STRATEGIES: any;
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
  constructor(userId: string, pass: string, totp: string) {
    this.USERID = userId;
    this.PWD = pass;
    this.TOTP = totp;

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
        console.log("Failed to get address...", err);
      }
      this.headers["X-ClientLocalIP"] =
        addrs !== undefined ? addrs.ip + "" : "192.168.168.168";
      this.headers["X-MACAddress"] =
        addrs !== undefined ? addrs.mac + "" : "fe80::216e:6507:4b90:3719";
    });
  }

  async login() {
    const response = await postRequest(
      API.root + API.user_login,
      {
        clientcode: this.USERID,
        password: this.PWD,
        totp: this.TOTP,
      },
      this.headers
    );
    if (response.status) {
      console.log("Angel Login success, Token generated: Ok");
      this.REFRESHTOKEN = response.data.refreshToken;
      this.JWTTOKEN = response.data.jwtToken;
      this.FEEDTOKEN = response.data.feedToken;
      this.headers.Authorization = `Bearer ${this.JWTTOKEN}`;
      this.connect_websocket();
    } else {
      console.log("Angel Login failed message: ", response.message);
    }
  }

  async regenerateSession() {
    const response = await postRequest(
      API.root + API.generate_token,
      {
        refreshToken: this.REFRESHTOKEN,
      },
      this.headers
    );
    if (response.status) {
      this.JWTTOKEN = response.data.jwtToken;
      if (response.data.refreshToken) {
        this.REFRESHTOKEN = response.data.refreshToken;
      }
      console.log("Angel Token regeneration success: Ok");
    } else {
      console.log("Angel refresh token failed", response.message);
    }
  }

  async fetchInstrumentsFromFirestore() {
    this.ALL_STRATEGIES = await fetchInstrumentsToWatch();
    if (this.ALL_STRATEGIES.length > 0) {
      const allMCXInstruments: string[] = [];

      this.ALL_STRATEGIES.forEach((strategy: any) => {
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
        this.WS.send(JSON.stringify(payload));
      }
    } else {
      console.log("No any active strategies found...");
    }
  }

  toNumber(number: number) {
    return number.toString();
  }

  _atos(array: any) {
    var newarray = [];
    try {
      for (var i = 0; i < array.length; i++) {
        newarray.push(String.fromCharCode(array[i]));
      }
    } catch (e: any) {
      throw new Error(e);
    }

    let token: string = JSON.stringify(newarray.join(""));
    return token.replace(/\\u0000/g, "");
  }

  async getLTP(data: any) {
    const ltp = new Parser()
      .endianness("little")
      .int8("subscription_mode", { formatter: this.toNumber })
      .int8("exchange_type", { formatter: this.toNumber })
      .array("token", {
        type: "uint8",
        length: 25,
        formatter: this._atos,
      })
      .int64("sequence_number", { formatter: this.toNumber })
      .int64("exchange_timestamp", { formatter: this.toNumber })
      .int32("last_traded_price", { formatter: this.toNumber });

    return ltp.parse(data);
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

    this.WS.on("error", (err: any) => {
      console.log("Websocket connection closed due to error --->", err);
      this.HEARTBEAT_CRON.stop();
      this.HEARTBEAT_CRON = null;
      this.WS = null;
    });

    this.WS.on("open", () => {
      this.HEARTBEAT_CRON = Cron("25 * * * * *", () => {
        this.WS.send("ping");
      });
      console.log("Websocket heartbeat croner started");
      this.fetchInstrumentsFromFirestore();
    });

    this.WS.on("message", async (data: any) => {
      const subscription_mode = new Parser().uint8("subscription_mode");

      if (subscription_mode.parse(data)?.subscription_mode === MODE.LTP) {
        const res = await this.getLTP(data);
        console.log(res);
      } else {
        console.log("Other text", data.toString());
      }
    });
  }
}

export default Angel;
