const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildInvites],
    partials: [Partials.Message, Partials.Channel]
});

// Carrega ou cria o banco de dados
const DB_FILE = './database.json';
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : {};
function salvarDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

client.once('ready', async () => {
    console.log(`Bot online como: ${client.user.tag}`);
    // Limpa comandos antigos e registra o novo /painel
    await client.application.commands.set([{ name: 'painel', description: 'Abrir painel de configuracao' }]);
    console.log("Comando /painel registrado com sucesso.");
});

client.on('interactionCreate', async (interaction) => {
    // Painel Principal
    if (interaction.isChatInputCommand() && interaction.commandName === 'painel') {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('menu_central')
            .setPlaceholder('Escolha um modulo...')
            .addOptions([
                { label: 'Configurar Logs', value: 'logs' },
                { label: 'Configurar Entrada', value: 'entrada' }
            ]);
        await interaction.reply({ content: '⚙️ Central de Gerenciamento:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }

    // Menu de Seleção de Canal
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_central') {
        await interaction.deferUpdate();
        const modulo = interaction.values[0];
        const canalMenu = new ChannelSelectMenuBuilder()
            .setCustomId(`confirmar_${modulo}`)
            .setPlaceholder('Selecione o canal...');
        await interaction.followUp({ content: `Selecione o canal para **${modulo}**:`, components: [new ActionRowBuilder().addComponents(canalMenu)], ephemeral: true });
    }

    // Salvamento do Canal
    if (interaction.isChannelSelectMenu()) {
        await interaction.deferUpdate();
        const modulo = interaction.customId.replace('confirmar_', '');
        const canal = interaction.channels.first();
        if (!db[interaction.guild.id]) db[interaction.guild.id] = {};
        db[interaction.guild.id][modulo === 'logs' ? 'canal_logs' : 'canal_entrada'] = canal.id;
        salvarDB();
        await interaction.followUp({ content: `✅ Sucesso! Canal de **${modulo}** configurado como <#${canal.id}>.`, ephemeral: true });
    }
});

// Eventos de Logs (Mensagens)
client.on('messageDelete', async (m) => {
    if (m.author?.bot || !db[m.guild.id]?.canal_logs) return;
    const canal = m.guild.channels.cache.get(db[m.guild.id].canal_logs);
    if (!canal) return;
    const embed = new EmbedBuilder().setTitle('Mensagem Apagada').setDescription(`Autor: ${m.author.tag}\nConteudo: ${m.content || 'Sem texto'}`);
    if (m.attachments.first()) {
        embed.setImage(m.attachments.first().url);
        embed.addFields({ name: 'Arquivo:', value: m.attachments.first().url });
    }
    canal.send({ embeds: [embed] }).catch(() => {});
});

// Evento de Entrada
client.on('guildMemberAdd', async (member) => {
    if (!db[member.guild.id]?.canal_entrada) return;
    const canal = member.guild.channels.cache.get(db[member.guild.id].canal_entrada);
    if (!canal) return;
    canal.send(`Seja bem-vindo(a) ao servidor, ${member.user.username}!`);
});

client.login(process.env.DISCORD_TOKEN);

