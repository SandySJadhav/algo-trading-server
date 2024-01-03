import Angel from "./base";

let angel: Angel;
export const createAngelInstance = () => {
    angel = new Angel(process.env.ANGEL_USERID + "", process.env.ANGEL_PWD + "")
    angel.login();
    if (!angel.REFRESHTOKEN) {
        console.log("Angel instance creation failed...");
    }
}

export const regenerateAngelSession = () => {
    if (angel) {
        angel.regenerateSession();
    } else {
        console.log("Angel regeneration failed as Angel object not initialized")
    }
}

export const searchTerm = (text: string, searchscrip: string) => {
    if (angel) {
        return angel.searchScript(text, searchscrip);
    } else {
        console.log("Angel searchTerm failed as Angel object not initialized")
    }
}