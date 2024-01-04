import { authenticator } from 'otplib';

const generateTOTP = () => {
    const secret = process.env.TOTP + "";
    const token = authenticator.generate(secret);
    return token;
};

export default generateTOTP;