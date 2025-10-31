const fs = require('fs');
const path = require('path');
const { login } = require('biar-fca');

// Configuration
const CONFIG = {
    appStatePath: path.join(__dirname, 'appstate.json'),
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

// Load all commands from cmd folder
function loadCommands() {
    const cmdPath = path.join(__dirname, 'cmd');
    
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
        
        console.log(`\n📦 Total commands loaded: ${commands.size}`);
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

// Handle incoming messages
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

// Main function
function startBot() {
    console.log('🤖 Starting Jubiar Bot...\n');
    
    // Load commands
    loadCommands();
    
    // Check if appstate exists
    if (!fs.existsSync(CONFIG.appStatePath)) {
        console.error(`\n❌ Error: appstate.json not found at ${CONFIG.appStatePath}`);
        console.log('Please create an appstate.json file first.');
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
    
    // Login to Facebook with Advanced Protection
    console.log('\n🔐 Logging in to Facebook with Advanced Protection...');
    
    login({ appState }, {
        // Advanced Protection Options (v3.6.2+)
        advancedProtection: CONFIG.protection.enabled,
        autoRotateSession: CONFIG.protection.autoRotateSession,
        randomUserAgent: CONFIG.protection.randomUserAgent,
        
        // Realistic Behavior Options
        updatePresence: CONFIG.protection.updatePresence,
        autoMarkDelivery: CONFIG.protection.autoMarkDelivery,
        autoMarkRead: CONFIG.protection.autoMarkRead,
        
        // Built-in Keep-Alive System (v3.6.6+)
        cookieRefresh: CONFIG.keepAlive.enabled,              // Enable cookie refresh + MQTT keep-alive
        cookieRefreshInterval: CONFIG.keepAlive.cookieRefreshInterval, // 20 minutes default
        
        // General Options
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
        
        // Display Protection Status
        if (typeof api.getProtectionStats === 'function') {
            const protectionStats = api.getProtectionStats();
            console.log('🛡️  Protection Status:');
            console.log(`   • Enabled: ${protectionStats.enabled ? '✅ Yes' : '❌ No'}`);
            console.log(`   • Session ID: ${protectionStats.sessionID?.substring(0, 20)}...`);
            console.log(`   • Device ID: ${protectionStats.deviceID}`);
            console.log(`   • Requests: ${protectionStats.requests || 0}`);
            
            // Display Cookie Refresh Stats (v3.6.6+)
            if (protectionStats.cookieRefresh) {
                console.log('');
                console.log('🔄 Keep-Alive System:');
                console.log(`   • Cookie Refresh: ${protectionStats.cookieRefresh.enabled ? '✅ Enabled' : '❌ Disabled'}`);
                console.log(`   • MQTT Keep-Alive: ${protectionStats.cookieRefresh.mqttKeepAlive?.enabled ? '✅ Enabled' : '❌ Disabled'}`);
            }
            console.log('');
        }
        
        // Start Keep-Alive System Monitoring (v3.6.6+)
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
            
            // Handle different event types
            switch (event.type) {
                case 'message':
                case 'message_reply':
                    handleMessage(api, event);
                    break;
                
                default:
                    // Other event types can be handled here
                    break;
            }
        });
    });
}

// Start the bot
startBot();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\n👋 Bot shutting down...');
    process.exit(0);
});

