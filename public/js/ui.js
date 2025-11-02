// UI Module - Handles all UI updates and helper functions

const UI = {
    // Message Display
    showMessage(text, type = 'success') {
        const colors = {
            success: 'bg-green-500/20 border-green-500/50 text-green-400',
            error: 'bg-red-500/20 border-red-500/50 text-red-400',
            info: 'bg-blue-500/20 border-blue-500/50 text-blue-400'
        };
        
        const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
        
        const messageDiv = document.getElementById('message');
        messageDiv.innerHTML = `
            <div class="${colors[type]} border rounded-lg p-4 flex items-center space-x-3 animate-fade-in">
                <i data-lucide="${icon}" class="w-5 h-5"></i>
                <span>${text}</span>
            </div>
        `;
        lucide.createIcons();
        
        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 5000);
    },

    showCommandMessage(text, type = 'success') {
        const colors = {
            success: 'bg-green-500/20 border-green-500/50 text-green-400',
            error: 'bg-red-500/20 border-red-500/50 text-red-400'
        };
        
        const messageDiv = document.getElementById('commandMessage');
        messageDiv.innerHTML = `
            <div class="${colors[type]} border rounded-lg p-4 flex items-center space-x-3">
                <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-5 h-5"></i>
                <span>${text}</span>
            </div>
        `;
        lucide.createIcons();
        
        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 5000);
    },

    // Format Utilities
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    },

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    // Stats Update
    updateStats(stats) {
        document.getElementById('totalBots').textContent = stats.totalBots;
        document.getElementById('activeBots').textContent = stats.activeBots;
        document.getElementById('totalMessages').textContent = stats.totalMessagesReceived;
        document.getElementById('totalSent').textContent = stats.totalMessagesSent;
    },

    // Bots List Rendering
    renderBotsList(bots) {
        const botsList = document.getElementById('botsList');
        
        if (!Array.isArray(bots)) {
            bots = [];
        }
        
        document.getElementById('botCount').textContent = bots.length;

        botsList.innerHTML = '';

        if (bots.length === 0) {
            botsList.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <i data-lucide="bot" class="w-16 h-16 text-gray-600 mx-auto mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-400 mb-2">No bots yet</h3>
                    <p class="text-gray-500">Add your first bot using the form above</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        const statusColors = {
            online: 'bg-green-500',
            offline: 'bg-red-500',
            connecting: 'bg-yellow-500',
            error: 'bg-red-600'
        };
        
        const statusTextColors = {
            online: 'text-green-400',
            offline: 'text-red-400',
            connecting: 'text-yellow-400',
            error: 'text-red-400'
        };

        botsList.innerHTML = bots.map(bot => {
            const isError = bot.status === 'error';
            const errorMessage = bot.errorMessage || '';
            
            return `
            <div class="glass rounded-xl p-6 card hover:border-blue-500/50 ${isError ? 'border-red-500/50' : ''}">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center space-x-3">
                        <div class="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-lg">
                            <i data-lucide="bot" class="w-6 h-6 text-white"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white">${bot.id}</h3>
                            <p class="text-sm text-gray-400">ID: ${bot.userID || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="${statusColors[bot.status]} status-dot w-2 h-2 rounded-full"></span>
                        <span class="text-sm font-medium capitalize ${statusTextColors[bot.status]}">${bot.status}</span>
                    </div>
                </div>
                
                ${isError ? `
                <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <div class="flex items-start space-x-2">
                        <i data-lucide="alert-triangle" class="w-5 h-5 text-red-400 mt-0.5"></i>
                        <div class="flex-1">
                            <p class="text-red-400 font-medium text-sm">Cookie Expired or Login Error</p>
                            <p class="text-red-300 text-xs mt-1">${errorMessage}</p>
                            <button onclick="BotManager.editBotPrompt('${bot.id}')" class="mt-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1 transition-all">
                                <i data-lucide="edit" class="w-3 h-3"></i>
                                <span>Update Cookies</span>
                            </button>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <div class="grid grid-cols-3 gap-4 mb-4 bg-slate-800/30 rounded-lg p-4">
                    <div class="text-center">
                        <p class="text-2xl font-bold text-blue-400">${bot.stats.messagesReceived}</p>
                        <p class="text-xs text-gray-400 mt-1">Received</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-purple-400">${bot.stats.messagesSent}</p>
                        <p class="text-xs text-gray-400 mt-1">Sent</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-orange-400">${this.formatUptime(bot.uptime)}</p>
                        <p class="text-xs text-gray-400 mt-1">Uptime</p>
                    </div>
                </div>
                
                <div class="flex space-x-2">
                    ${!isError ? `
                    <button onclick="BotManager.manageBotPrompt('${bot.id}')" class="flex-1 btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2">
                        <i data-lucide="settings" class="w-4 h-4"></i>
                        <span>Manage</span>
                    </button>
                    ` : `
                    <button onclick="BotManager.editBotPrompt('${bot.id}')" class="flex-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition-all">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                        <span>Fix Cookies</span>
                    </button>
                    `}
                    <button onclick="BotManager.restartBotPrompt('${bot.id}')" class="glass hover:bg-yellow-500/20 px-4 py-2 rounded-lg text-yellow-400 transition-all">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                    </button>
                    <button onclick="BotManager.removeBotPrompt('${bot.id}')" class="glass hover:bg-red-500/20 px-4 py-2 rounded-lg text-red-400 transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
        }).join('');

        lucide.createIcons();
    },

    // Bot Info Rendering
    renderBotInfo(bot) {
        document.getElementById('botInfoContent').innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="glass rounded-lg p-4">
                    <p class="text-sm text-gray-400 mb-1">Bot ID</p>
                    <p class="text-lg font-bold text-white">${bot.id}</p>
                </div>
                <div class="glass rounded-lg p-4">
                    <p class="text-sm text-gray-400 mb-1">User ID</p>
                    <p class="text-lg font-bold text-white">${bot.userID || 'N/A'}</p>
                </div>
                <div class="glass rounded-lg p-4">
                    <p class="text-sm text-gray-400 mb-1">Status</p>
                    <p class="text-lg font-bold capitalize ${bot.status === 'online' ? 'text-green-400' : 'text-red-400'}">${bot.status}</p>
                </div>
                <div class="glass rounded-lg p-4">
                    <p class="text-sm text-gray-400 mb-1">Uptime</p>
                    <p class="text-lg font-bold text-white">${this.formatUptime(bot.uptime)}</p>
                </div>
                <div class="glass rounded-lg p-4">
                    <p class="text-sm text-gray-400 mb-1">Messages Received</p>
                    <p class="text-lg font-bold text-blue-400">${bot.stats.messagesReceived}</p>
                </div>
                <div class="glass rounded-lg p-4">
                    <p class="text-sm text-gray-400 mb-1">Messages Sent</p>
                    <p class="text-lg font-bold text-purple-400">${bot.stats.messagesSent}</p>
                </div>
                <div class="glass rounded-lg p-4">
                    <p class="text-sm text-gray-400 mb-1">Errors</p>
                    <p class="text-lg font-bold text-red-400">${bot.stats.errors}</p>
                </div>
            </div>
        `;
    },

    // Commands List Rendering
    renderCommandsList(commands) {
        const commandsList = document.getElementById('commandsList');

        if (commands.length === 0) {
            commandsList.innerHTML = `
                <div class="text-center py-12 glass rounded-xl">
                    <i data-lucide="code" class="w-12 h-12 text-gray-600 mx-auto mb-4"></i>
                    <h3 class="text-lg font-bold text-gray-400 mb-2">No custom commands yet</h3>
                    <p class="text-gray-500">Create your first command using the form above</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        commandsList.innerHTML = `
            <div class="glass rounded-xl p-6">
                <h3 class="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                    <i data-lucide="list" class="w-5 h-5 text-blue-400"></i>
                    <span>Custom Commands (${commands.length})</span>
                </h3>
                <div class="space-y-3">
                    ${commands.map(cmd => `
                        <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                            <div class="flex items-start justify-between mb-3">
                                <div>
                                    <h4 class="text-white font-bold text-lg">${cmd.name}</h4>
                                    ${cmd.aliases && cmd.aliases.length > 0 ? `<p class="text-sm text-gray-400">Aliases: ${cmd.aliases.join(', ')}</p>` : ''}
                                    <p class="text-sm text-gray-400 mt-1">${cmd.description || 'No description'}</p>
                                </div>
                                <button onclick="CommandManager.deleteCommand('${cmd.name}')" class="text-red-400 hover:text-red-300">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                            <div class="bg-slate-900/50 rounded p-3">
                                <pre class="text-xs text-gray-300 overflow-x-auto"><code>${this.escapeHtml(cmd.code)}</code></pre>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        lucide.createIcons();
    }
};

