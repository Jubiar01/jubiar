/**
 * Help Command
 * Displays all available commands and their usage
 */

const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'help',
    description: 'Show all available commands',
    usage: '!help [command]',
    aliases: ['h', 'commands', 'cmd'],
    
    execute: async (api, event, args, config) => {
        const { threadID, messageID } = event;
        const cmdPath = path.join(__dirname);
        
        // If specific command is requested
        if (args.length > 0) {
            const commandName = args[0].toLowerCase();
            const commandFile = path.join(cmdPath, `${commandName}.js`);
            
            if (fs.existsSync(commandFile)) {
                try {
                    const command = require(commandFile);
                    const response = `📖 Command: ${command.name}\n\n` +
                                   `📝 Description: ${command.description || 'No description'}\n` +
                                   `💡 Usage: ${command.usage || 'No usage info'}\n` +
                                   (command.aliases ? `🔗 Aliases: ${command.aliases.join(', ')}\n` : '');
                    
                    api.sendMessage(response, threadID, messageID);
                } catch (error) {
                    api.sendMessage(`❌ Error loading command info: ${error.message}`, threadID, messageID);
                }
            } else {
                api.sendMessage(`❌ Command "${commandName}" not found.`, threadID, messageID);
            }
            return;
        }
        
        // Show all commands
        try {
            const files = fs.readdirSync(cmdPath).filter(file => file.endsWith('.js'));
            let commandList = '📚 Available Commands\n' +
                            `━━━━━━━━━━━━━━━━━\n\n`;
            
            for (const file of files) {
                try {
                    const command = require(path.join(cmdPath, file));
                    if (command.name) {
                        commandList += `• ${config.prefix}${command.name}`;
                        if (command.description) {
                            commandList += ` - ${command.description}`;
                        }
                        commandList += '\n';
                    }
                } catch (error) {
                    // Skip commands that fail to load
                }
            }
            
            commandList += `\n━━━━━━━━━━━━━━━━━\n` +
                          `💡 Type ${config.prefix}help [command] for more info\n` +
                          `🤖 Powered by biar-fca`;
            
            api.sendMessage(commandList, threadID, messageID);
        } catch (error) {
            api.sendMessage(`❌ Error loading commands: ${error.message}`, threadID, messageID);
        }
    }
};

