const fs = require('fs');
const path = require('path');
const express = require('express');
const { login, BotManager } = require('biar-fca');

// Configuration
const CONFIG = {
    // Mode: 'single' or 'multi' (auto-detected)
    mode: null,
    
    // Single bot mode
    appStatePath: path.join(__dirname, 'appstate.json'),
    
    // Multi-bot mode
    port: 3000,
    botsDir: path.join(__dirname, 'bots'),
    commandsDir: path.join(__dirname, 'cmd'),
    
    // Common settings
    prefix: '', // Command prefix
    adminID: [], // Add admin user IDs here if needed
    
    // Advanced Protection Settings (biar-fca v3.6.2+)
    protection: {
        enabled: true,              // Enable advanced anti-detection
        autoRotateSession: true,    // Auto-rotate session every 6hrs
        randomUserAgent: true,      // Use random realistic user agents
        autoMarkDelivery: true,     // Auto-mark messages as delivered (realistic)
        autoMarkRead: true,         // Auto-mark messages as read (realistic)
        updatePresence: true        // Maintain online presence
    },
    
    // Built-in Keep-Alive System (v3.6.6+)
    keepAlive: {
        enabled: true,              // Enable built-in keep-alive (cookie refresh + MQTT pings)
        cookieRefreshInterval: 20 * 60 * 1000,  // Cookie refresh every 20 minutes (default)
        // MQTT keep-alive happens automatically every 30 seconds
    }
};

// Command storage
const commands = new Map();

// Bot Manager (for multi-bot mode)
let manager = null;

// Express app (for multi-bot mode)
let app = null;

// Detect mode (single or multi)
function detectMode() {
    const botsDir = CONFIG.botsDir;
    const hasBotsDir = fs.existsSync(botsDir);
    const hasAppState = fs.existsSync(CONFIG.appStatePath);
    
    if (hasBotsDir) {
        const botFiles = fs.readdirSync(botsDir).filter(f => f.endsWith('.json'));
        if (botFiles.length > 0) {
            CONFIG.mode = 'multi';
            console.log('🤖 Mode: Multi-Bot (detected bot configurations in bots/)');
            return;
        }
    }
    
    if (hasAppState) {
        CONFIG.mode = 'single';
        console.log('🤖 Mode: Single-Bot (using appstate.json)');
        return;
    }
    
    // Default to multi-bot mode and create directory
    CONFIG.mode = 'multi';
    if (!fs.existsSync(botsDir)) {
        fs.mkdirSync(botsDir, { recursive: true });
    }
    console.log('🤖 Mode: Multi-Bot (no bots configured yet)');
}

