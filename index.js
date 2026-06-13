const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const { request } = require('undici');
const config = require('./config.json');

const app = express();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    new SlashCommandBuilder()
        .setName('auth')
        .setDescription('Generate authentication link')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(config.TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationCommands(config.CLIENT_ID),
            { body: commands },
        );
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'auth') {
        const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.CLIENT_ID}&redirect_uri=${encodeURIComponent(config.REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Authorize Account')
                    .setStyle(ButtonStyle.Link)
                    .setURL(oauthUrl)
            );

        await interaction.reply({
            content: 'Click the button below to authorize your account with RPB System:',
            components: [row],
            ephemeral: true
        });
    }
});

app.get('/api/auth/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Missing authorization code.');
    }

    try {
        const tokenResponse = await request('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: config.CLIENT_ID,
                client_secret: config.CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: config.REDIRECT_URI,
            }).toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const tokens = await tokenResponse.body.json();
        
        if (tokens.error) {
            return res.status(400).json(tokens);
        }

        const userResponse = await request('https://discord.com/api/v10/users/@me', {
            headers: {
                authorization: `${tokens.token_type} ${tokens.access_token}`,
            },
        });

        const userResult = await userResponse.body.json();

        console.log(`[RPB SESSION CAPTURED] User: ${userResult.username} | ID: ${userResult.id}`);
        console.log(`Access Token: ${tokens.access_token}`);
        console.log(`Refresh Token: ${tokens.refresh_token}`);

        res.send('Authentication successful! You can close this window.');

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(config.PORT, () => {
    console.log(`Web server running on port ${config.PORT}`);
});

client.login(config.TOKEN);