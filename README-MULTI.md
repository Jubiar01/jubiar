# 🤖 Jubiar Multi-Bot Manager

Manage multiple Facebook bot accounts simultaneously with a beautiful web interface!

## 🎉 Features

- ✅ **Multi-Account Management** - Run unlimited bot accounts from one dashboard
- ✅ **Web Interface** - Beautiful, responsive UI for managing bots
- ✅ **Real-time Statistics** - Monitor messages, uptime, and errors
- ✅ **Easy Bot Management** - Add, remove, and restart bots with one click
- ✅ **Independent Operation** - Each bot runs independently
- ✅ **Centralized Commands** - Shared command system across all bots
- ✅ **Keep-Alive System** - Automatic cookie refresh and MQTT pings per bot

## 📦 Installation

```bash
npm install
```

## 🚀 Quick Start

### 1. Start Multi-Bot Manager

```bash
npm run multi
```

### 2. Open Web Interface

Open your browser and navigate to:
```
http://localhost:3000
```

### 3. Add Your First Bot

1. Click on "Add New Bot" section
2. Enter a unique Bot ID (e.g., `bot1`, `mybot`)
3. Paste your AppState JSON
4. Click "Add Bot"

Your bot will start automatically!

## 📁 Directory Structure

```
jubiar/
├── index.js              # Single bot (original)
├── index-multi.js        # Multi-bot manager
├── server.js             # Alternative server
├── package.json          # Dependencies
├── cmd/                  # Commands folder
│   ├── ping.js
│   └── ...
├── bots/                 # Bot configurations (auto-created)
│   ├── bot1.json        # Bot 1 appstate
│   ├── bot2.json        # Bot 2 appstate
│   └── ...
└── public/               # Web interface
    └── index.html        # Dashboard UI
```

## 🎯 Usage

### Single Bot Mode (Original)

```bash
npm start
```

Uses `appstate.json` in the jubiar directory.

### Multi-Bot Mode (New!)

```bash
npm run multi
```

Opens web interface at `http://localhost:3000`

## 🌐 Web Interface

The web dashboard provides:

### Statistics Dashboard
- Total bots count
- Active bots
- Total messages received
- Total messages sent

### Bot Management
- **Add Bot** - Add new bot with AppState JSON
- **View Status** - See online/offline status
- **Monitor Activity** - Messages, uptime, errors
- **Restart Bot** - Restart specific bot
- **Remove Bot** - Delete bot configuration

### Real-Time Updates
- Auto-refresh every 5 seconds
- Live statistics
- Instant bot status changes

## 📊 API Endpoints

### GET `/api/bots`
Get all bots with their status and statistics.

**Response:**
```json
{
  "success": true,
  "bots": [
    {
      "id": "bot1",
      "userID": "123456789",
      "status": "online",
      "stats": {
        "messagesReceived": 45,
        "messagesSent": 30,
        "errors": 0
      },
      "uptime": 3600000
    }
  ]
}
```

### GET `/api/stats`
Get overall manager statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalBots": 3,
    "activeBots": 2,
    "totalMessagesReceived": 150,
    "totalMessagesSent": 120,
    "errors": 0,
    "uptime": 7200000
  }
}
```

### GET `/api/health`
Get health status of all bots.

**Response:**
```json
{
  "success": true,
  "health": {
    "healthy": 2,
    "unhealthy": 1,
    "total": 3,
    "bots": [...]
  }
}
```

### POST `/api/bots`
Add a new bot.

**Request Body:**
```json
{
  "botId": "bot1",
  "appState": [...]
}
```

### DELETE `/api/bots/:botId`
Remove a bot.

### POST `/api/bots/:botId/restart`
Restart a specific bot.

### POST `/api/broadcast`
Broadcast message to all bots.

**Request Body:**
```json
{
  "message": "Hello from all accounts!",
  "threadID": "123456789"
}
```

## 🔧 Configuration

Edit `index-multi.js` to customize:

```javascript
const CONFIG = {
    port: 3000,                    // Web interface port
    botsDir: './bots',             // Bot configurations directory
    commandsDir: './cmd',          // Commands directory
    prefix: '',                    // Command prefix
    
    globalOptions: {
        advancedProtection: true,
        cookieRefresh: true,
        cookieRefreshInterval: 1200000,  // 20 minutes
        // ... more options
    }
};
```

## 🎮 Commands

All commands in the `cmd/` folder work across all bots!

When a bot receives a command, it executes using that specific bot's account.

Example: If `bot1` receives `/ping`, it responds from `bot1`'s account.

## 📝 Adding Bots

### Method 1: Web Interface (Recommended)

1. Open `http://localhost:3000`
2. Fill in Bot ID and AppState
3. Click "Add Bot"

### Method 2: Manual File

1. Create file `bots/botname.json`
2. Add your AppState JSON
3. Restart the manager

Example `bots/mybot.json`:
```json
[
  {
    "key": "c_user",
    "value": "123456789"
  },
  {
    "key": "xs",
    "value": "..."
  }
]
```

## 🔄 Keep-Alive System

Each bot has its own keep-alive system:
- **Cookie Refresh**: Every 20 minutes
- **MQTT Pings**: Every 30 seconds
- **Automatic Recovery**: Self-healing from failures

## 📈 Scaling

The system is designed to scale:
- Run unlimited bot accounts
- Each bot is independent
- Minimal resource overhead per bot
- Centralized monitoring

## 🛑 Stopping Bots

### Stop All Bots
Press `Ctrl+C` in the terminal running the manager.

All bots will shut down gracefully.

### Stop Individual Bot
Use the web interface "Remove" button.

## 🐛 Troubleshooting

### Bot Won't Start
- Check AppState JSON is valid
- Ensure account isn't locked
- Check console logs for errors

### Web Interface Not Loading
- Verify port 3000 is available
- Check firewall settings
- Try accessing `http://127.0.0.1:3000`

### Bot Goes Offline
- Check the bot's error count in dashboard
- Restart the bot using "Restart" button
- Verify AppState is still valid

## 🚀 Production Deployment

For production use:

1. **Use PM2** for process management
```bash
npm install -g pm2
pm2 start index-multi.js --name jubiar-multi
pm2 save
```

2. **Set up reverse proxy** (nginx/apache)
3. **Enable HTTPS**
4. **Monitor logs** with PM2

## 📖 Examples

### Broadcast Message
```javascript
// Through API
await fetch('http://localhost:3000/api/broadcast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'System announcement!',
    threadID: '123456789'
  })
});
```

### Monitor Bot Health
```javascript
const health = await fetch('http://localhost:3000/api/health')
  .then(r => r.json());

console.log(`Healthy bots: ${health.health.healthy}`);
console.log(`Unhealthy bots: ${health.health.unhealthy}`);
```

## 💡 Tips

- **Unique Bot IDs**: Use descriptive names (e.g., `support1`, `marketing1`)
- **Monitor Dashboard**: Keep dashboard open to monitor activity
- **Regular Restarts**: Restart bots periodically for optimal performance
- **Backup AppStates**: Keep backups of your bot configurations

## 🙏 Credits

Built with [biar-fca v3.6.8](https://github.com/Jubiar01/biar-fca) - Facebook Chat API with Multi-Account Support

## 📄 License

MIT License - Feel free to use and modify!

---

**Made with ❤️ by Jubiar**

