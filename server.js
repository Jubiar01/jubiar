const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple HTTP server to keep bot alive and provide status
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Jubiar Bot Status</title>
                <meta charset="utf-8">
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        max-width: 800px;
                        margin: 50px auto;
                        padding: 20px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .container {
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        padding: 30px;
                        backdrop-filter: blur(10px);
                        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
                    }
                    h1 { margin-top: 0; }
                    .status {
                        background: rgba(255, 255, 255, 0.2);
                        padding: 15px;
                        border-radius: 5px;
                        margin: 20px 0;
                    }
                    .status-indicator {
                        display: inline-block;
                        width: 12px;
                        height: 12px;
                        background: #4ade80;
                        border-radius: 50%;
                        margin-right: 10px;
                        animation: pulse 2s infinite;
                    }
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.5; }
                    }
                    code {
                        background: rgba(0, 0, 0, 0.3);
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-family: 'Courier New', monospace;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🤖 Jubiar Bot Server</h1>
                    <div class="status">
                        <span class="status-indicator"></span>
                        <strong>Status:</strong> Online and Running
                    </div>
                    <p><strong>Description:</strong> Facebook Messenger Bot powered by biar-fca</p>
                    <p><strong>Server Time:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
                    <p><strong>Node Version:</strong> ${process.version}</p>
                    <hr style="border-color: rgba(255, 255, 255, 0.2);">
                    <h3>📝 Usage Instructions:</h3>
                    <ol>
                        <li>Make sure <code>appstate.json</code> exists in the parent directory</li>
                        <li>Commands are located in the <code>cmd/</code> folder</li>
                        <li>Default command prefix is <code>!</code></li>
                        <li>Try sending <code>!ping</code> in Messenger to test</li>
                    </ol>
                </div>
            </body>
            </html>
        `);
    } else if (req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'online',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            nodeVersion: process.version
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`🌐 Server running at http://localhost:${PORT}`);
    console.log(`📊 Status endpoint: http://localhost:${PORT}/status\n`);
});

// Start the bot
require('./index.js');

// Handle errors
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Try a different port.`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
});

