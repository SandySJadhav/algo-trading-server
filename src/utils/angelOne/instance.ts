import generateTOTP from "../totp/base";
import Angel from "./base";

const createAngelInstanceAndLogin = async () => {
    const totp = generateTOTP();
    const angel = new Angel(process.env.ANGEL_USERID + "", process.env.ANGEL_PWD + "", totp);
    await angel.login();
    if (!angel.REFRESHTOKEN) {
        console.log("Angel instance creation failed...");
    }
};

export default createAngelInstanceAndLogin;