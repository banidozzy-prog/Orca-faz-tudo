const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildInvites],
    partials: [Partials.Message, Partials.Channel]
});

const DB_FILE = './database.json';
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : {};
function salvarDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

client.once('ready', async () => {
    console.log(`Bot online: ${client.user.tag}`);
    const guildId = '1513013438975184896';
    await client.application.commands.set([]);
    await client.guilds.cache.get(guildId)?.commands.set([{ name: 'painel', description: 'Abrir painel' }]);
    console.log("Comando /painel registrado!");
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'painel') {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('menu_central')
            .setPlaceholder('Escolha o modulo...')
            .addOptions([
                { label: 'Configurar Logs', value: 'logs' },
                { label: 'Configurar Entrada', value: 'entrada' }
            ]);
        await interaction.reply({ components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_central') {
        await interaction.deferUpdate();
        const canalMenu = new ChannelSelectMenuBuilder()
            .setCustomId(`set_${interaction.values[0]}`)
            .setPlaceholder('Escolha o canal...');
        await interaction.followUp({ content: `Escolha o canal para ${interaction.values[0]}:`, components: [new ActionRowBuilder().addComponents(canalMenu)], ephemeral: true });
    }

    if (interaction.isChannelSelectMenu()) {
        await interaction.deferUpdate();
        const tipo = interaction.customId.replace('set_', '');
        if (!db[interaction.guild.id]) db[interaction.guild.id] = {};
        db[interaction.guild.id][tipo === 'logs' ? 'canal_logs' : 'canal_entrada'] = interaction.channels.first().id;
        salvarDB();
        await interaction.followUp({ content: `✅ Canal de ${tipo} configurado!`, ephemeral: true });
    }
});

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

client.on('guildMemberAdd', async (m) => {
    if (!db[m.guild.id]?.canal_entrada) return;
    const canal = m.guild.channels.cache.get(db[m.guild.id].canal_entrada);
    if (!canal) return;
    canal.send(`Seja bem-vindo(a), ${m.user.username}!`);
});

client.login(process.env.DISCORD_TOKEN);

