require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const { login } = require('biar-fca');
const EventEmitter = require('events');
const { MongoClient } = require('mongodb');

const MONGODB_CONFIG = {
    url: process.env.MONGODB_URL,
    dbName: process.env.MONGODB_DB,
    collections: {
        bots: 'bots',
        stats: 'stats',
        commands: 'commands'
    }
};

let mongoClient = null;
let db = null;

async function connectMongoDB() {
    try {
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
        
        await db.collection(MONGODB_CONFIG.collections.bots).createIndex({ botId: 1 }, { unique: true });
        console.log('✅ MongoDB indexes created');
        
        return db;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('⚠️  Falling back to file-based storage');
        return null;
    }
}

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
            
            if (password) {
                const crypto = require('crypto');
                updateData.passwordHash = crypto.createHash('sha256').update(password).digest('hex');
            }
            
            await db.collection(MONGODB_CONFIG.collections.bots).updateOne(
                { botId },
                {
                    $set: updateData,
                    $setOnInsert: {
                        createdAt: new Date(),
                        commands: []
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
            const configs = await db.collection(MONGODB_CONFIG.collections.bots).find({}).toArray();
            return configs || [];
        } catch (error) {
            console.error('Error getting all bot configs from MongoDB:', error.message);
            return [];
        }
    },

    async deleteBotConfig(botId) {
        if (!db) return false;
        try {
            const result = await db.collection(MONGODB_CONFIG.collections.bots).deleteOne({ botId });
            console.log(`✓ MongoDB: Deleted ${result.deletedCount} bot config(s) for ${botId}`);
            return result.deletedCount > 0;
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

const CONFIG = {
    mode: null,
    appStatePath: path.join(__dirname, 'appstate.json'),
    port: 3000,
    botsDir: path.join(__dirname, 'bots'),
    commandsDir: path.join(__dirname, 'cmd'),
    prefix: '',
    adminID: [],
    protection: {
        enabled: true,
        autoRotateSession: true,
        randomUserAgent: true,
        autoMarkDelivery: true,
        autoMarkRead: true,
        updatePresence: true
    },
    keepAlive: {
        enabled: true,
        cookieRefreshInterval: 20 * 60 * 1000,
    }
};

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
                stopListening: null,
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
                bot.status = 'error';
                bot.errorMessage = err.message || 'Login failed';
                this.emit('botError', { botId, error: err });
                
                console.error(`❌ Bot "${botId}" login failed:`, err.message);
                
                return reject(err);
                }

                bot.api = api;
                bot.status = 'online';
                bot.userID = api.getCurrentUserID();
                this.stats.activeBots++;

                if (api.startOnlinePresence) {
                    bot.onlinePresence = api.startOnlinePresence(30 * 1000);
                    console.log(`✅ Online presence started for bot "${botId}" (30 seconds)`);
                }

                const originalSendMessage = api.sendMessage;
                api.sendMessage = (...args) => {
                    bot.stats.messagesSent++;
                    this.stats.totalMessagesSent++;
                    return originalSendMessage.apply(api, args);
                };

                MongoDB.saveBotConfig(botId, credentials.appState, bot.userID, credentials.password);

                loadBotCommands(botId);

                this.emit('botAdded', { botId, userID: bot.userID });

                const stopListening = api.listenMqtt((err, event) => {
                    const currentBot = this.bots.get(botId);
                    if (!currentBot || currentBot.status === 'offline' || !currentBot.api) {
                        console.log(`⚠️ Ignoring event for removed/offline bot: ${botId}`);
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

    async removeBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) {
            throw new Error(`Bot "${botId}" not found`);
        }

        console.log(`🗑️ Removing bot ${botId}...`);

        const wasOnline = bot.status === 'online';
        bot.status = 'offline';

        if (bot.onlinePresence && typeof bot.onlinePresence.stop === 'function') {
            try {
                bot.onlinePresence.stop();
                console.log(`✓ Stopped online presence for bot ${botId}`);
            } catch (error) {
                console.error(`Error stopping online presence for bot ${botId}:`, error.message);
            }
        }

        if (bot.stopListening && typeof bot.stopListening === 'function') {
            try {
                bot.stopListening();
                console.log(`✓ Stopped listening for bot ${botId}`);
            } catch (error) {
                console.error(`Error stopping listener for bot ${botId}:`, error.message);
            }
        }

        const tempApi = bot.api;
        bot.api = null;

        if (tempApi && typeof tempApi.logout === 'function') {
            try {
                console.log(`⏳ Logging out bot ${botId} (waiting for MQTT cleanup)...`);
                await tempApi.logout();
                console.log(`✓ Logged out bot ${botId}`);
            } catch (error) {
                console.error(`Error logging out bot ${botId}:`, error.message);
            }
        }

        this.bots.delete(botId);
        this.stats.totalBots = Math.max(0, this.stats.totalBots - 1);
        if (wasOnline) {
            this.stats.activeBots = Math.max(0, this.stats.activeBots - 1);
        }

        if (botCommands.has(botId)) {
            botCommands.delete(botId);
            console.log(`✓ Cleared commands for bot ${botId}`);
        }

        await MongoDB.deleteBotConfig(botId);

        this.emit('botRemoved', { botId });
        console.log(`✓ Bot ${botId} completely removed and cleaned up`);
        
        return true;
    }

    async restartBot(botId, password = null) {
        const bot = this.bots.get(botId);
        if (!bot) {
            throw new Error(`Bot "${botId}" not found`);
        }

        console.log(`🔄 Restarting bot ${botId}...`);

        let appState = null;

        if (db) {
            const config = await MongoDB.getBotConfig(botId);
            if (config && config.appState) {
                appState = config.appState;
            }
        }

        if (!appState) {
            const filePath = path.join(CONFIG.botsDir, `${botId}.json`);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Bot configuration not found for "${botId}"`);
            }
            appState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        if (botCommands.has(botId)) {
            botCommands.delete(botId);
            console.log(`✓ Cleared old commands for bot ${botId}`);
        }

        const existingBot = this.bots.get(botId);
        if (existingBot && existingBot.stopListening) {
            try {
                existingBot.stopListening();
                console.log(`✓ Force stopped old listener for ${botId}`);
            } catch (e) {
                console.error(`Error force stopping listener: ${e.message}`);
            }
        }

        if (existingBot && existingBot.onlinePresence) {
            try {
                existingBot.onlinePresence.stop();
                console.log(`✓ Force stopped old online presence for ${botId}`);
            } catch (e) {
                console.error(`Error force stopping presence: ${e.message}`);
            }
        }

        if (existingBot && existingBot.api) {
            existingBot.api = null;
        }

        await this.removeBot(botId);
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        await this.addBot(botId, { appState, password });
        
        console.log(`✅ Bot ${botId} restarted successfully`);
    }

    getBot(botId) {
        return this.bots.get(botId);
    }

    getAllBots() {
        const bots = Array.from(this.bots.values());
        return bots.filter(bot => bot !== null && bot !== undefined);
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

    async stopAll() {
        console.log('🛑 Stopping all bots...');
        const stopPromises = [];
        
        for (const [botId, bot] of this.bots) {
            const stopBot = async () => {
                try {
                    bot.status = 'offline';
                    
                    if (bot.onlinePresence && typeof bot.onlinePresence.stop === 'function') {
                        bot.onlinePresence.stop();
                    }
                    
                    if (bot.stopListening && typeof bot.stopListening === 'function') {
                        bot.stopListening();
                    }
                    
                    const tempApi = bot.api;
                    bot.api = null;
                    
                    if (tempApi && typeof tempApi.logout === 'function') {
                        console.log(`⏳ Logging out bot ${botId}...`);
                        await tempApi.logout();
                    }
                    
                    if (botCommands.has(botId)) {
                        botCommands.delete(botId);
                    }
                } catch (error) {
                    console.error(`Error stopping bot ${botId}:`, error.message);
                }
            };
            
            stopPromises.push(stopBot());
        }
        
        await Promise.all(stopPromises);
        
        this.bots.clear();
        botCommands.clear();
        this.stats.totalBots = 0;
        this.stats.activeBots = 0;
        console.log('✅ All bots stopped and MQTT connections closed');
    }
}

const commands = new Map();
const botCommands = new Map();

let manager = null;

let app = null;

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
    
    CONFIG.mode = 'multi';
    if (!fs.existsSync(botsDir)) {
        fs.mkdirSync(botsDir, { recursive: true });
    }
    console.log('🤖 Mode: Multi-Bot (no bots configured yet)');
}

async function loadCommands() {
    const cmdPath = CONFIG.commandsDir;
    let commandCount = 0;
    
    try {
        const files = fs.readdirSync(cmdPath).filter(file => file.endsWith('.js'));
        
        for (const file of files) {
            try {
                const command = require(path.join(cmdPath, file));
                if (command.name && command.execute) {
                    commands.set(command.name, command);
                    console.log(`✓ Loaded global command: ${command.name}`);
                    commandCount++;
                    
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

function monitorKeepAliveSystem(api) {
    console.log('📊 Keep-Alive Monitoring: Started\n');
    
    setInterval(() => {
        try {
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
                
                const uptimeMinutes = Math.floor(stats.timeSinceLastRefresh / 60000);
                const uptimeHours = (uptimeMinutes / 60).toFixed(1);
                console.log(`   • Bot Uptime: ${uptimeHours}h (${uptimeMinutes}m)`);
            }
            
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
    }, 10 * 60 * 1000);
}

function handleMessage(api, event) {
    const { body, threadID, messageID, senderID } = event;
    
    if (!body || typeof body !== 'string') return;
    
    if (!body.startsWith(CONFIG.prefix)) return;
    
    const args = body.slice(CONFIG.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    const command = commands.get(commandName);
    
    if (!command) return;
    
    try {
        console.log(`⚡ Command: ${commandName} | User: ${senderID} | Thread: ${threadID}`);
        
        command.execute(api, event, args, CONFIG);
    } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
        api.sendMessage(`❌ Error executing command: ${error.message}`, threadID, messageID);
    }
}

function handleMessageMulti(botId, bot, event) {
    if (!bot || !bot.api || bot.status === 'offline') {
        console.log(`⚠️ Ignoring message for removed/offline bot: ${botId}`);
        return;
    }
    
    const { body, threadID, messageID, senderID } = event;
    
    if (!body || typeof body !== 'string') return;
    
    if (!body.startsWith(CONFIG.prefix)) return;
    
    const args = body.slice(CONFIG.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    let command = null;
    if (botCommands.has(botId)) {
        command = botCommands.get(botId).get(commandName);
    }
    
    if (!command) {
        command = commands.get(commandName);
    }
    
    if (!command) return;
    
    try {
        console.log(`⚡ [${botId}] Command: ${commandName} | User: ${senderID} | Thread: ${threadID}`);
        
        if (!bot.api) {
            console.log(`⚠️ Bot ${botId} API is null, skipping command execution`);
            return;
        }
        
        command.execute(bot.api, event, args, CONFIG);
    } catch (error) {
        console.error(`[${botId}] Error executing command ${commandName}:`, error);
        if (bot.api && typeof bot.api.sendMessage === 'function') {
            try {
                bot.api.sendMessage(`❌ Error: ${error.message}`, threadID, messageID);
            } catch (sendErr) {
                console.error(`[${botId}] Could not send error message:`, sendErr.message);
            }
        }
    }
}

function startSingleBot() {
    console.log('📱 Starting Single-Bot Mode...\n');
    
    if (!fs.existsSync(CONFIG.appStatePath)) {
        console.error(`\n❌ Error: appstate.json not found at ${CONFIG.appStatePath}`);
        console.log('Please create an appstate.json file first.');
        console.log('Or create bots/ directory with bot configurations for multi-bot mode.');
        process.exit(1);
    }
    
    let appState;
    try {
        appState = JSON.parse(fs.readFileSync(CONFIG.appStatePath, 'utf8'));
    } catch (error) {
        console.error('❌ Error reading appstate.json:', error.message);
        process.exit(1);
    }
    
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
        
        if (typeof api.getProtectionStats === 'function') {
            const stats = api.getProtectionStats();
            console.log('🛡️  Protection Status: ✅ Enabled');
            console.log('🔄 Keep-Alive System: ✅ Active\n');
        }
        
        if (api.startOnlinePresence) {
            const onlinePresence = api.startOnlinePresence(30 * 1000);
            console.log('✅ Online presence started (30 seconds)\n');
        }
        
        if (CONFIG.keepAlive.enabled) {
            monitorKeepAliveSystem(api);
        }
        
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

async function loadBots() {
    console.log('📂 Loading bots...\n');
    
    try {
        let loaded = 0;
        
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
    
    app.get('/api/bots', (req, res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        const bots = manager.getAllBots().map(bot => ({
            id: bot.id,
            userID: bot.userID,
            status: bot.status,
            stats: bot.stats,
            uptime: Date.now() - bot.stats.startTime,
            errorMessage: bot.errorMessage || null
        }));
        res.json({ success: true, bots });
    });
    
    app.get('/api/stats', (req, res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
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
            
            await manager.addBot(botId, { appState, password });
            
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
            
            if (!await MongoDB.verifyBotPassword(botId, password)) {
                return res.status(401).json({ success: false, error: 'Invalid password' });
            }
            
            if (!appState) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'appState is required' 
                });
            }
            
            const existingBot = manager.getBot(botId);
            
            if (existingBot) {
                await manager.removeBot(botId);
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await manager.addBot(botId, { appState, password });
            
            if (!db) {
                const filePath = path.join(CONFIG.botsDir, `${botId}.json`);
                fs.writeFileSync(filePath, JSON.stringify(appState, null, 2));
            }
            
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
            
            if (!await MongoDB.verifyBotPassword(botId, password)) {
                return res.status(401).json({ success: false, error: 'Invalid password required to delete bot' });
            }
            
            console.log(`📡 API: Removing bot ${botId}...`);
            
            await manager.removeBot(botId);
            
            const filePath = path.join(CONFIG.botsDir, `${botId}.json`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`✓ Deleted file: ${botId}.json`);
            }
            
            res.setHeader('Cache-Control', 'no-store');
            res.json({ success: true, message: `Bot "${botId}" removed` });
            
            console.log(`✅ API: Bot ${botId} removal completed`);
        } catch (error) {
            console.error(`❌ API: Error removing bot:`, error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/bots/:botId/restart', async (req, res) => {
        try {
            const { botId } = req.params;
            const { password } = req.body;
            
            if (!await MongoDB.verifyBotPassword(botId, password)) {
                return res.status(401).json({ success: false, error: 'Invalid password' });
            }
            
            await manager.restartBot(botId, password);
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
    
    app.get('/api/bots/:botId/commands', async (req, res) => {
        try {
            const { botId } = req.params;
            const { password } = req.headers;
            
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
            
            if (!await MongoDB.verifyBotPassword(botId, password)) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }
            
            await MongoDB.deleteBotCommand(botId, name);
            
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
    
    await connectMongoDB();
    
    await loadCommands();
    
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
    
    setupMultiBotEvents();
    
    setupWebInterface();
    
    await loadBots();
    
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

async function start() {
    console.log('🤖 Starting Jubiar Bot Manager...\n');
    
    detectMode();
    
    if (CONFIG.mode === 'single') {
        await loadCommands();
        startSingleBot();
    } else {
        await startMultiBot();
    }
}

start();

process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down gracefully...');
    if (manager) {
        await manager.stopAll();
    }
    if (mongoClient) {
        await mongoClient.close();
        console.log('✅ MongoDB connection closed');
    }
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('💥 Unhandled Rejection:', error);
});
