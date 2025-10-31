/**
 * Ping Command
 * Tests if the bot is responsive and shows response time
 */

module.exports = {
    name: 'ping',
    description: 'Check if bot is responsive and get latency',
    usage: '!ping',
    aliases: ['p', 'test'],
    
    execute: async (api, event, args, config) => {
        const { threadID, messageID } = event;
        const startTime = Date.now();
        
        try {
            // Send initial message
            const info = await api.sendMessage('🏓 Pinging...', threadID);
            
            const latency = Date.now() - startTime;
            
            // Calculate uptime
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;
            
            // Create response message
            const response = `🤖 Bot Status\n\n` +
                           `✅ Status: Online\n` +
                           `⚡ Latency: ${latency}ms\n` +
                           `⏱️ Uptime: ${uptimeStr}\n` +
                           `📦 Node: ${process.version}\n` +
                           `💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`;
            
            // Try to edit the message with actual results
            try {
                if (api.editMessage) {
                    await api.editMessage(response, info.messageID);
                } else {
                    // If editMessage not available, send a new message
                    await api.sendMessage(response, threadID);
                }
            } catch (editErr) {
                console.error('Error editing ping message:', editErr);
                // If edit fails, send a new message
                await api.sendMessage(response, threadID);
            }
        } catch (err) {
            console.error('Error in ping command:', err);
            await api.sendMessage('❌ Error checking bot status', threadID, messageID);
        }
    }
};

