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
    
    // Auto Cookie Refresh Settings
    cookieRefresh: {
        enabled: true,              // Enable auto cookie refresh
        interval: 30 * 60 * 1000,   // Check every 30 minutes
        saveOnChange: true          // Auto-save appstate when cookies change
    }
};

// Command storage
const commands = new Map();

// Cookie refresh tracking
let lastCookieCheck = Date.now();
let cookieRefreshCount = 0;

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

// Auto Cookie Refresh Function
function setupCookieRefresh(api) {
    console.log('🔄 Auto Cookie Refresh: Enabled');
    console.log(`   • Check interval: ${CONFIG.cookieRefresh.interval / 1000 / 60} minutes\n`);
    
    setInterval(() => {
        try {
            // Get current appstate
            const currentAppState = api.getAppState();
            
            if (currentAppState && currentAppState.length > 0) {
                // Save updated appstate
                fs.writeFileSync(
                    CONFIG.appStatePath, 
                    JSON.stringify(currentAppState, null, 2), 
                    'utf8'
                );
                
                cookieRefreshCount++;
                const now = new Date().toLocaleTimeString();
                console.log(`🍪 [${now}] Cookie refresh #${cookieRefreshCount} - AppState updated`);
                
                // Check protection stats if available
                if (typeof api.getProtectionStats === 'function') {
                    const stats = api.getProtectionStats();
                    const uptime = Math.floor(stats.uptime / 1000 / 60); // Convert to minutes
                    console.log(`   • Requests: ${stats.requests} | Uptime: ${uptime}m`);
                }
            }
        } catch (error) {
            console.error('❌ Cookie refresh error:', error.message);
        }
    }, CONFIG.cookieRefresh.interval);
}

// Monitor Protection Stats (Optional)
function monitorProtectionStats(api) {
    setInterval(() => {
        if (typeof api.getProtectionStats === 'function') {
            const stats = api.getProtectionStats();
            const uptime = Math.floor(stats.uptime / 1000 / 60); // Minutes
            const uptimeHours = (uptime / 60).toFixed(1);
            
            console.log(`📊 Protection Stats: Requests: ${stats.requests} | Uptime: ${uptimeHours}h`);
        }
    }, 60 * 60 * 1000); // Log every hour
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
        // Advanced Protection Options (NEW in v3.6.2+)
        advancedProtection: CONFIG.protection.enabled,
        autoRotateSession: CONFIG.protection.autoRotateSession,
        randomUserAgent: CONFIG.protection.randomUserAgent,
        
        // Realistic Behavior Options
        updatePresence: CONFIG.protection.updatePresence,
        autoMarkDelivery: CONFIG.protection.autoMarkDelivery,
        autoMarkRead: CONFIG.protection.autoMarkRead,
        
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
            console.log('');
        }
        
        // Setup Auto Cookie Refresh
        if (CONFIG.cookieRefresh.enabled) {
            setupCookieRefresh(api);
        }
        
        // Start Protection Stats Monitoring
        monitorProtectionStats(api);
        
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

