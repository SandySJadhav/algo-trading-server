import { postRequest } from "../http.interceptor"
import constant from "../constant";
import { generateHash } from "../helpers";
import { WebSocket } from "ws";

class Alice {
    USERID = ""
    API_KEY = ""
    ACCESS_TOKEN = ""
    APIENCRYPTIONKEY = ""
    SESSION_ID = ""
    WSSESSION_ID = ""
    headers = {}

    constructor(userId: string, apiKey: string) {
        this.USERID = userId ? userId : ""
        this.API_KEY = apiKey ? apiKey : ""
        this.ACCESS_TOKEN = ""
        this.APIENCRYPTIONKEY = ""
        this.SESSION_ID = ""
        this.WSSESSION_ID = ""
        this.headers = { 'content-type': 'application/json' }
    }

    async apiEncryptionKey() {
        // Get the api encryption key for the user
        const response = await postRequest(constant.APIENCRYPTIONKEY, {
            "userId": this.USERID
        })
        response.stat === "Ok" && (this.APIENCRYPTIONKEY = response.encKey) ? console.log("API Encryption Key Received") : console.log("API Encryption Key Not Received")
        return response
    }

    async getSessionId() {
        // To Get Session Id
        const string = this.USERID + this.API_KEY + this.APIENCRYPTIONKEY
        const encodedString = await generateHash(string)
        const response = await postRequest(constant.SESSIONID, { "userId": this.USERID, "userData": encodedString })
        if (response.stat === "Ok") {
            this.SESSION_ID = response.sessionID;
            this.headers = { 'authorization': 'Bearer ' + this.USERID + " " + this.SESSION_ID, 'content-type': 'application/json' }
            console.log("Session Id Received ", response.stat);
        } else {
            console.log("Session Id Not Received", response);
        }
        return response
    }

    async invalidateSession() {
        // Invalidate the session of the user for the web socket
        const response = await postRequest(constant.INVALIDATE_SESSION, { "loginType": "API" }, this.headers)
        return response
    }

    async getWSSession() {
        // Get the websocket session for the user
        const response = await postRequest(constant.CREATESESSION, { "loginType": "API" }, this.headers)
        this.WSSESSION_ID = response.result.wsSess;
        return response
    }

    async WebSocket() {
        let response;
        if (this.WSSESSION_ID) {
            response = await this.invalidateSession()
            console.log(`Old Session Invalidated  ${response.stat}`)
        }
        if (!this.WSSESSION_ID) {
            response = await this.getWSSession()
            console.log(`Websocket Session Created  ${response.stat}`)
        }
        const susertoken = await generateHash(await generateHash(this.SESSION_ID))
        const data = {
            susertoken,
            "t": "c",
            "actid": this.USERID + "_API",
            'uid': this.USERID + "_API",
            "source": "API"
        }
        console.log("Attempting Websocket Connection")
        // Get the websocket session for the user
        const wSocket = new WebSocket(constant.WEBSOCKET);

        wSocket.onopen = function () {
            console.log("On Open")
            wSocket.send(JSON.stringify(data));
        }
        wSocket.onmessage = function (event?: any) {
            console.log("On Message", event.data)
        }
        wSocket.onerror = function (error?: any) {
            console.log("On Error", error)
        }
        wSocket.onclose = function () {
            console.log("Websocket closed")
        }
        return wSocket
    }

}

export default Alice;