const fs = require('fs');
const path = require('path');
const express = require('express');
const { BotManager } = require('biar-fca');

// Configuration
const CONFIG = {
    port: 3000,
    botsDir: path.join(__dirname, 'bots'),
    commandsDir: path.join(__dirname, 'cmd'),
    prefix: '', // Command prefix
    
    // Global bot options
    globalOptions: {
        advancedProtection: true,
        autoRotateSession: true,
        randomUserAgent: true,
        updatePresence: true,
        autoMarkDelivery: true,
        autoMarkRead: true,
        cookieRefresh: true,
        cookieRefreshInterval: 1200000, // 20 minutes
        listenEvents: true,
        logLevel: 'silent',
        selfListen: false,
        online: true
    }
};

// Create bots directory if it doesn't exist
if (!fs.existsSync(CONFIG.botsDir)) {
    fs.mkdirSync(CONFIG.botsDir, { recursive: true });
}

// Command storage
const commands = new Map();

// Bot Manager
const manager = new BotManager(CONFIG.globalOptions);

// Express app for web interface
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load all commands from cmd folder
function loadCommands() {
    try {
        const files = fs.readdirSync(CONFIG.commandsDir).filter(file => file.endsWith('.js'));
        
        for (const file of files) {
            try {
                const command = require(path.join(CONFIG.commandsDir, file));
                if (command.name && command.execute) {
                    commands.set(command.name, command);
                    console.log(`✓ Loaded command: ${command.name}`);
                    
                    // Load aliases if available
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(alias => {
                            commands.set(alias, command);
                        });
                    }
                }
            } catch (error) {
                console.error(`✗ Error loading command ${file}:`, error.message);
            }
        }
        
        console.log(`\n📦 Total commands loaded: ${commands.size}\n`);
    } catch (error) {
        console.error('Error reading cmd folder:', error.message);
    }
}

// Handle incoming messages from all bots
function handleMessage(botId, bot, event) {
    const { body, threadID, messageID, senderID } = event;
    
    if (!body || typeof body !== 'string') return;
    
    // Check if message starts with prefix
    if (!body.startsWith(CONFIG.prefix)) return;
    
    // Parse command and arguments
    const args = body.slice(CONFIG.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // Find command
    const command = commands.get(commandName);
    
    if (!command) return;
    
    try {
        console.log(`⚡ [${botId}] Command: ${commandName} | User: ${senderID} | Thread: ${threadID}`);
        
        // Execute command with bot API
        command.execute(bot.api, event, args, CONFIG);
    } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
        bot.api.sendMessage(`❌ Error: ${error.message}`, threadID, messageID);
    }
}

// Load bots from directory
async function loadBots() {
    console.log('📂 Loading bots from directory...\n');
    
    try {
        const files = fs.readdirSync(CONFIG.botsDir);
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            const botId = path.basename(file, '.json');
            const filePath = path.join(CONFIG.botsDir, file);
            
            try {
                const appState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                console.log(`🔄 Loading bot: ${botId}...`);
                await manager.addBot(botId, { appState });
                
            } catch (error) {
                console.error(`❌ Failed to load bot ${botId}:`, error.message);
            }
        }
    } catch (error) {
        console.error('Error reading bots directory:', error.message);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Bot added
    manager.on('botAdded', ({ botId, userID }) => {
        console.log(`✅ Bot "${botId}" (${userID}) is now online`);
    });
    
    // Bot removed
    manager.on('botRemoved', ({ botId }) => {
        console.log(`🗑️  Bot "${botId}" removed`);
    });
    
    // Bot error
    manager.on('botError', ({ botId, error }) => {
        console.error(`❌ Bot "${botId}" error:`, error.message);
    });
    
    // Message received
    manager.on('message', ({ botId, bot, event }) => {
        handleMessage(botId, bot, event);
    });
    
    // General error
    manager.on('error', ({ botId, error }) => {
        console.error(`⚠️  Error from bot "${botId}":`, error.message);
    });
}

// API Routes

// Get all bots
app.get('/api/bots', (req, res) => {
    const bots = manager.getAllBots().map(bot => ({
        id: bot.id,
        userID: bot.userID,
        status: bot.status,
        stats: bot.stats,
        uptime: Date.now() - bot.stats.startTime
    }));
    
    res.json({ success: true, bots });
});

// Get bot statistics
app.get('/api/stats', (req, res) => {
    const stats = manager.getStats();
    res.json({ success: true, stats });
});

// Get health status
app.get('/api/health', (req, res) => {
    const health = manager.getHealthStatus();
    res.json({ success: true, health });
});

// Add new bot
app.post('/api/bots', async (req, res) => {
    try {
        const { botId, appState } = req.body;
        
        if (!botId || !appState) {
            return res.status(400).json({ 
                success: false, 
                error: 'botId and appState are required' 
            });
        }
        
        // Save appstate to file
        const filePath = path.join(CONFIG.botsDir, `${botId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(appState, null, 2));
        
        // Add bot to manager
        await manager.addBot(botId, { appState });
        
        res.json({ 
            success: true, 
            message: `Bot "${botId}" added successfully`,
            bot: manager.getBot(botId)
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Remove bot
app.delete('/api/bots/:botId', (req, res) => {
    try {
        const { botId } = req.params;
        
        manager.removeBot(botId);
        
        // Delete appstate file
        const filePath = path.join(CONFIG.botsDir, `${botId}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        res.json({ 
            success: true, 
            message: `Bot "${botId}" removed successfully` 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Restart bot
app.post('/api/bots/:botId/restart', async (req, res) => {
    try {
        const { botId } = req.params;
        await manager.restartBot(botId);
        
        res.json({ 
            success: true, 
            message: `Bot "${botId}" restarted successfully` 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Broadcast message
app.post('/api/broadcast', async (req, res) => {
    try {
        const { message, threadID } = req.body;
        
        if (!message || !threadID) {
            return res.status(400).json({ 
                success: false, 
                error: 'message and threadID are required' 
            });
        }
        
        const results = await manager.broadcast(message, threadID);
        
        res.json({ 
            success: true, 
            results 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Main function
async function startServer() {
    console.log('🤖 Starting Jubiar Multi-Bot Manager...\n');
    
    // Load commands
    loadCommands();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load bots
    await loadBots();
    
    // Start web server
    app.listen(CONFIG.port, () => {
        console.log(`\n🌐 Web Interface: http://localhost:${CONFIG.port}`);
        console.log('👂 Listening for messages from all bots...\n');
        
        // Display initial stats
        const stats = manager.getStats();
        console.log(`📊 Manager Stats:`);
        console.log(`   • Total bots: ${stats.totalBots}`);
        console.log(`   • Active bots: ${stats.activeBots}`);
        console.log(`   • Errors: ${stats.errors}\n`);
    });
}

// Start the server
startServer();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down gracefully...');
    manager.stopAll();
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('💥 Unhandled Rejection:', error);
});

