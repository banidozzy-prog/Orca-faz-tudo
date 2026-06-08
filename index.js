const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, 
    StringSelectMenuBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');
const fs = require('fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers
    ] 
});

const DB_FILE = './database.json';
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) : {};

function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

function getGuildConfig(guildId) {
    if (!db[guildId]) {
        db[guildId] = { opcoes_ticket: [] };
        saveDB();
    }
    return db[guildId];
}

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
    console.log('🚀 Orca Sistema Online!');
});

client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    // Evita o erro de "Interação falhou"
    if (i.isButton() || i.isStringSelectMenu()) await i.deferUpdate().catch(() => {});

    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const embed = new EmbedBuilder().setTitle(`${myEmojis.suporte} Painel Mestre Orca`).setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('add_ticket_opcao').setLabel('Criar Opção').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('enviar_painel').setLabel('Publicar Painel').setStyle(ButtonStyle.Success)
        );
        await i.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (i.isButton() && i.customId === 'add_ticket_opcao') {
        const modal = new ModalBuilder().setCustomId('modal_tkt').setTitle('Nova Categoria');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_nome').setLabel('Nome').setStyle(TextInputStyle.Short)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_desc').setLabel('Descrição').setStyle(TextInputStyle.Short))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'modal_tkt') {
        config.opcoes_ticket.push({ label: i.fields.getTextInputValue('t_nome'), value: `tkt_${Date.now()}` });
        saveDB();
    }

    if (i.isButton() && i.customId === 'enviar_painel') {
        const embed = new EmbedBuilder().setTitle('Central de Atendimento').setDescription('Selecione abaixo:');
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('abrir_tkt').setPlaceholder('Escolha...').addOptions(config.opcoes_ticket)
        );
        await i.channel.send({ embeds: [embed], components: [menu] });
    }

    if (i.isStringSelectMenu() && i.customId === 'abrir_tkt') {
        const canal = await i.guild.channels.create({
            name: `🎫-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [{ id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel] }]
        });
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fechar').setLabel('Fechar').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.cancelar));
        await canal.send({ content: `${myEmojis.confirmar} ${i.user}, ticket aberto.`, components: [btn] });
    }

    if (i.isButton() && i.customId === 'fechar') {
        await i.channel.delete().catch(() => {});
    }
});

client.login(process.env.DISCORD_TOKEN);

