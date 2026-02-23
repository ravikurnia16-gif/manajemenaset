const axios = require('axios');

const test = async () => {
    try {
        // We'll try hitting the endpoint. We don't have a token here,
        // so we expect a 401, NOT a 404.
        // If it's a 404, the route is definitely not registered.
        console.log('Testing /api/personnel/drivers/toggle...');
        const res = await axios.post('http://localhost:5000/api/personnel/drivers/toggle');
        console.log('Response:', res.status);
    } catch (err) {
        if (err.response) {
            console.log('Error Status:', err.response.status);
            console.log('Error Data:', err.response.data);
        } else {
            console.log('Error Message:', err.message);
        }
    }
};

test();
