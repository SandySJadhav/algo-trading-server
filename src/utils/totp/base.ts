import { authenticator } from 'otplib';

const generateTOTP = () => authenticator.generate(String(process.env.TOTP));

export default generateTOTP;
