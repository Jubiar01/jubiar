// Main Application Logic

let autoRefreshInterval;
let currentBotId = null;
let currentBotPassword = null;

// Bot Manager Module
const BotManager = {
    async loadStats() {
        try {
            const data = await API.getStats();
            if (data.success) {
                UI.updateStats(data.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    },

    async loadBots() {
        try {
            const data = await API.getBots();
            if (data.success) {
                UI.renderBotsList(data.bots);
            }
        } catch (error) {
            console.error('Error loading bots:', error);
        }
    },

    async addBot(e) {
        e.preventDefault();
        
        const botId = document.getElementById('botId').value.trim();
        const password = document.getElementById('botPassword').value.trim();
        const appStateText = document.getElementById('appState').value.trim();
        
        try {
            const appState = JSON.parse(appStateText);
            const data = await API.addBot(botId, password, appState);
            
            if (data.success) {
                UI.showMessage(`✅ Bot "${botId}" added successfully!`, 'success');
                document.getElementById('addBotForm').reset();
                await this.loadBots();
                await this.loadStats();
            } else {
                UI.showMessage(`❌ ${data.error}`, 'error');
            }
        } catch (error) {
            UI.showMessage(`❌ ${error.message}`, 'error');
        }
    },

    async restartBot(botId) {
        if (!confirm(`Restart bot "${botId}"?`)) return;
        
        try {
            const data = await API.restartBot(botId);
            
            if (data.success) {
                UI.showMessage(`✅ Bot "${botId}" restarted!`, 'success');
                await this.loadBots();
            } else {
                UI.showMessage(`❌ ${data.error}`, 'error');
            }
        } catch (error) {
            UI.showMessage(`❌ ${error.message}`, 'error');
        }
    },

    async removeBot(botId) {
        // Prompt for password first
        const password = prompt(`⚠️ To delete bot "${botId}", please enter the bot password:`);
        if (!password) return;
        
        // Verify password
        try {
            const verifyData = await API.verifyBotPassword(botId, password);
            
            if (!verifyData.success) {
                UI.showMessage('❌ Invalid password. Bot deletion cancelled.', 'error');
                return;
            }
        } catch (error) {
            UI.showMessage('❌ Password verification failed: ' + error.message, 'error');
            return;
        }
        
        // Confirm deletion after password verification
        if (!confirm(`⚠️ Remove bot "${botId}"?\n\nThis will:\n• Stop the bot\n• Delete all configurations\n• Remove all custom commands\n\nThis action cannot be undone.`)) return;
        
        try {
            const data = await API.removeBot(botId);
            
            if (data.success) {
                UI.showMessage(`✅ Bot "${botId}" removed!`, 'success');
                await this.loadBots();
                await this.loadStats();
            } else {
                UI.showMessage(`❌ ${data.error}`, 'error');
            }
        } catch (error) {
            UI.showMessage(`❌ ${error.message}`, 'error');
        }
    },


    async manageBotPrompt(botId) {
        const password = prompt(`Enter password for bot "${botId}":`);
        if (!password) return;
        
        try {
            const data = await API.verifyBotPassword(botId, password);
            
            if (data.success) {
                currentBotId = botId;
                currentBotPassword = password;
                this.openManageModal(botId);
            } else {
                alert('❌ Invalid password');
            }
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
    },

    openManageModal(botId) {
        document.getElementById('modalBotId').textContent = botId;
        document.getElementById('manageBotModal').classList.remove('hidden');
        this.switchTab('info');
        this.loadBotInfo(botId);
    },

    closeManageModal() {
        document.getElementById('manageBotModal').classList.add('hidden');
        document.getElementById('addCommandForm').reset();
        currentBotId = null;
        currentBotPassword = null;
    },

    switchTab(tab) {
        // Update tab buttons
        document.getElementById('tabInfo').className = tab === 'info' 
            ? 'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all bg-blue-500 text-white'
            : 'flex-1 px-4 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-all';
            
        document.getElementById('tabCommands').className = tab === 'commands' 
            ? 'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all bg-blue-500 text-white'
            : 'flex-1 px-4 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-all';
        
        // Update content
        document.getElementById('contentInfo').className = tab === 'info' ? 'space-y-4' : 'hidden';
        document.getElementById('contentCommands').className = tab === 'commands' ? 'space-y-6' : 'hidden';
        
        lucide.createIcons();
        
        if (tab === 'commands') {
            CommandManager.loadCommands();
        }
    },

    async loadBotInfo(botId) {
        try {
            const data = await API.getBots();
            const bot = data.bots.find(b => b.id === botId);
            if (bot) {
                UI.renderBotInfo(bot);
            }
        } catch (error) {
            console.error('Error loading bot info:', error);
        }
    }
};

// AI Command Generator Module
const AIGenerator = {
    async generateCommand() {
        const prompt = document.getElementById('aiPrompt').value.trim();
        
        if (!prompt) {
            UI.showCommandMessage('❌ Please describe what you want the command to do', 'error');
            return;
        }
        
        const btn = document.querySelector('#aiGenBtnText');
        const originalText = btn.textContent;
        btn.textContent = 'Generating...';
        btn.parentElement.disabled = true;
        
        try {
            // Use Google Gemini 2.5 Flash AI (Free tier available)
            const GEMINI_API_KEY = 'AIzaSyDDqepLreAquC8jXZhUNjVe9N01UUlxiwQ'; // Get free key from https://makersuite.google.com/app/apikey
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are an elite Facebook Messenger bot command developer with 10+ years of experience. Generate a COMPLETE, PRODUCTION-READY JavaScript command for this request:

"${prompt}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 CRITICAL REQUIREMENTS (MUST FOLLOW ALL):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ CODE QUALITY:
• Write COMPLETE logic - NO TODO comments or placeholders
• Implement ALL features mentioned in the request
• Add comprehensive input validation
• Include detailed error messages with examples
• Use try-catch for operations that might fail
• Add helpful user feedback for every scenario
• Make code clean, efficient, and well-commented

✅ USER EXPERIENCE:
• Provide clear, friendly error messages
• Use emojis to make responses engaging (🎲 ✅ ❌ 💡 🎯 etc.)
• Add random variations for dynamic responses
• Show usage examples in error messages
• Give positive feedback on successful actions
• Make command name short, memorable, and intuitive

✅ DATA STRUCTURES:
• For random commands: Use arrays with 10-20+ diverse options
• For calculations: Handle edge cases and invalid inputs
• For games: Track state, scores, or streaks if applicable
• For information: Format output beautifully with spacing

✅ CREATIVITY:
• Be innovative and add unexpected features
• Include easter eggs or special responses
• Add personality to the bot's responses
• Think beyond basic implementation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ AVAILABLE TOOLS & VARIABLES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EVENT OBJECT:
• event.threadID - Chat/group ID where message was sent
• event.messageID - ID of the triggering message
• event.senderID - User ID who sent the message
• event.body - Full message text
• event.isGroup - Boolean if message is from a group

API METHODS:
• await api.sendMessage(text, threadID, messageID) - Send message
• await api.getUserInfo(userID) - Get user details (name, etc.)
• await api.setMessageReaction(reaction, messageID, threadID) - React to message
• await api.sendTypingIndicator(threadID) - Show "typing..." indicator

ARGS ARRAY:
• args - Array of words after command (e.g., "!cmd hello world" → ["hello", "world"])
• args.join(' ') - Combine all arguments into one string
• args[0], args[1] - Access specific arguments
• args.length - Number of arguments provided

COMMON PATTERNS:
• Random: items[Math.floor(Math.random() * items.length)]
• Validation: if (!args.length) { /* error */ return; }
• Numbers: const num = parseInt(args[0]) || parseFloat(args[0])
• Join text: const fullText = args.join(' ')
• Delays: setTimeout(() => { /* action */ }, milliseconds)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 OUTPUT FORMAT (STRICT JSON - NO MARKDOWN):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY this exact JSON structure:
{
    "name": "shortcommandname",
    "description": "Detailed description of what this command does and how it works",
    "usage": "commandname <required_arg> [optional_arg]",
    "aliases": ["alias1", "alias2", "alias3"],
    "code": "const { threadID, messageID, senderID } = event;\\n\\n// Validate input\\nif (args.length === 0) {\\n    await api.sendMessage('❌ Error: Missing argument!\\\\n\\\\n📖 Usage: commandname <arg>\\\\n💡 Example: commandname hello', threadID, messageID);\\n    return;\\n}\\n\\n// Your complete implementation here\\nconst result = 'output';\\nawait api.sendMessage(result, threadID, messageID);"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 CODE EXAMPLES FOR INSPIRATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RANDOM SELECTION:
const items = ['A', 'B', 'C'];
const choice = items[Math.floor(Math.random() * items.length)];

ERROR HANDLING:
try {
    const num = parseInt(args[0]);
    if (isNaN(num)) throw new Error('Not a number');
} catch (error) {
    await api.sendMessage('❌ Invalid input!', threadID, messageID);
    return;
}

MULTIPLE VALIDATIONS:
if (args.length === 0) {
    await api.sendMessage('❌ Please provide input!\\\\n\\\\n💡 Example: cmd text', threadID, messageID);
    return;
}
if (args.length > 10) {
    await api.sendMessage('❌ Too many arguments! Max 10.', threadID, messageID);
    return;
}

FORMATTED OUTPUT:
const output = \`🎯 Results:\\\\n━━━━━━━━━━━\\\\n\${data}\\\\n━━━━━━━━━━━\\\\n✅ Done!\`;

NOW GENERATE THE COMMAND! Make it AMAZING! 🚀`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.9,
                        topK: 50,
                        topP: 0.95,
                        maxOutputTokens: 8192,
                    }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'AI API error. Please add your Gemini API key in app.js');
            }
            
            const data = await response.json();
            let generatedText = data.candidates[0].content.parts[0].text;
            
            // Clean up the response - remove markdown code blocks if present
            generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            // Parse the JSON response
            const commandData = JSON.parse(generatedText);
            
            // Fill in the form
            document.getElementById('cmdName').value = commandData.name;
            document.getElementById('cmdDescription').value = commandData.description;
            document.getElementById('cmdUsage').value = commandData.usage;
            document.getElementById('cmdAliases').value = commandData.aliases.join(', ');
            document.getElementById('cmdCode').value = commandData.code;
            
            UI.showCommandMessage('✅ Command generated by Gemini AI! Review and save it below.', 'success');
            document.getElementById('aiPrompt').value = '';
            
        } catch (error) {
            // Fallback: Use local template generation
            console.log('Using fallback generator:', error);
            this.generateFallbackCommand(prompt);
        } finally {
            btn.textContent = originalText;
            btn.parentElement.disabled = false;
        }
    },
    
    generateFallbackCommand(prompt) {
        // Enhanced template-based generation
        const words = prompt.toLowerCase().split(' ').filter(w => w.length > 2);
        const name = words.slice(0, 2).join('').replace(/[^a-z0-9]/g, '');
        
        // Generate smarter code based on keywords
        let code;
        if (prompt.includes('random') || prompt.includes('choose') || prompt.includes('pick')) {
            code = `const { threadID, messageID } = event;

// ${prompt}
const options = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
const random = options[Math.floor(Math.random() * options.length)];

await api.sendMessage(\`🎲 \${random}\`, threadID, messageID);`;
        } else if (prompt.includes('greet') || prompt.includes('hello') || prompt.includes('hi')) {
            code = `const { threadID, messageID, senderID } = event;

const greetings = ['Hello', 'Hi', 'Hey', 'Greetings', 'Welcome'];
const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

const name = args.length > 0 ? args.join(' ') : 'there';
await api.sendMessage(\`\${randomGreeting} \${name}! 👋\`, threadID, messageID);`;
        } else if (prompt.includes('calculate') || prompt.includes('math') || prompt.includes('calc')) {
            code = `const { threadID, messageID } = event;

if (args.length === 0) {
    await api.sendMessage('❌ Please provide a math expression!\\n\\nExample: calc 5 + 3 * 2', threadID, messageID);
    return;
}

try {
    const expression = args.join(' ');
    const result = Function('"use strict"; return (' + expression + ')')();
    
    if (typeof result !== 'number' || isNaN(result)) {
        throw new Error('Invalid result');
    }
    
    await api.sendMessage(\`🧮 \${expression} = **\${result}**\`, threadID, messageID);
} catch (error) {
    await api.sendMessage('❌ Invalid math expression!', threadID, messageID);
}`;
        } else {
            code = `const { threadID, messageID, senderID } = event;

// ${prompt}

if (args.length === 0) {
    await api.sendMessage('❌ Please provide input!\\n\\nUsage: ${name} <input>', threadID, messageID);
    return;
}

const userInput = args.join(' ');
const response = \`✅ Received: \${userInput}\`;

await api.sendMessage(response, threadID, messageID);`;
        }
        
        document.getElementById('cmdName').value = name;
        document.getElementById('cmdDescription').value = prompt;
        document.getElementById('cmdUsage').value = `${name} <args>`;
        document.getElementById('cmdCode').value = code;
        
        UI.showCommandMessage('✅ Smart template generated! Review and customize the code below.', 'success');
        document.getElementById('aiPrompt').value = '';
    }
};

// Command Manager Module
const CommandManager = {
    async loadCommands() {
        try {
            const data = await API.getBotCommands(currentBotId, currentBotPassword);
            if (data.success) {
                UI.renderCommandsList(data.commands);
            }
        } catch (error) {
            UI.showCommandMessage(`❌ ${error.message}`, 'error');
        }
    },

    async saveCommand(e) {
        e.preventDefault();
        
        const name = document.getElementById('cmdName').value.trim();
        const description = document.getElementById('cmdDescription').value.trim();
        const usage = document.getElementById('cmdUsage').value.trim();
        const aliasesText = document.getElementById('cmdAliases').value.trim();
        const code = document.getElementById('cmdCode').value.trim();
        
        const aliases = aliasesText ? aliasesText.split(',').map(a => a.trim()).filter(a => a) : [];
        
        const commandData = { name, description, usage, aliases, code };
        
        try {
            const data = await API.saveBotCommand(currentBotId, currentBotPassword, commandData);
            
            if (data.success) {
                UI.showCommandMessage(`✅ Command "${name}" saved!`, 'success');
                document.getElementById('addCommandForm').reset();
                this.loadCommands();
            } else {
                UI.showCommandMessage(`❌ ${data.error}`, 'error');
            }
        } catch (error) {
            UI.showCommandMessage(`❌ ${error.message}`, 'error');
        }
    },

    async deleteCommand(name) {
        if (!confirm(`Delete command "${name}"?`)) return;
        
        try {
            const data = await API.deleteBotCommand(currentBotId, currentBotPassword, name);
            
            if (data.success) {
                UI.showCommandMessage(`✅ Command "${name}" deleted!`, 'success');
                this.loadCommands();
            } else {
                UI.showCommandMessage(`❌ ${data.error}`, 'error');
            }
        } catch (error) {
            UI.showCommandMessage(`❌ ${error.message}`, 'error');
        }
    }
};

// File Upload Utilities
const FileUpload = {
    uploadAppState() {
        document.getElementById('appStateFile').click();
    },

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                JSON.parse(content);
                document.getElementById('appState').value = content;
                UI.showMessage('✅ AppState file loaded successfully!', 'success');
            } catch (error) {
                UI.showMessage('❌ Invalid JSON file', 'error');
            }
        };
        reader.readAsText(file);
    }
};

// Global Functions (called from HTML)
function uploadAppState() {
    FileUpload.uploadAppState();
}

function handleFileUpload(event) {
    FileUpload.handleFileUpload(event);
}

function switchTab(tab) {
    BotManager.switchTab(tab);
}

function closeManageModal() {
    BotManager.closeManageModal();
}

async function refreshAll() {
    await BotManager.loadStats();
    await BotManager.loadBots();
    UI.showMessage('✅ Refreshed!', 'success');
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners
    document.getElementById('addBotForm').addEventListener('submit', (e) => BotManager.addBot(e));
    document.getElementById('addCommandForm').addEventListener('submit', (e) => CommandManager.saveCommand(e));
    
    // Initial load
    BotManager.loadStats();
    BotManager.loadBots();
    
    // Auto-refresh every 5 seconds
    autoRefreshInterval = setInterval(() => {
        BotManager.loadStats();
        BotManager.loadBots();
    }, 5000);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    });

    // Initialize Lucide icons
    lucide.createIcons();
});

