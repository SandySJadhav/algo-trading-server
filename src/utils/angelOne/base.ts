import address from "address";
import { postRequest } from "../http.interceptor";
import API from "./api";

const totp = '003828'

class Angel {
    REFRESHTOKEN = ""
    JWTTOKEN = ""
    USERID = ""
    PWD = ""
    headers = {
        "X-ClientLocalIP": "",
        "X-MACAddress": "",
        "Content-Type": "",
        "Accept": "",
        "X-UserType": "",
        "X-SourceID": "",
        "X-PrivateKey": "",
        'X-ClientPublicIP': "",
        'Authorization': ''
    }
    constructor(userId: string, pass: string) {
        this.USERID = userId;
        this.PWD = pass;

        this.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-UserType": "USER",
            "X-SourceID": "WEB",
            "X-PrivateKey": "IMqQHIhg",
            'X-ClientLocalIP': '',
            'X-ClientPublicIP': '',
            'X-MACAddress': '',
            'Authorization': ''
        }

        address((err, addrs) => {
            this.headers["X-ClientLocalIP"] = addrs !== undefined ? addrs.ip + "" : '192.168.168.168';
            this.headers["X-MACAddress"] = addrs !== undefined ? addrs.mac + "" : 'fe80::216e:6507:4b90:3719';
        });
    }

    async login() {
        const response = await postRequest(API.root + API.user_login, {
            clientcode: this.USERID,
            password: this.PWD,
            totp,
        }, this.headers);
        if (response.status) {
            console.log('Angel Login success, Token generated: Ok');
            this.REFRESHTOKEN = response.data.refreshToken;
            this.JWTTOKEN = response.data.jwtToken;
            this.headers.Authorization = `Bearer ${this.JWTTOKEN}`;
        } else {
            console.log("Angel Login failed message: ", response.message);
        }
    }

    async regenerateSession() {
        const response = await postRequest(API.root + API.generate_token, {
            "refreshToken": this.REFRESHTOKEN
        }, this.headers)
        if (response.status) {
            this.JWTTOKEN = response.data.jwtToken;
            if (response.data.refreshToken) {
                this.REFRESHTOKEN = response.data.refreshToken
            }
            console.log("Angel Token regeneration success: Ok");
        } else {
            console.log("Angel refresh token failed", response.message);
        }
    }

    // async searchScript(searchscrip: string, exchange: string) {
    //     const response = await postRequest(API.root + API.search_scrip, {exchange, searchscrip}, this.headers);
    //     console.log(response);
    //     return response;
    // }
}

export default Angel;