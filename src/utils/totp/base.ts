import { authenticator } from 'otplib';

const generateTOTP = () => authenticator.generate(process.env.TOTP + '');

export default generateTOTP;
