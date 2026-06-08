const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    // Definimos o comando novo aqui
    const novoComando = new SlashCommandBuilder()
        .setName('ticket') // O nome agora é /ticket, limpo e direto
        .setDescription('Abre o painel de suporte');

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        // Isso força a atualização e apaga comandos antigos que estavam bugando
        await rest.put(Routes.applicationCommands(client.user.id), { body: [novoComando] });
        console.log('✅ Comando /ticket registrado e cache limpo!');
    } catch (e) {
        console.error('Erro ao registrar:', e);
    }
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'ticket') {
        // Resposta imediata para evitar o erro de "Não respondeu"
        await i.reply({ content: 'Painel carregado com sucesso!', ephemeral: true });
        console.log('Painel solicitado.');
    }
});

client.login(process.env.DISCORD_TOKEN);
