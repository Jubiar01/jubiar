// API Module - Handles all backend API calls

const API = {
    // Stats API
    async getStats() {
        const response = await fetch('/api/stats');
        return await response.json();
    },

    // Bots API
    async getBots() {
        const response = await fetch('/api/bots');
        return await response.json();
    },

    async addBot(botId, password, appState) {
        const response = await fetch('/api/bots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ botId, password, appState })
        });
        return await response.json();
    },

    async updateBot(botId, password, appState) {
        const response = await fetch(`/api/bots/${botId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, appState })
        });
        return await response.json();
    },

    async removeBot(botId, password) {
        const response = await fetch(`/api/bots/${botId}`, {
            method: 'DELETE',
            headers: { 'password': password }
        });
        return await response.json();
    },

    async restartBot(botId, password) {
        const response = await fetch(`/api/bots/${botId}/restart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        return await response.json();
    },

    // Bot Authentication
    async verifyBotPassword(botId, password) {
        const response = await fetch(`/api/bots/${botId}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        return await response.json();
    },

    // Bot Commands API
    async getBotCommands(botId, password) {
        const response = await fetch(`/api/bots/${botId}/commands`, {
            headers: { 'password': password }
        });
        return await response.json();
    },

    async saveBotCommand(botId, password, commandData) {
        const response = await fetch(`/api/bots/${botId}/commands`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'password': password
            },
            body: JSON.stringify(commandData)
        });
        return await response.json();
    },

    async deleteBotCommand(botId, password, commandName) {
        const response = await fetch(`/api/bots/${botId}/commands/${commandName}`, {
            method: 'DELETE',
            headers: { 'password': password }
        });
        return await response.json();
    },

    async getBotCommand(botId, password, commandName) {
        const response = await fetch(`/api/bots/${botId}/commands/${commandName}`, {
            headers: { 'password': password }
        });
        return await response.json();
    }
};

