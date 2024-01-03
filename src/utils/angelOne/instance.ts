import Angel from "./base";

const createAngelInstanceAndLogin = () => {
    const angel = new Angel(process.env.ANGEL_USERID + "", process.env.ANGEL_PWD + "");
    angel.login();
    if (!angel.REFRESHTOKEN) {
        console.log("Angel instance creation failed...");
    }
};

export default createAngelInstanceAndLogin;