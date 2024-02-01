const getStreetsAddress = (addressLine1 = "", addressLine2 = "", addressLine3 = "") => {
    const common = `${addressLine1} ${addressLine2} ${addressLine3}`;
    let street1 = "";
    let street2 = "";

    if (common.length < 35) {
        return { street1: common, street2 }
    } else if (common.length > 68 || addressLine1.length > 34 || addressLine2.length > 34 || addressLine3.length > 34 || `${addressLine1} ${addressLine2}`.length > 34 || `${addressLine2} ${addressLine3}`.length > 34) {
        street1 = common.substring(0, 34).trim();
        street2 = common.substring(34).trim();
    } else {
        if (`${addressLine1} ${addressLine2}`.length > 34) {
            street1 = addressLine1;
            street2 = "";
        } else if (`${addressLine2} ${addressLine3}`.length > 34) {
            street1 = "";
            street2 = "";
        } else {
            street1 = common;
            street2 = "";
        }
    }
    return { street1, street2 };
};


const { street1, street2 } = getStreetsAddress("Flat 102 Portland", "", "");

console.log("street1 -> ", street1.length, street1);
console.log("street2 -> ", street2.length, street2);
