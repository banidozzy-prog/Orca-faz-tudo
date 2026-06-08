const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, 
    StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
    AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits 
} = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

const db = new Map();

function getGuildConfig(guildId) {
    if (!db.has(guildId)) {
        db.set(guildId, {
            cargo_suporte: null,
            cargo_admin: null,
            url_foto_ticket: null, 
            logs_ticket: null,
            local_conversas_texto: null, 
            local_conversas_topico: null, 
            opcoes_ticket: [] 
        });
    }
    return db.get(guildId);
}

const cooldownsNot = new Map();

const myEmojis = {
    suporte: "<:suporte:1513232110691942574>",
    confirmar: "<:corfimar:1513377028412280844>",
    cancelar: "<:cancelar:1513377029267914762>",
    proibido: "<:proibid:1513291681326305280>",
    criar: "➕", 
    codigo: "⚙️"  
};

const commands = [
    new SlashCommandBuilder().setName('configurar').setDescription('Painel de Configuração de Tickets')
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Orca Ticket Online!');
    } catch (e) { console.error(e); }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const config = getGuildConfig(message.guild.id);

    if (message.content.toLowerCase() === '!not') {
        if (config.cargo_suporte && !message.member?.roles.cache.has(config.cargo_suporte) && !message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

        let userIdTicket = null;
        if (message.channel.type === 0 && message.channel.topic) userIdTicket = message.channel.topic;
        else if (message.channel.isThread()) {
            const owner = await message.channel.fetchOwner();
            if (owner && owner.id !== client.user.id) userIdTicket = owner.id;
        }

        if (userIdTicket) {
            await message.delete().catch(() => {});
            const membro = await message.guild.members.fetch(userIdTicket).catch(() => null);
            if (membro) {
                await message.channel.send(`🔔 ${membro}, a equipe respondeu!`);
                await membro.send(`🎫 **Suporte:** Nova resposta no seu ticket em **${message.guild.name}**.`).catch(() => {});
            }
        }
    }
});

client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const embed = new EmbedBuilder().setTitle(`${myEmojis.suporte} Central de Configuração`).setColor('#2ed573');
        const botoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('add_ticket_opcao').setLabel('Criar Opção').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('enviar_painel_membros').setLabel('Enviar Painel').setStyle(ButtonStyle.Success)
        );
        const selects = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('sel_cargo_suporte').setPlaceholder('Cargo Suporte'));
        await i.reply({ embeds: [embed], components: [selects, botoes], ephemeral: true });
    }

    if (i.isRoleSelectMenu() && i.customId === 'sel_cargo_suporte') {
        config.cargo_suporte = i.values[0];
        await i.reply({ content: '✅ Cargo salvo!', ephemeral: true });
    }

    if (i.isButton() && i.customId === 'add_ticket_opcao') {
        const modal = new ModalBuilder().setCustomId('modal_add_ticket').setTitle('Nova Categoria').addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_nome').setLabel('Nome').setStyle(TextInputStyle.Short))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'modal_add_ticket') {
        config.opcoes_ticket.push({ label: i.fields.getTextInputValue('t_nome'), value: `tkt_${Date.now()}` });
        await i.reply({ content: '✅ Opção adicionada!', ephemeral: true });
    }

    if (i.isButton() && i.customId === 'enviar_painel_membros') {
        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('abrir_tkt').setPlaceholder('Escolha...').addOptions(config.opcoes_ticket));
        await i.channel.send({ content: 'Clique para abrir ticket:', components: [menu] });
        await i.reply({ content: '✅ Enviado!', ephemeral: true });
    }

    if (i.isStringSelectMenu() && i.customId === 'abrir_tkt') {
        const canal = await i.guild.channels.create({ name: `tkt-${i.user.username}`, type: 0 });
        canal.setTopic(i.user.id);
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fechar_tkt').setLabel('Fechar').setStyle(ButtonStyle.Danger));
        await canal.send({ content: `${i.user} <@&${config.cargo_suporte}>`, components: [btn] });
        await i.reply({ content: `✅ ${canal}`, ephemeral: true });
    }

    if (i.isButton() && i.customId === 'fechar_tkt') {
        await i.channel.delete();
    }
});

client.login(process.env.DISCORD_TOKEN);

