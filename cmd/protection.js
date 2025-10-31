/**
 * Protection Command
 * Shows advanced protection and anti-detection status
 */

module.exports = {
    name: 'protection',
    description: 'Display advanced protection status and stats',
    usage: '!protection',
    aliases: ['protect', 'shield', 'status'],
    
    execute: async (api, event, args, config) => {
        const { threadID, messageID } = event;
        
        try {
            // Check if protection API is available
            if (typeof api.getProtectionStats !== 'function') {
                api.sendMessage(
                    '⚠️ Protection API not available.\n\n' +
                    'Please make sure you are using biar-fca v3.6.2 or higher.',
                    threadID,
                    messageID
                );
                return;
            }
            
            // Get protection stats
            const stats = api.getProtectionStats();
            
            // Format uptime
            const uptimeMs = stats.uptime || 0;
            const hours = Math.floor(uptimeMs / 1000 / 60 / 60);
            const minutes = Math.floor((uptimeMs / 1000 / 60) % 60);
            const seconds = Math.floor((uptimeMs / 1000) % 60);
            const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;
            
            // Calculate next session rotation
            const sessionAge = uptimeMs;
            const sixHours = 6 * 60 * 60 * 1000;
            const timeUntilRotation = sixHours - (sessionAge % sixHours);
            const rotationHours = Math.floor(timeUntilRotation / 1000 / 60 / 60);
            const rotationMinutes = Math.floor((timeUntilRotation / 1000 / 60) % 60);
            
            // Build response message
            const response = 
                '🛡️ ADVANCED PROTECTION STATUS\n' +
                '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                
                '✅ Protection Features:\n' +
                `   • Status: ${stats.enabled ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n` +
                `   • Session Fingerprint: Active\n` +
                `   • Request Obfuscation: Active\n` +
                `   • Pattern Diffusion: Active\n` +
                `   • Traffic Resistance: Active\n` +
                `   • MQTT Protection: Active\n\n` +
                
                '📊 Session Information:\n' +
                `   • Session ID: ${stats.sessionID?.substring(0, 16)}...\n` +
                `   • Device ID: ${stats.deviceID}\n` +
                `   • Uptime: ${uptimeStr}\n` +
                `   • Total Requests: ${stats.requests || 0}\n` +
                `   • Next Rotation: ${rotationHours}h ${rotationMinutes}m\n\n` +
                
                '🔐 Protection Layers:\n' +
                '   1. ✅ Session Fingerprinting\n' +
                '   2. ✅ Auto-rotation (6hrs)\n' +
                '   3. ✅ Random User Agents\n' +
                '   4. ✅ Timing Jitter (0-100ms)\n' +
                '   5. ✅ Pattern Detection\n' +
                '   6. ✅ Adaptive Delays\n\n' +
                
                '🍪 Cookie Refresh:\n' +
                '   • Auto-refresh: Enabled\n' +
                '   • Interval: 30 minutes\n\n' +
                
                '━━━━━━━━━━━━━━━━━━━━━━\n' +
                '🤖 Powered by biar-fca v3.6.4';
            
            api.sendMessage(response, threadID, messageID);
            
        } catch (error) {
            api.sendMessage(
                `❌ Error getting protection stats: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};

