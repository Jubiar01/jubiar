require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const { login } = require('biar-fca');
const EventEmitter = require('events');
const { MongoClient } = require('mongodb');

// MongoDB Configuration
const MONGODB_CONFIG = {
    url: process.env.MONGODB_URL,
    dbName: process.env.MONGODB_DB,
    collections: {
        bots: 'bots',
        stats: 'stats',
        logs: 'logs',
        commands: 'commands'
    }
};

let mongoClient = null;
let db = null;

// Initialize MongoDB Connection
async function connectMongoDB() {
    try {
        // MongoDB connection options with proper TLS configuration
        const options = {
            tls: true,
            tlsAllowInvalidCertificates: false,
            tlsAllowInvalidHostnames: false,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000,
            maxPoolSize: 10,
            minPoolSize: 2,
            retryWrites: true,
            retryReads: true,
            w: 'majority'
        };

        mongoClient = new MongoClient(MONGODB_CONFIG.url, options);
        await mongoClient.connect();
        db = mongoClient.db(MONGODB_CONFIG.dbName);
        console.log('✅ Connected to MongoDB');
        
        // Create indexes
        await db.collection(MONGODB_CONFIG.collections.bots).createIndex({ botId: 1 }, { unique: true });
        console.log('✅ MongoDB indexes created');
        
        return db;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('⚠️  Falling back to file-based storage');
        return null;
    }
}