// Load all commands from cmd folder
function loadCommands() {
    const cmdPath = CONFIG.commandsDir;
    
    try {
        const files = fs.readdirSync(cmdPath).filter(file => file.endsWith('.js'));
        
        for (const file of files) {
            try {
                const command = require(path.join(cmdPath, file));
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

// Monitor Keep-Alive System (v3.6.6+)
function monitorKeepAliveSystem(api) {
    console.log('📊 Keep-Alive Monitoring: Started\n');
    
    // Log stats every 10 minutes
    setInterval(() => {
        try {
            // Get keep-alive statistics
            if (typeof api.getCookieRefreshStats === 'function') {
                const stats = api.getCookieRefreshStats();
                const now = new Date().toLocaleTimeString();
                
                console.log(`\n📊 [${now}] Keep-Alive System Status:`);
                console.log(`   Cookie Refresh:`);
                console.log(`     • Total refreshes: ${stats.refreshCount}`);
                console.log(`     • Failures: ${stats.failureCount}`);
                console.log(`     • Last refresh: ${Math.floor(stats.timeSinceLastRefresh / 60000)}m ago`);
                
                console.log(`   MQTT Keep-Alive:`);
                console.log(`     • Total pings: ${stats.mqttKeepAlive.pingCount}`);
                console.log(`     • Failures: ${stats.mqttKeepAlive.pingFailures}`);
                console.log(`     • Last ping: ${Math.floor(stats.mqttKeepAlive.timeSinceLastPing / 1000)}s ago`);
                
                // Calculate total uptime
                const uptimeMinutes = Math.floor(stats.timeSinceLastRefresh / 60000);
                const uptimeHours = (uptimeMinutes / 60).toFixed(1);
                console.log(`   • Bot Uptime: ${uptimeHours}h (${uptimeMinutes}m)`);
            }
            
            // Get protection statistics
            if (typeof api.getProtectionStats === 'function') {
                const protectionStats = api.getProtectionStats();
                const uptime = Math.floor(protectionStats.uptime / 1000 / 60);
                const uptimeHours = (uptime / 60).toFixed(1);
                console.log(`   • Requests Made: ${protectionStats.requests}`);
                console.log(`   • Session Uptime: ${uptimeHours}h`);
            }
        } catch (error) {
            console.error('❌ Error getting stats:', error.message);
        }
    }, 10 * 60 * 1000); // Log every 10 minutes
}

// Handle incoming messages (single-bot mode)
function handleMessage(api, event) {
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
        console.log(`⚡ Command: ${commandName} | User: ${senderID} | Thread: ${threadID}`);
        
        // Execute command
        command.execute(api, event, args, CONFIG);
    } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
        api.sendMessage(`❌ Error executing command: ${error.message}`, threadID, messageID);
    }
}

// Handle incoming messages (multi-bot mode)
function handleMessageMulti(botId, bot, event) {
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
        console.error(`[${botId}] Error executing command ${commandName}:`, error);
        bot.api.sendMessage(`❌ Error: ${error.message}`, threadID, messageID);
    }
}

// ============================================
// SINGLE-BOT MODE
// ============================================

function startSingleBot() {
    console.log('📱 Starting Single-Bot Mode...\n');
    
    // Check if appstate exists
    if (!fs.existsSync(CONFIG.appStatePath)) {
        console.error(`\n❌ Error: appstate.json not found at ${CONFIG.appStatePath}`);
        console.log('Please create an appstate.json file first.');
        console.log('Or create bots/ directory with bot configurations for multi-bot mode.');
        process.exit(1);
    }
    
    // Load appstate
    let appState;
    try {
        appState = JSON.parse(fs.readFileSync(CONFIG.appStatePath, 'utf8'));
    } catch (error) {
        console.error('❌ Error reading appstate.json:', error.message);
        process.exit(1);
    }
    
    // Login to Facebook
    console.log('🔐 Logging in to Facebook...');
    
    login({ appState }, {
        advancedProtection: CONFIG.protection.enabled,
        autoRotateSession: CONFIG.protection.autoRotateSession,
        randomUserAgent: CONFIG.protection.randomUserAgent,
        updatePresence: CONFIG.protection.updatePresence,
        autoMarkDelivery: CONFIG.protection.autoMarkDelivery,
        autoMarkRead: CONFIG.protection.autoMarkRead,
        cookieRefresh: CONFIG.keepAlive.enabled,
        cookieRefreshInterval: CONFIG.keepAlive.cookieRefreshInterval,
        listenEvents: true,
        logLevel: 'silent',
        selfListen: false,
        online: true
    }, (err, api) => {
        if (err) {
            console.error('❌ Login failed:', err);
            return;
        }
        
        console.log('✅ Login successful!\n');
        
        // Display status
        if (typeof api.getProtectionStats === 'function') {
            const stats = api.getProtectionStats();
            console.log('🛡️  Protection Status: ✅ Enabled');
            console.log('🔄 Keep-Alive System: ✅ Active\n');
        }
        
        // Monitor keep-alive
        if (CONFIG.keepAlive.enabled) {
            monitorKeepAliveSystem(api);
        }
        
        // Listen for messages
        console.log('👂 Listening for messages...\n');
        
        api.listenMqtt((err, event) => {
            if (err) {
                console.error('Listen error:', err);
                return;
            }
            
            if (event.type === 'message' || event.type === 'message_reply') {
                handleMessage(api, event);
            }
        });
    });
}

// ============================================
// MULTI-BOT MODE
// ============================================

async function loadBots() {
    console.log('📂 Loading bots from directory...\n');
    
    try {
        const files = fs.readdirSync(CONFIG.botsDir);
        let loaded = 0;
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            const botId = path.basename(file, '.json');
            const filePath = path.join(CONFIG.botsDir, file);
            
            try {
                const appState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                console.log(`🔄 Loading bot: ${botId}...`);
                await manager.addBot(botId, { appState });
                loaded++;
            } catch (error) {
                console.error(`❌ Failed to load bot ${botId}:`, error.message);
            }
        }
        
        if (loaded === 0) {
            console.log('\n⚠️  No bots loaded. Add bots via web interface at http://localhost:' + CONFIG.port);
        }
    } catch (error) {
        console.error('Error reading bots directory:', error.message);
    }
}

