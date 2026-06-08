const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, 
    ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder 
} = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Message, Partials.Channel]
});

// Carrega o banco de dados
let db = fs.existsSync('./database.json') ? JSON.parse(fs.readFileSync('./database.json', 'utf8')) : {};
function salvarDB() { fs.writeFileSync('./database.json', JSON.stringify(db, null, 2)); }

client.once('ready', async () => {
    console.log(`Bot online: ${client.user.tag}`);
    await client.application.commands.set([{ name: 'configurar', description: 'Painel de configuracao' }]);
});

client.on('interactionCreate', async (interaction) => {
    // 1. Comando principal
    if (interaction.isChatInputCommand() && interaction.commandName === 'configurar') {
        await interaction.deferReply({ ephemeral: true });
        const menu = new StringSelectMenuBuilder()
            .setCustomId('menu_config')
            .setPlaceholder('Escolha o que configurar...')
            .addOptions([
                { label: 'Logs de Mensagens', value: 'logs' },
                { label: 'Entrada de Membros', value: 'entrada' }
            ]);
        await interaction.editReply({ content: 'Selecione uma opcao:', components: [new ActionRowBuilder().addComponents(menu)] });
    }

    // 2. Menu de escolha
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_config') {
        const canalMenu = new ChannelSelectMenuBuilder()
            .setCustomId(`set_${interaction.values[0]}`)
            .setPlaceholder('Escolha o canal...');
        await interaction.update({ content: `Definindo canal para ${interaction.values[0]}:`, components: [new ActionRowBuilder().addComponents(canalMenu)] });
    }

    // 3. Salvamento do canal
    if (interaction.isChannelSelectMenu()) {
        const canal = interaction.channels.first();
        const tipo = interaction.customId.replace('set_', '');
        if (!db[interaction.guild.id]) db[interaction.guild.id] = { logs: '', entrada: '' };
        db[interaction.guild.id][tipo] = canal.id;
        salvarDB();
        await interaction.update({ content: `Sucesso! Canal de ${tipo} definido para <#${canal.id}>.`, components: [] });
    }
});

// Logs de deletar
client.on('messageDelete', async (m) => {
    if (m.author?.bot || !db[m.guild.id]?.logs) return;
    const canal = m.guild.channels.cache.get(db[m.guild.id].logs);
    if (!canal) return;
    const embed = new EmbedBuilder().setTitle('Mensagem Apagada').setDescription(`Autor: ${m.author.tag}\nConteudo: ${m.content || 'Sem texto'}`);
    if (m.attachments.first()) {
        embed.addFields({ name: 'Arquivo:', value: m.attachments.first().url });
        embed.setImage(m.attachments.first().url);
    }
    canal.send({ embeds: [embed] }).catch(() => {});
});

// Logs de editar
client.on('messageUpdate', async (old, now) => {
    if (old.author?.bot || !db[old.guild.id]?.logs || old.content === now.content) return;
    const canal = old.guild.channels.cache.get(db[old.guild.id].logs);
    if (!canal) return;
    canal.send(`Mensagem editada por ${old.author.tag}:\nAntes: ${old.content}\nDepois: ${now.content}`).catch(() => {});
});

// Entrada de membros
client.on('guildMemberAdd', async (member) => {
    if (!db[member.guild.id]?.entrada) return;
    const canal = member.guild.channels.cache.get(db[member.guild.id].entrada);
    if (!canal) return;
    canal.send(`Seja bem-vindo(a) ao servidor, ${member.user.username}!`);
});

client.login(process.env.DISCORD_TOKEN);

