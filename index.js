const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, 
    StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
    AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits 
} = require('discord.js');
const fs = require('fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ] 
});

// Banco de dados com persistência em arquivo
const DB_FILE = './database.json';
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) : {};

function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

function getGuildConfig(guildId) {
    if (!db[guildId]) {
        db[guildId] = {
            cargo_suporte: null, cargo_admin: null,
            msg_entrada: "Seja bem-vindo(a) ao servidor, {membro}!",
            msg_saida: "{membro} saiu do servidor.",
            url_foto_entrada: null, url_foto_ticket: null,
            canal_entrada: null, canal_saida: null,
            logs_ticket: null, logs_mensagens: null, logs_punicoes: null, logs_cargos: null,
            local_conversas_texto: null, local_conversas_topico: null, opcoes_ticket: [] 
        };
        saveDB();
    }
    return db[guildId];
}

// NOVOS EMOJIS DO MOB
const myEmojis = {
    criar: "<:criar:1513644777986330775>",
    codigo: "<:codigo:1513644777088745745>",
    sino: "<:sino:1513644776036237372>",
    editar: "<:editar:1513231224385310882>",
    suporte: "<:suporte:1513232110691942574>",
    confirmar: "<:corfimar:1513377028412280844>",
    cancelar: "<:cancelar:1513377029267914762>",
    proibido: "<:proibid:1513291681326305280>"
};

client.once('ready', async () => {
    const cmd = [new SlashCommandBuilder().setName('configurar').setDescription('Painel Orca')];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: cmd });
    console.log('🚀 Orca Sistema Atualizado com Emojis Novos!');
});

// Lógica de Interação Otimizada
client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    // Evita erros de "Interação falhou"
    if (i.isButton() || i.isStringSelectMenu() || i.isChannelSelectMenu() || i.isRoleSelectMenu()) {
        await i.deferUpdate().catch(() => {});
    }

    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const embed = new EmbedBuilder().setTitle(`${myEmojis.codigo} Central Orca`).setColor('#2b2d31');
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_mestre').setPlaceholder('Escolha o módulo...')
                .addOptions([
                    { label: 'Moderação', value: 'mod', emoji: '🛡️' },
                    { label: 'Logs', value: 'logs', emoji: '📋' },
                    { label: 'Tickets', value: 'tkt', emoji: '🎫' }
                ])
        );
        await i.reply({ embeds: [embed], components: [menu], ephemeral: true });
    }

    // Gerenciador de Tickets - Botão Criar Opção
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

    // Publicar Painel
    if (i.isButton() && i.customId === 'pub_tkt') {
        const embed = new EmbedBuilder()
            .setTitle(`${myEmojis.suporte} Central de Atendimento`)
            .setDescription('Selecione uma opção abaixo:')
            .setColor('#2b2d31');
        if (config.url_foto_ticket) embed.setImage(config.url_foto_ticket);
        
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('abrir_tkt').setPlaceholder('Escolha um assunto...').addOptions(config.opcoes_ticket)
        );
        await i.channel.send({ embeds: [embed], components: [menu] });
    }

    // Abertura de Ticket
    if (i.isStringSelectMenu() && i.customId === 'abrir_tkt') {
        const canal = await i.guild.channels.create({
            name: `🎫-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [{ id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel] }]
        });
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fechar').setLabel('Fechar').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.cancelar));
        await canal.send({ content: `${myEmojis.confirmar} ${i.user}, suporte iniciado.`, components: [btn] });
    }

    if (i.isButton() && i.customId === 'fechar') {
        await i.channel.delete().catch(() => {});
    }
});

client.login(process.env.DISCORD_TOKEN);

