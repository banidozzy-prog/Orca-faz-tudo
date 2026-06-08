const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, StringSelectMenuBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const DB_FILE = './database.json';
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) : {};
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

const myEmojis = {
    suporte: "<:suporte:1513232110691942574>",
    confirmar: "<:corfimar:1513377028412280844>",
    cancelar: "<:cancelar:1513377029267914762>",
    proibido: "<:proibid:1513291681326305280>"
};

client.once('ready', async () => {
    const cmd = new SlashCommandBuilder().setName('configurar').setDescription('Painel Orca');
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: [cmd] });
    console.log('🚀 Orca Online!');
});

client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = db[i.guild.id] || { opcoes_ticket: [] };

    // 1. Resposta para Comandos Slash
    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        await i.deferReply({ ephemeral: true });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('add_tkt').setLabel('Criar Categoria').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('pub_tkt').setLabel('Publicar Painel').setStyle(ButtonStyle.Success)
        );
        await i.editReply({ content: 'Gerenciador Orca:', components: [row] });
    }

    // 2. Modais e Botões
    if (i.isButton()) {
        if (i.customId === 'add_tkt') {
            const modal = new ModalBuilder().setCustomId('modal_tkt').setTitle('Nova Categoria');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nome').setLabel('Nome').setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Descrição').setStyle(TextInputStyle.Short))
            );
            return i.showModal(modal);
        }
        
        if (i.customId === 'pub_tkt') {
            await i.deferReply({ ephemeral: true });
            const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('abrir_tkt').setPlaceholder('Escolha...').addOptions(config.opcoes_ticket));
            await i.channel.send({ content: 'Clique para abrir um ticket:', components: [menu] });
            await i.editReply({ content: 'Painel enviado!' });
        }
    }

    if (i.isModalSubmit() && i.customId === 'modal_tkt') {
        if (!db[i.guild.id]) db[i.guild.id] = { opcoes_ticket: [] };
        db[i.guild.id].opcoes_ticket.push({ label: i.fields.getTextInputValue('nome'), value: `tkt_${Date.now()}`, description: i.fields.getTextInputValue('desc') });
        saveDB();
        await i.reply({ content: 'Categoria salva!', ephemeral: true });
    }

    // 3. Abertura do ticket com tratamento de erro
    if (i.isStringSelectMenu() && i.customId === 'abrir_tkt') {
        await i.deferReply({ ephemeral: true });
        const canal = await i.guild.channels.create({
            name: `🎫-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [{ id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel] }]
        });
        await canal.send({ content: `${myEmojis.confirmar} ${i.user}, seu ticket foi aberto.` });
        await i.editReply({ content: `Ticket aberto em ${canal}` });
    }
});

client.login(process.env.DISCORD_TOKEN);