// MongoDB Helper Functions
const MongoDB = {
    async saveBotConfig(botId, appState, userID = null, password = null) {
        if (!db) return false;
        try {
            const updateData = {
                botId,
                appState,
                userID,
                updatedAt: new Date()
            };
            
            // Only set password if provided (don't overwrite existing)
            if (password) {
                // Simple hash - in production, use bcrypt
                const crypto = require('crypto');
                updateData.passwordHash = crypto.createHash('sha256').update(password).digest('hex');
            }
            
            await db.collection(MONGODB_CONFIG.collections.bots).updateOne(
                { botId },
                {
                    $set: updateData,
                    $setOnInsert: {
                        createdAt: new Date(),
                        commands: [] // Bot-specific commands
                    }
                },
                { upsert: true }
            );
            return true;
        } catch (error) {
            console.error('Error saving bot config to MongoDB:', error.message);
            return false;
        }
    },

    async verifyBotPassword(botId, password) {
        if (!db) return false;
        try {
            const bot = await db.collection(MONGODB_CONFIG.collections.bots).findOne({ botId });
            if (!bot || !bot.passwordHash) return false;
            
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256').update(password).digest('hex');
            return hash === bot.passwordHash;
        } catch (error) {
            console.error('Error verifying bot password:', error.message);
            return false;
        }
    },

    async getBotConfig(botId) {
        if (!db) return null;
        try {
            return await db.collection(MONGODB_CONFIG.collections.bots).findOne({ botId });
        } catch (error) {
            console.error('Error getting bot config from MongoDB:', error.message);
            return null;
        }
    },

    async getAllBotConfigs() {
        if (!db) return [];
        try {
            return await db.collection(MONGODB_CONFIG.collections.bots).find({}).toArray();
        } catch (error) {
            console.error('Error getting all bot configs from MongoDB:', error.message);
            return [];
        }
    },

    async deleteBotConfig(botId) {
        if (!db) return false;
        try {
            await db.collection(MONGODB_CONFIG.collections.bots).deleteOne({ botId });
            return true;
        } catch (error) {
            console.error('Error deleting bot config from MongoDB:', error.message);
            return false;
        }
    },

    async saveStats(stats) {
        if (!db) return false;
        try {
            await db.collection(MONGODB_CONFIG.collections.stats).insertOne({
                ...stats,
                timestamp: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error saving stats to MongoDB:', error.message);
            return false;
        }
    },

    async logEvent(botId, eventType, data) {
        if (!db) return false;
        try {
            await db.collection(MONGODB_CONFIG.collections.logs).insertOne({
                botId,
                eventType,
                data,
                timestamp: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error logging event to MongoDB:', error.message);
            return false;
        }
    },

    // Bot-Specific Command Management
    async saveBotCommand(botId, commandData) {
        if (!db) return false;
        try {
            const bot = await db.collection(MONGODB_CONFIG.collections.bots).findOne({ botId });
            if (!bot) return false;
            
            const commands = bot.commands || [];
            const existingIndex = commands.findIndex(cmd => cmd.name === commandData.name);
            
            if (existingIndex >= 0) {
                commands[existingIndex] = { ...commandData, updatedAt: new Date() };
            } else {
                commands.push({ ...commandData, createdAt: new Date(), updatedAt: new Date() });
            }
            
            await db.collection(MONGODB_CONFIG.collections.bots).updateOne(
                { botId },
                { $set: { commands, updatedAt: new Date() } }
            );
            return true;
        } catch (error) {
            console.error('Error saving bot command to MongoDB:', error.message);
            return false;
        }
    },

    async getBotCommand(botId, commandName) {
        if (!db) return null;
        try {
            const bot = await db.collection(MONGODB_CONFIG.collections.bots).findOne({ botId });
            if (!bot || !bot.commands) return null;
            return bot.commands.find(cmd => cmd.name === commandName);
        } catch (error) {
            console.error('Error getting bot command from MongoDB:', error.message);
            return null;
        }
    },

    async getAllBotCommands(botId) {
        if (!db) return [];
        try {
            const bot = await db.collection(MONGODB_CONFIG.collections.bots).findOne({ botId });
            return bot?.commands || [];
        } catch (error) {
            console.error('Error getting all bot commands from MongoDB:', error.message);
            return [];
        }
    },

    async deleteBotCommand(botId, commandName) {
        if (!db) return false;
        try {
            const bot = await db.collection(MONGODB_CONFIG.collections.bots).findOne({ botId });
            if (!bot) return false;
            
            const commands = (bot.commands || []).filter(cmd => cmd.name !== commandName);
            
            await db.collection(MONGODB_CONFIG.collections.bots).updateOne(
                { botId },
                { $set: { commands, updatedAt: new Date() } }
            );
            return true;
        } catch (error) {
            console.error('Error deleting bot command from MongoDB:', error.message);
            return false;
        }
    }
};

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

// ============================================
// CUSTOM BOT MANAGER CLASS
// ============================================

class BotManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.bots = new Map();
        this.options = options;
        this.stats = {
            totalBots: 0,
            activeBots: 0,
            totalMessagesReceived: 0,
            totalMessagesSent: 0
        };
    }

    async addBot(botId, credentials) {
        return new Promise((resolve, reject) => {
            if (this.bots.has(botId)) {
                return reject(new Error(`Bot "${botId}" already exists`));
            }

            const bot = {
                id: botId,
                userID: null,
                status: 'connecting',
                api: null,
                stopListening: null, // Store the stopListening function
                stats: {
                    messagesReceived: 0,
                    messagesSent: 0,
                    errors: 0,
                    startTime: Date.now()
                }
            };

            this.bots.set(botId, bot);
            this.stats.totalBots++;

            login(credentials, this.options, (err, api) => {
                if (err) {
                    // DON'T delete the bot - mark as error status instead
                    bot.status = 'error';
                    bot.errorMessage = err.message || 'Login failed';
                    this.emit('botError', { botId, error: err });
                    
                    // Log the error but keep bot in database
                    console.error(`❌ Bot "${botId}" login failed:`, err.message);
                    MongoDB.logEvent(botId, 'login_failed', { error: err.message });
                    
                    return reject(err);
                }

                bot.api = api;
                bot.status = 'online';
                bot.userID = api.getCurrentUserID();
                this.stats.activeBots++;

                // Wrap sendMessage to track sent messages
                const originalSendMessage = api.sendMessage;
                api.sendMessage = (...args) => {
                    bot.stats.messagesSent++;
                    this.stats.totalMessagesSent++;
                    return originalSendMessage.apply(api, args);
                };

                // Save to MongoDB
                MongoDB.saveBotConfig(botId, credentials.appState, bot.userID, credentials.password);
                MongoDB.logEvent(botId, 'bot_added', { userID: bot.userID });

                // Load bot-specific commands
                loadBotCommands(botId);

                this.emit('botAdded', { botId, userID: bot.userID });

                // Store the stopListening function returned by listenMqtt
                const stopListening = api.listenMqtt((err, event) => {
                    // CRITICAL: Check if bot still exists before processing
                    const currentBot = this.bots.get(botId);
                    if (!currentBot || currentBot.status === 'offline' || !currentBot.api) {
                        // Bot was removed, ignore this event
                        return;
                    }
                    
                    if (err) {
                        bot.stats.errors++;
                        this.emit('error', { botId, error: err });
                        return;
                    }

                    if (event.type === 'message' || event.type === 'message_reply') {
                        bot.stats.messagesReceived++;
                        this.stats.totalMessagesReceived++;
                        this.emit('message', { botId, bot, event });
                    }
                });

                bot.stopListening = stopListening;

                resolve(bot);
            });
        });
    }

    removeBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) {
            throw new Error(`Bot "${botId}" not found`);
        }

        console.log(`🗑️ Removing bot ${botId}...`);

        // Stop listening first (CRITICAL - prevents responses after deletion)
        if (bot.stopListening && typeof bot.stopListening === 'function') {
            try {
                bot.stopListening();
                console.log(`✓ Stopped listening for bot ${botId}`);
            } catch (error) {
                console.error(`Error stopping listener for bot ${botId}:`, error.message);
            }
        }

        // Set the API to null to prevent any further use
        const tempApi = bot.api;
        bot.api = null;

        // Then logout
        if (tempApi && typeof tempApi.logout === 'function') {
            try {
                tempApi.logout();
                console.log(`✓ Logged out bot ${botId}`);
            } catch (error) {
                console.error(`Error logging out bot ${botId}:`, error.message);
            }
        }

        // Track if bot was online
        const wasOnline = bot.status === 'online';
        
        // Set status to offline before removing
        bot.status = 'offline';

        // Remove from bots map
        this.bots.delete(botId);
        this.stats.totalBots--;
        if (wasOnline) {
            this.stats.activeBots--;
        }

        // Clear bot-specific commands from memory
        if (botCommands.has(botId)) {
            botCommands.delete(botId);
            console.log(`✓ Cleared commands for bot ${botId}`);
        }

        // Delete from MongoDB
        MongoDB.deleteBotConfig(botId);
        MongoDB.logEvent(botId, 'bot_removed', { userID: bot.userID });

        this.emit('botRemoved', { botId });
        console.log(`✓ Bot ${botId} completely removed and cleaned up`);
    }

    async restartBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) {
            throw new Error(`Bot "${botId}" not found`);
        }

        console.log(`🔄 Restarting bot ${botId}...`);

        let appState = null;
        let password = null;

        // Try to get appState from MongoDB first
        if (db) {
            const config = await MongoDB.getBotConfig(botId);
            if (config && config.appState) {
                appState = config.appState;
                // We don't store the actual password, so we'll skip password on restart
                // The passwordHash will remain in the database
            }
        }

        // Fallback: Load from file system
        if (!appState) {
            const filePath = path.join(CONFIG.botsDir, `${botId}.json`);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Bot configuration not found for "${botId}"`);
            }
            appState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        // IMPORTANT: Clear bot commands first to prevent duplicates
        if (botCommands.has(botId)) {
            botCommands.delete(botId);
            console.log(`✓ Cleared old commands for bot ${botId}`);
        }

        // Remove the bot completely (stops listeners, clears everything)
        this.removeBot(botId);
        
        // Small delay to ensure cleanup is complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Re-add the bot with fresh state
        await this.addBot(botId, { appState, password });
        
        MongoDB.logEvent(botId, 'bot_restarted', {});
        console.log(`✅ Bot ${botId} restarted successfully`);
    }

    getBot(botId) {
        return this.bots.get(botId);
    }

    getAllBots() {
        return Array.from(this.bots.values());
    }

    getStats() {
        return {
            ...this.stats,
            totalBots: this.bots.size,
            activeBots: Array.from(this.bots.values()).filter(b => b.status === 'online').length
        };
    }

    getHealthStatus() {
        return {
            healthy: this.stats.activeBots > 0,
            totalBots: this.stats.totalBots,
            activeBots: this.stats.activeBots,
            uptime: process.uptime()
        };
    }

    async broadcast(message, threadID) {
        const results = [];
        for (const [botId, bot] of this.bots) {
            if (bot.status === 'online' && bot.api) {
                try {
                    await new Promise((resolve, reject) => {
                        bot.api.sendMessage(message, threadID, (err, info) => {
                            if (err) reject(err);
                            else {
                                bot.stats.messagesSent++;
                                this.stats.totalMessagesSent++;
                                resolve(info);
                            }
                        });
                    });
                    results.push({ botId, success: true });
                } catch (error) {
                    results.push({ botId, success: false, error: error.message });
                }
            }
        }
        return results;
    }

    stopAll() {
        console.log('🛑 Stopping all bots...');
        for (const [botId, bot] of this.bots) {
            try {
                // Stop listening first
                if (bot.stopListening && typeof bot.stopListening === 'function') {
                    bot.stopListening();
                }
                // Nullify API to prevent further use
                const tempApi = bot.api;
                bot.api = null;
                
                // Then logout
                if (tempApi && typeof tempApi.logout === 'function') {
                    tempApi.logout();
                }
                
                // Clear bot commands
                if (botCommands.has(botId)) {
                    botCommands.delete(botId);
                }
            } catch (error) {
                console.error(`Error stopping bot ${botId}:`, error.message);
            }
        }
        this.bots.clear();
        botCommands.clear();
        this.stats.totalBots = 0;
        this.stats.activeBots = 0;
        console.log('✅ All bots stopped');
    }
}

// Command storage
const commands = new Map(); // Global built-in commands
const botCommands = new Map(); // Bot-specific commands: Map<botId, Map<cmdName, command>>

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

// Load all global commands from cmd folder
async function loadCommands() {
    const cmdPath = CONFIG.commandsDir;
    let commandCount = 0;
    
    try {
        // Load built-in commands from cmd folder
        const files = fs.readdirSync(cmdPath).filter(file => file.endsWith('.js'));
        
        for (const file of files) {
            try {
                const command = require(path.join(cmdPath, file));
                if (command.name && command.execute) {
                    commands.set(command.name, command);
                    console.log(`✓ Loaded global command: ${command.name}`);
                    commandCount++;
                    
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
        
        console.log(`\n📦 Total global commands loaded: ${commandCount}\n`);
    } catch (error) {
        console.error('Error loading commands:', error.message);
    }
}

// Load bot-specific commands for a bot
async function loadBotCommands(botId) {
    if (!db) return;
    
    try {
        const customCommands = await MongoDB.getAllBotCommands(botId);
        
        if (customCommands.length === 0) return;
        
        if (!botCommands.has(botId)) {
            botCommands.set(botId, new Map());
        }
        
        const botCmdMap = botCommands.get(botId);
        
        for (const cmdData of customCommands) {
            try {
                // Create a command object from stored data
                const command = {
                    name: cmdData.name,
                    description: cmdData.description,
                    usage: cmdData.usage,
                    aliases: cmdData.aliases || [],
                    isCustom: true,
                    botSpecific: true,
                    execute: async (api, event, args, config) => {
                        const { threadID, messageID } = event;
                        try {
                            // Execute the stored code
                            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                            const func = new AsyncFunction('api', 'event', 'args', 'config', cmdData.code);
                            await func(api, event, args, config);
                        } catch (error) {
                            console.error(`Error in bot command ${cmdData.name}:`, error);
                            api.sendMessage(`❌ Error executing command: ${error.message}`, threadID, messageID);
                        }
                    }
                };
                
                botCmdMap.set(command.name, command);
                
                // Load aliases
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(alias => {
                        botCmdMap.set(alias, command);
                    });
                }
            } catch (error) {
                console.error(`✗ Error loading bot command ${cmdData.name}:`, error.message);
            }
        }
        
        console.log(`✓ Loaded ${customCommands.length} custom command(s) for bot ${botId}`);
    } catch (error) {
        console.error(`Error loading bot commands for ${botId}:`, error.message);
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
    // CRITICAL: Check if bot still exists and has valid API
    if (!bot || !bot.api || bot.status === 'offline') {
        console.log(`⚠️ Ignoring message for removed/offline bot: ${botId}`);
        return;
    }
    
    const { body, threadID, messageID, senderID } = event;
    
    if (!body || typeof body !== 'string') return;
    
    // Check if message starts with prefix
    if (!body.startsWith(CONFIG.prefix)) return;
    
    // Parse command and arguments
    const args = body.slice(CONFIG.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // Check bot-specific commands first
    let command = null;
    if (botCommands.has(botId)) {
        command = botCommands.get(botId).get(commandName);
    }
    
    // If no bot-specific command, check global commands
    if (!command) {
        command = commands.get(commandName);
    }
    
    if (!command) return;
    
    try {
        console.log(`⚡ [${botId}] Command: ${commandName} | User: ${senderID} | Thread: ${threadID}`);
        
        // Double-check API is still valid before executing
        if (!bot.api) {
            console.log(`⚠️ Bot ${botId} API is null, skipping command execution`);
            return;
        }
        
        // Execute command with bot API
        command.execute(bot.api, event, args, CONFIG);
    } catch (error) {
        console.error(`[${botId}] Error executing command ${commandName}:`, error);
        // Only try to send error message if API is still valid
        if (bot.api && typeof bot.api.sendMessage === 'function') {
            try {
                bot.api.sendMessage(`❌ Error: ${error.message}`, threadID, messageID);
            } catch (sendErr) {
                console.error(`[${botId}] Could not send error message:`, sendErr.message);
            }
        }
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
    console.log('📂 Loading bots...\n');
    
    try {
        let loaded = 0;
        
        // Try loading from MongoDB first
        if (db) {
            console.log('📊 Loading bots from MongoDB...');
            const botConfigs = await MongoDB.getAllBotConfigs();
            
            for (const config of botConfigs) {
                try {
                    console.log(`🔄 Loading bot: ${config.botId}...`);
                    await manager.addBot(config.botId, { appState: config.appState });
                    loaded++;
                } catch (error) {
                    console.error(`❌ Failed to load bot ${config.botId}:`, error.message);
                }
            }
        }
        
        // Fallback: Load from file system if MongoDB is not available
        if (!db || loaded === 0) {
            console.log('📁 Loading bots from file system...');
            const files = fs.readdirSync(CONFIG.botsDir);
            
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
        }
        
        if (loaded === 0) {
            console.log('\n⚠️  No bots loaded. Add bots via web interface at http://localhost:' + CONFIG.port);
        } else {
            console.log(`\n✅ Loaded ${loaded} bot(s) successfully`);
        }
    } catch (error) {
        console.error('Error loading bots:', error.message);
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
        // Verify bot still exists in manager before processing
        const currentBot = manager.getBot(botId);
        if (!currentBot || currentBot.status === 'offline') {
            console.log(`⚠️ Discarding message for removed bot: ${botId}`);
            return;
        }
        handleMessageMulti(botId, currentBot, event);
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
            const { botId, appState, password } = req.body;
            
            if (!botId || !appState) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'botId and appState are required' 
                });
            }
            
            if (!password) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'password is required to protect your bot' 
                });
            }
            
            // Add bot (this will also save to MongoDB via BotManager)
            await manager.addBot(botId, { appState, password });
            
            // Fallback: Also save to file system if MongoDB is not available
            if (!db) {
                const filePath = path.join(CONFIG.botsDir, `${botId}.json`);
                fs.writeFileSync(filePath, JSON.stringify(appState, null, 2));
            }
            
            res.json({ 
                success: true, 
                message: `Bot "${botId}" added successfully`,
                bot: manager.getBot(botId)
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.put('/api/bots/:botId', async (req, res) => {
        try {
            const { botId } = req.params;
            const { password, appState } = req.body;
            
            // Verify password
            if (!await MongoDB.verifyBotPassword(botId, password)) {
                return res.status(401).json({ success: false, error: 'Invalid password' });
            }
            
            if (!appState) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'appState is required' 
                });
            }
            
            // Get existing bot to preserve custom commands
            const existingBot = manager.getBot(botId);
            
            // Remove the old bot instance
            if (existingBot) {
                manager.removeBot(botId);
            }
            
            // Small delay for cleanup
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Re-add bot with new credentials (password is preserved in DB)
            await manager.addBot(botId, { appState });
            
            res.json({ 
                success: true, 
                message: `Bot "${botId}" credentials updated successfully`,
                bot: manager.getBot(botId)
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.delete('/api/bots/:botId', async (req, res) => {
        try {
            const { botId } = req.params;
            const { password } = req.headers;
            
            // Verify password before deletion
            if (!await MongoDB.verifyBotPassword(botId, password)) {
                return res.status(401).json({ success: false, error: 'Invalid password required to delete bot' });
            }
            
            manager.removeBot(botId);
            
            // Also delete file if it exists (for fallback compatibility)
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
            const { password } = req.body;
            
            // Verify password before restart
            if (!await MongoDB.verifyBotPassword(botId, password)) {
                return res.status(401).json({ success: false, error: 'Invalid password' });
            }
            
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
    
    // Bot Authentication API
    app.post('/api/bots/:botId/verify', async (req, res) => {
        try {
            const { botId } = req.params;
            const { password } = req.body;
            
            if (!password) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'password is required' 
                });
            }
            
            const isValid = await MongoDB.verifyBotPassword(botId, password);
            
            if (isValid) {
                res.json({ success: true, message: 'Authentication successful' });
            } else {
                res.status(401).json({ success: false, error: 'Invalid password' });
            }
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    // Bot-Specific Command Management APIs
    app.get('/api/bots/:botId/commands', async (req, res) => {
        try {
            const { botId } = req.params;
            const { password } = req.headers;
            
            // Verify password
            if (!await MongoDB.verifyBotPassword(botId, password)) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }
            
            const customCommands = await MongoDB.getAllBotCommands(botId);
            res.json({ success: true, commands: customCommands });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/bots/:botId/commands', async (req, res) => {
        try {
            const { botId } = req.params;
            const { password } = req.headers;
            const { name, description, usage, aliases, code } = req.body;
            
            // Verify password
            if (!await MongoDB.verifyBotPassword(botId, password)) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }
            
            if (!name || !code) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'name and code are required' 
                });
            }
            
            const commandData = {
                name: name.toLowerCase(),
                description: description || `Custom command: ${name}`,
                usage: usage || `${CONFIG.prefix}${name}`,
                aliases: aliases || [],
                code: code
            };
            
            await MongoDB.saveBotCommand(botId, commandData);
            
            // Reload bot commands
            await loadBotCommands(botId);
            
            res.json({ 
                success: true, 
                message: `Command "${name}" saved successfully for bot "${botId}"`,
                command: commandData
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.delete('/api/bots/:botId/commands/:name', async (req, res) => {
        try {
            const { botId, name } = req.params;
            const { password } = req.headers;
            
            // Verify password
            if (!await MongoDB.verifyBotPassword(botId, password)) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }
            
            await MongoDB.deleteBotCommand(botId, name);
            
            // Reload bot commands
            await loadBotCommands(botId);
            
            res.json({ success: true, message: `Command "${name}" deleted` });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/bots/:botId/commands/:name', async (req, res) => {
        try {
            const { botId, name } = req.params;
            const { password } = req.headers;
            
            // Verify password
            if (!await MongoDB.verifyBotPassword(botId, password)) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }
            
            const command = await MongoDB.getBotCommand(botId, name);
            
            if (!command) {
                return res.status(404).json({ 
                    success: false, 
                    error: `Command "${name}" not found` 
                });
            }
            
            res.json({ success: true, command });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
}

async function startMultiBot() {
    console.log('🤖 Starting Multi-Bot Mode...\n');
    
    // Initialize MongoDB connection
    await connectMongoDB();
    
    // Load commands (after MongoDB is connected)
    await loadCommands();
    
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
        console.log(`   • Active bots: ${stats.activeBots}`);
        console.log(`   • Storage: ${db ? 'MongoDB' : 'File System'}\n`);
        
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
    
    // Start based on mode
    if (CONFIG.mode === 'single') {
        // Load commands (don't need MongoDB for single mode)
        await loadCommands();
        startSingleBot();
    } else {
        await startMultiBot();
    }
}

// Start the application
start();

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down gracefully...');
    if (manager) {
        manager.stopAll();
    }
    if (mongoClient) {
        await mongoClient.close();
        console.log('✅ MongoDB connection closed');
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

