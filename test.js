
const getAddressStreets = (addressLine1, addressLine2, addressLine3) => {
    const common = `${addressLine1} ${addressLine2} ${addressLine3}`;
    let street1 = addressLine1;
    let street2 = "";
    if (common.length > 68) {
        street1 = common.substring(0, 34);
        street2 = common.substring(34);
    } else {
        if (`${street1} ${addressLine2}`.length > 34) {
            if (`${addressLine2} ${addressLine3}`.length > 34) {
                street1 = common.substring(0, 34);
                street2 = common.substring(34);
            } else {
                street2 = `${addressLine2} ${addressLine3}`;
            }
        } else {
            street1 = `${street1} ${addressLine2}`
            if (`${street1} ${addressLine3}`.length > 34) {
                street2 = addressLine3;
            } else {
                street1 = `${street1} ${addressLine3}`
            }
        }
    }
}

const address = "102 Test data"
const addressLine2 = "Portland hOUSE"
const addressLine3 = "102 Prince Of Wales"

const { street1, street2 } = getAddressStreets(address, addressLine2, addressLine3);

console.log("street1", street1);
console.log("street2", street2);
