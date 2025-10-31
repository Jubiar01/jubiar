# 🤖 Jubiar Bot Manager

Facebook Messenger Bot with Multi-Account Support powered by biar-fca v3.6.8

## 🎉 Features

- ✅ **Auto-Detect Mode** - Automatically switches between single-bot and multi-bot modes
- ✅ **Single-Bot Mode** - Traditional single account bot
- ✅ **Multi-Bot Mode** - Manage unlimited bot accounts simultaneously
- ✅ **Web Interface** - Beautiful dashboard for multi-bot management
- ✅ **Shared Commands** - All commands in `cmd/` work with both modes
- ✅ **Keep-Alive System** - Automatic cookie refresh + MQTT pings per bot
- ✅ **Independent Operation** - Each bot runs independently

## 📦 Installation

```bash
npm install
```

## 🚀 Quick Start

### Single-Bot Mode

1. Place your `appstate.json` in the `jubiar/` directory
2. Run: `npm start`

The bot will automatically detect single-bot mode and start!

### Multi-Bot Mode

1. Create `bots/` directory (or let it auto-create)
2. Run: `npm start`
3. Open browser: `http://localhost:3000`
4. Add bots via web interface

## 🎯 How It Works

### Auto-Detection

The bot automatically detects which mode to use:

- **Single-Bot**: If `appstate.json` exists in root directory
- **Multi-Bot**: If `bots/` directory exists with bot configs
- **Default**: Multi-bot mode (creates `bots/` directory)

### Switching Modes

**To switch to Single-Bot:**
- Place `appstate.json` in jubiar directory
- Remove or empty `bots/` directory

**To switch to Multi-Bot:**
- Create `bots/` directory
- Add bot configs (via web interface or manually)
- Remove `appstate.json` from root (optional)

## 📁 Directory Structure

```
jubiar/
├── index.js              # Main bot (auto-detects mode)
├── appstate.json         # Single-bot mode (optional)
├── package.json
├── cmd/                  # Commands (work in both modes)
│   ├── ping.js
│   ├── help.js
│   ├── protection.js
│   └── ...
├── bots/                 # Multi-bot configs (auto-created)
│   ├── bot1.json
│   ├── bot2.json
│   └── ...
└── public/               # Web interface
    └── index.html
```

## 🌐 Multi-Bot Web Interface

When in multi-bot mode, access the dashboard at:
```
http://localhost:3000
```

### Features:
- **Real-time Statistics** - Total bots, messages, uptime
- **Bot Management** - Add, remove, restart bots
- **Live Monitoring** - Auto-refresh every 5 seconds
- **AppState Input** - Easy bot addition with JSON paste

### Adding a Bot:

1. Go to `http://localhost:3000`
2. Enter Bot ID (e.g., `bot1`, `mybot`)
3. Paste AppState JSON
4. Click "Add Bot"

Bot will start immediately!

## 🎮 Commands

All commands in `cmd/` folder work in both modes!

### Built-in Commands:
- `ping` - Check bot response time
- `help` - List all commands
- `protection` - View protection status
- `echo` - Echo back message

### Creating Commands:

Create a file in `cmd/` directory:

```javascript
// cmd/mycommand.js
module.exports = {
    name: 'mycommand',
    aliases: ['mc', 'cmd'],
    description: 'My custom command',
    execute(api, event, args, CONFIG) {
        const { threadID } = event;
        api.sendMessage('Hello from my command!', threadID);
    }
};
```

Command works automatically in both single and multi-bot modes!

## ⚙️ Configuration

Edit `index.js` to customize:

```javascript
const CONFIG = {
    port: 3000,                    // Web interface port
    prefix: '',                    // Command prefix
    
    protection: {
        enabled: true,             // Advanced protection
        autoRotateSession: true,
        randomUserAgent: true,
        updatePresence: true
    },
    
    keepAlive: {
        enabled: true,             // Keep-alive system
        cookieRefreshInterval: 1200000  // 20 minutes
    }
};
```

## 🔄 Bot Management

### Single-Bot Mode:
- Bot runs from `appstate.json`
- Restart: `Ctrl+C` then `npm start`
- Commands work normally

### Multi-Bot Mode:
- Bots managed via web interface
- Each bot has independent stats
- Commands work on the bot that receives them
- Restart individual bots via dashboard

## 📊 API Endpoints (Multi-Bot Mode)

### GET `/api/bots`
List all bots with stats

### GET `/api/stats`
Overall manager statistics

### GET `/api/health`
Health status of all bots

### POST `/api/bots`
Add new bot
```json
{
  "botId": "bot1",
  "appState": [...]
}
```

### DELETE `/api/bots/:botId`
Remove bot

### POST `/api/bots/:botId/restart`
Restart specific bot

### POST `/api/broadcast`
Broadcast message to all bots
```json
{
  "message": "Hello!",
  "threadID": "123456"
}
```

## 🔧 Troubleshooting

### Bot Not Starting

**Check the mode:**
```bash
npm start
# Look for: "Mode: Single-Bot" or "Mode: Multi-Bot"
```

**Single-Bot Issues:**
- Verify `appstate.json` exists
- Check JSON is valid
- Ensure account isn't locked

**Multi-Bot Issues:**
- Check `bots/` directory exists
- Verify bot configs are valid JSON
- Check port 3000 is available

### Commands Not Working

- Verify command files are in `cmd/` directory
- Check command files end with `.js`
- Ensure `name` and `execute` are exported
- Check console for loading errors

### Web Interface Not Loading

- Check if in multi-bot mode
- Verify port 3000 is free
- Try `http://127.0.0.1:3000`
- Check firewall settings

## 💡 Tips

### Single-Bot Mode:
- Perfect for one account
- Simpler setup
- Direct appstate.json usage

### Multi-Bot Mode:
- Manage multiple accounts
- Web dashboard for easy control
- Individual bot statistics
- Centralized command system

### Best Practices:
- **Backup AppStates** - Keep copies of your bot configs
- **Unique Bot IDs** - Use descriptive names (e.g., `support1`, `marketing1`)
- **Monitor Dashboard** - Keep dashboard open in multi-bot mode
- **Regular Checks** - Check bot health periodically

## 🚀 Production Deployment

### Using PM2:

```bash
npm install -g pm2
pm2 start index.js --name jubiar
pm2 save
pm2 startup
```

### Environment Variables:

Create `.env` file:
```
PORT=3000
NODE_ENV=production
```

## 📖 Examples

### Example 1: Single Bot
```bash
# Place appstate.json in root
npm start
# Bot starts in single-bot mode
```

### Example 2: Multi-Bot
```bash
# Create bots directory
mkdir bots

# Start server
npm start

# Access http://localhost:3000
# Add bots via web interface
```

### Example 3: Switching Modes
```bash
# From single to multi:
mkdir bots
mv appstate.json bots/bot1.json
npm start

# From multi to single:
cp bots/bot1.json appstate.json
rm -rf bots
npm start
```

## 🙏 Credits

Built with [biar-fca v3.6.8](https://github.com/Jubiar01/biar-fca) - Facebook Chat API with Multi-Account Support

## 📄 License

MIT License - Feel free to use and modify!

---

**Made with ❤️ by Jubiar**

