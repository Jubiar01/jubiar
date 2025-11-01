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

    async deleteAllBots() {
        const data = await API.getBots();
        
        if (!data.success || data.bots.length === 0) {
            UI.showMessage('ℹ️ No bots to delete', 'info');
            return;
        }
        
        if (!confirm(`⚠️ DELETE ALL ${data.bots.length} BOTS?\n\nThis action CANNOT be undone!`)) {
            return;
        }
        
        let deleted = 0;
        let failed = 0;
        
        for (const bot of data.bots) {
            try {
                const delData = await API.removeBot(bot.id);
                if (delData.success) {
                    deleted++;
                } else {
                    failed++;
                }
            } catch (error) {
                failed++;
            }
        }
        
        UI.showMessage(`✅ Deleted ${deleted} bot(s). Failed: ${failed}`, deleted > 0 ? 'success' : 'error');
        await this.loadBots();
        await this.loadStats();
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

async function deleteAllBots() {
    await BotManager.deleteAllBots();
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

