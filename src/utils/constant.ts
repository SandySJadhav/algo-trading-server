// For More Info: https://v2api.aliceblueonline.com/appendix
// BASE SCRIPTS
const BASE_URL = "https://ant.aliceblueonline.com/rest/AliceBlueAPIService/api"
const CONTRACT_URL = "https://v2api.aliceblueonline.com/restpy/contract_master" // QUERY PARAMS: exchange
const APIENCRYPTIONKEY = BASE_URL + "/customer/getAPIEncpkey"
const SESSIONID = BASE_URL + "/customer/getUserSID"

// WEBSOCKET SECTION
// CREATE WS SESSION FOR VENDORS
const CREATESESSION = BASE_URL + "/ws/createWsSession"
const INVALIDATE_SESSION = BASE_URL + "/ws/invalidateSocketSess"
const WEBSOCKET = "wss://ws1.aliceblueonline.com/NorenWS/"

// SEARCH SCRIPTS
const SEARCHSCRIP = BASE_URL + "/exchange/getScripForSearch"

export default {
    BASE_URL,
    CONTRACT_URL,
    APIENCRYPTIONKEY,
    SESSIONID,
    CREATESESSION,
    INVALIDATE_SESSION,
    WEBSOCKET,
    SEARCHSCRIP
}