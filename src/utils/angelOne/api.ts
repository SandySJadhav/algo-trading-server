const API = {
  root: 'https://apiconnect.angelbroking.com',
  login: 'https://smartapi.angelbroking.com/publisher-login',
  debug: false,
  timeout: 7000,

  user_login: '/rest/auth/angelbroking/user/v1/loginByPassword',
  generate_token: '/rest/auth/angelbroking/jwt/v1/generateTokens',
  get_profile: '/rest/secure/angelbroking/user/v1/getProfile',
  logout: '/rest/secure/angelbroking/user/v1/logout',

  order_place: '/rest/secure/angelbroking/order/v1/placeOrder',

  get_tradebook: '/rest/secure/angelbroking/order/v1/getTradeBook',
  get_rms: '/rest/secure/angelbroking/user/v1/getRMS',
  get_holding: '/rest/secure/angelbroking/portfolio/v1/getHolding',
  get_position: '/rest/secure/angelbroking/order/v1/getPosition',
  convert_position: '/rest/secure/angelbroking/order/v1/convertPosition',

  candle_data: '/rest/secure/angelbroking/historical/v1/getCandleData',
  search_scrip: '/rest/secure/angelbroking/order/v1/searchScrip',
};

export default API;
