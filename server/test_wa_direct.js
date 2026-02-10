const axios = require('axios');

const URL = 'https://bidang-sarana-wawebjs.ltdh6w.easypanel.host/api/send-message';
const GROUP_ID = '12036341954292088@g.us';

(async () => {
    console.log("---------------------------------------------------");
    console.log(`Testing Direct API Call to: ${URL}`);
    console.log(`Target: ${GROUP_ID}`);
    console.log("---------------------------------------------------");

    try {
        const payload = {
            number: GROUP_ID,
            message: "Tes Debugging Server 2"
        };

        console.log("Payload:", JSON.stringify(payload));

        const response = await axios.post(URL, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log("✅ Success Status:", response.status);
        console.log("✅ Success Data:", response.data);

    } catch (error) {
        console.error("❌ Error Occurred!");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
            console.error("Headers:", JSON.stringify(error.response.headers, null, 2));
        } else if (error.request) {
            console.error("No Response Received:", error.request);
        } else {
            console.error("Error Message:", error.message);
        }
    }
})();
