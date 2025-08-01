const fs = require('fs');
const express = require('express');
const { v4: uuidv4 } = require('uuid'); // For generating unique keys
const app = express();
app.use(express.json());

// Load or initialize tracked clients
let trackedClients = {};
try {
    const data = fs.readFileSync('tracked_clients.json');
    trackedClients = JSON.parse(data);
} catch (e) {
    fs.writeFileSync('tracked_clients.json', '{}');
    console.log("Created tracked_clients.json");
}

// Load whitelist
let whitelist = [];
try {
    const data = fs.readFileSync('whitelist.json');
    whitelist = JSON.parse(data);
} catch (e) {
    console.error("Failed to read whitelist:", e);
    fs.writeFileSync('whitelist.json', '[]');
    console.log("Created whitelist.json");
}

// Decryption function
function xorDecrypt(str, key) {
    let result = "";
    for (let i = 0; i < str.length; i++) {
        result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
}

// Generate key endpoint
app.get('/generate-key', (req, res) => {
    const newKey = uuidv4(); // Generate a unique UUID
    console.log("Generated new key:", newKey);
    res.json({ success: true, key: newKey, message: 'New tracking key generated' });
});

// Track clientId endpoint
app.post('/track', (req, res) => {
    const { key, clientId } = req.body;
    if (!key || !clientId) {
        return res.status(400).json({ success: false, message: 'Missing key or clientId' });
    }

    const decryptedClientId = xorDecrypt(clientId, "secretkey123");
    trackedClients[key] = decryptedClientId;
    fs.writeFileSync('tracked_clients.json', JSON.stringify(trackedClients, null, 2));
    console.log("Tracked clientId for key", key, ":", decryptedClientId);

    if (!whitelist.includes(decryptedClientId)) {
        whitelist.push(decryptedClientId);
        fs.writeFileSync('whitelist.json', JSON.stringify(whitelist, null, 2));
        console.log("Added to whitelist:", decryptedClientId);
    }

    res.json({ success: true, message: 'Client ID tracked', clientId: decryptedClientId });
});

// Reset clientId endpoint
app.post('/reset', (req, res) => {
    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ success: false, message: 'Missing key' });
    }

    if (trackedClients[key]) {
        delete trackedClients[key];
        fs.writeFileSync('tracked_clients.json', JSON.stringify(trackedClients, null, 2));
        console.log("Reset clientId for key", key);
        res.json({ success: true, message: 'Client ID reset' });
    } else {
        res.json({ success: false, message: 'No tracked clientId for this key' });
    }
});

// Fetch tracked clientId (GET method)
app.get('/track', (req, res) => {
    const { key } = req.body || req.query; // Support query param or body
    if (!key) {
        return res.status(400).json({ success: false, message: 'Missing key' });
    }

    const clientId = trackedClients[key];
    if (clientId) {
        res.json({ success: true, clientId: clientId, message: 'Tracked clientId retrieved' });
    } else {
        res.json({ success: false, message: 'No clientId tracked for this key' });
    }
});

// Validate endpoint
app.post('/validate', (req, res) => {
    const { clientId } = req.body;
    if (!clientId) {
        return res.status(400).json({ success: false, message: 'No client ID provided' });
    }
    const decryptedClientId = xorDecrypt(clientId, "secretkey123");
    const isWhitelisted = whitelist.includes(decryptedClientId);
    res.json({ success: isWhitelisted, message: isWhitelisted ? 'Validated' : 'Not whitelisted' });
});

// Notifications endpoint (example)
app.get('/notifications', (req, res) => {
    res.json([{ gameName: "Game1", modelName: "Model1", mutation: "Mut1", moneyText: "100/s", placeId: 123, jobId: "xxx-xxx-xxx", timestamp: Date.now() / 1000 }]);
});

// Simple web interface for key generation
app.get('/', (req, res) => {
    res.send(`
        <html>
            <body>
                <h1>Key Generator</h1>
                <button onclick="generateKey()">Generate New Key</button>
                <p id="keyResult"></p>
                <script>
                    function generateKey() {
                        fetch('/generate-key')
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    document.getElementById('keyResult').innerText = 'New Key: ' + data.key;
                                    navigator.clipboard.writeText(data.key);
                                    alert('Key generated and copied to clipboard!');
                                } else {
                                    document.getElementById('keyResult').innerText = 'Error: ' + data.message;
                                }
                            })
                            .catch(error => document.getElementById('keyResult').innerText = 'Error: ' + error);
                    }
                </script>
            </body>
        </html>
    `);
});

// Render requires a PORT environment variable
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
