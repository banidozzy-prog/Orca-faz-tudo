const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits 
} = require('discord.js');
const fs = require('fs');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const DB_FILE = './database.json';
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) : {};
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

client.once('ready', async () => {
    const cmd = new SlashCommandBuilder().setName('configurar').setDescription('Painel de Configuração Orca');
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: [cmd] });
    console.log('🚀 Orca Sistema Online (Emojis Padrão)!');
});

client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    if (!db[i.guild.id]) db[i.guild.id] = { opcoes_ticket: [] };
    const config = db[i.guild.id];

    if (i.isButton() || i.isStringSelectMenu()) await i.deferUpdate().catch(() => {});

    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Painel de Configuração Orca')
            .setDescription('Gerencie as funções do bot abaixo.')
            .setColor('#2b2d31');

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_mestre').setPlaceholder('Escolha o módulo...')
                .addOptions([{ label: 'Configurar Tickets', value: 'tkt', emoji: '🎫' }])
        );
        await i.reply({ embeds: [embed], components: [menu] });
    }

    if (i.isStringSelectMenu() && i.values[0] === 'tkt') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('add_tkt').setLabel('Criar Categoria').setStyle(ButtonStyle.Primary).setEmoji('➕'),
            new ButtonBuilder().setCustomId('pub_tkt').setLabel('Publicar Painel').setStyle(ButtonStyle.Success).setEmoji('📢')
        );
        await i.editReply({ content: 'Módulo de Tickets:', components: [row] });
    }

    if (i.isButton() && i.customId === 'add_tkt') {
        const modal = new ModalBuilder().setCustomId('modal_tkt').setTitle('Nova Categoria');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nome').setLabel('Nome').setStyle(TextInputStyle.Short)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Descrição').setStyle(TextInputStyle.Short))
        );
        return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'modal_tkt') {
        config.opcoes_ticket.push({ label: i.fields.getTextInputValue('nome'), value: `tkt_${Date.now()}`, description: i.fields.getTextInputValue('desc') });
        saveDB();
    }

    if (i.isButton() && i.customId === 'pub_tkt') {
        const embed = new EmbedBuilder().setTitle('🎫 Central de Atendimento').setDescription('Selecione abaixo:').setColor('#2b2d31');
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('abrir_tkt').setPlaceholder('Escolha...').addOptions(config.opcoes_ticket)
        );
        await i.channel.send({ embeds: [embed], components: [menu] });
    }

    if (i.isStringSelectMenu() && i.customId === 'abrir_tkt') {
        const canal = await i.guild.channels.create({
            name: `ticket-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [{ id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel] }]
        });
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fechar').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('❌'));
        await canal.send({ content: `✅ ${i.user}, ticket aberto.`, components: [btn] });
    }

    if (i.isButton() && i.customId === 'fechar') {
        await i.channel.delete().catch(() => {});
    }
});

client.login(process.env.DISCORD_TOKEN);