function setupMultiBotEvents() {
    manager.on('botAdded', ({ botId, userID }) => {
        console.log(`✅ Bot "${botId}" (${userID}) is now online`);
    });
    
    manager.on('botRemoved', ({ botId }) => {
        console.log(`🗑️  Bot "${botId}" removed`);
    });
    
    manager.on('botError', ({ botId, error }) => {
        console.error(`❌ Bot "${botId}" error:`, error.message);
    });
    
    manager.on('message', ({ botId, bot, event }) => {
        handleMessageMulti(botId, bot, event);
    });
    
    manager.on('error', ({ botId, error }) => {
        console.error(`⚠️  Error from bot "${botId}":`, error.message);
    });
}

function setupWebInterface() {
    app = express();
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    
    // API Routes
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
    
    app.get('/api/stats', (req, res) => {
        const stats = manager.getStats();
        res.json({ success: true, stats });
    });
    
    app.get('/api/health', (req, res) => {
        const health = manager.getHealthStatus();
        res.json({ success: true, health });
    });
    
    app.post('/api/bots', async (req, res) => {
        try {
            const { botId, appState } = req.body;
            
            if (!botId || !appState) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'botId and appState are required' 
                });
            }
            
            // Save appstate
            const filePath = path.join(CONFIG.botsDir, `${botId}.json`);
            fs.writeFileSync(filePath, JSON.stringify(appState, null, 2));
            
            // Add bot
            await manager.addBot(botId, { appState });
            
            res.json({ 
                success: true, 
                message: `Bot "${botId}" added successfully`,
                bot: manager.getBot(botId)
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.delete('/api/bots/:botId', (req, res) => {
        try {
            const { botId } = req.params;
            manager.removeBot(botId);
            
            const filePath = path.join(CONFIG.botsDir, `${botId}.json`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            res.json({ success: true, message: `Bot "${botId}" removed` });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/bots/:botId/restart', async (req, res) => {
        try {
            const { botId } = req.params;
            await manager.restartBot(botId);
            res.json({ success: true, message: `Bot "${botId}" restarted` });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
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
            res.json({ success: true, results });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
}

async function startMultiBot() {
    console.log('🤖 Starting Multi-Bot Mode...\n');
    
    // Initialize bot manager
    manager = new BotManager({
        advancedProtection: CONFIG.protection.enabled,
        autoRotateSession: CONFIG.protection.autoRotateSession,
        randomUserAgent: CONFIG.protection.randomUserAgent,
        updatePresence: CONFIG.protection.updatePresence,
        autoMarkDelivery: CONFIG.protection.autoMarkDelivery,
        autoMarkRead: CONFIG.protection.autoMarkRead,
        cookieRefresh: CONFIG.keepAlive.enabled,
        cookieRefreshInterval: CONFIG.keepAlive.cookieRefreshInterval,
        listenEvents: true,
        logLevel: 'silent',
        selfListen: false,
        online: true
    });
    
    // Setup events
    setupMultiBotEvents();
    
    // Setup web interface
    setupWebInterface();
    
    // Load bots
    await loadBots();
    
    // Start server
    app.listen(CONFIG.port, () => {
        console.log(`\n🌐 Web Interface: http://localhost:${CONFIG.port}`);
        console.log('👂 Listening for messages from all bots...\n');
        
        const stats = manager.getStats();
        console.log(`📊 Manager Stats:`);
        console.log(`   • Total bots: ${stats.totalBots}`);
        console.log(`   • Active bots: ${stats.activeBots}\n`);
        
        if (stats.totalBots === 0) {
            console.log('💡 Tip: Add bots via web interface at http://localhost:' + CONFIG.port);
        }
    });
}

// ============================================
// MAIN
// ============================================

async function start() {
    console.log('🤖 Starting Jubiar Bot Manager...\n');
    
    // Detect mode
    detectMode();
    
    // Load commands
    loadCommands();
    
    // Start based on mode
    if (CONFIG.mode === 'single') {
        startSingleBot();
    } else {
        await startMultiBot();
    }
}

// Start the application
start();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down gracefully...');
    if (manager) {
        manager.stopAll();
    }
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('💥 Unhandled Rejection:', error);
});

