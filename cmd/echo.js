/**
 * Echo Command
 * Repeats back what the user says
 */

module.exports = {
    name: 'echo',
    description: 'Repeats your message back to you',
    usage: '!echo <message>',
    aliases: ['say', 'repeat'],
    
    execute: async (api, event, args, config) => {
        const { threadID, messageID } = event;
        
        if (args.length === 0) {
            api.sendMessage('❌ Please provide a message to echo!\n\nUsage: !echo <message>', threadID, messageID);
            return;
        }
        
        const message = args.join(' ');
        api.sendMessage(`🔊 ${message}`, threadID, messageID);
    }
};

