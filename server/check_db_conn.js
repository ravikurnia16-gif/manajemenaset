const net = require('net');
const client = new net.Socket();
const host = '129.150.59.181';
const port = 3306;

console.log(`Checking TCP connection to ${host}:${port}...`);

client.setTimeout(5000);
client.connect(port, host, () => {
    console.log('SUCCESS: Connection established!');
    client.destroy();
});

client.on('error', (err) => {
    console.error('ERROR: Connection failed:', err.message);
    client.destroy();
});

client.on('timeout', () => {
    console.error('ERROR: Connection timed out after 5s');
    client.destroy();
});
