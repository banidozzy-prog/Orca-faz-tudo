const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, 
    SlashCommandBuilder, REST, Routes, PermissionFlagsBits 
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const emojis = {
    suporte: "<:suporte:1513232110691942574>",
    confirmar: "<:corfimar:1513377028412280844>",
    cancelar: "<:cancelar:1513377029267914762>",
    proibido: "<:proibid:1513291681326305280>",
    ticket: "💳"
};

client.once('ready', async () => {
    const commands = [
        new SlashCommandBuilder().setName('configurar').setDescription('Abre o painel de configuração do sistema'),
        new SlashCommandBuilder().setName('painel').setDescription('Envia o painel de tickets')
    ];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Sistema de Painéis Online!');
});

client.on('interactionCreate', async (i) => {
    // PAINEL DE CONFIGURAÇÃO (O que aparece nas fotos)
    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const embed = new EmbedBuilder()
            .setTitle(`${emojis.suporte} Central de Gerenciamento`)
            .setDescription('Gerencie as categorias e os logs do seu sistema de tickets aqui.')
            .setColor('#2b2d31')
            .addFields({ name: 'Status', value: 'Sistema Ativo' });
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_cat').setLabel('Categorias').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_logs').setLabel('Configurar Logs').setStyle(ButtonStyle.Secondary)
        );
        await i.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    // ENVIO DO PAINEL DE TICKETS
    if (i.isChatInputCommand() && i.commandName === 'painel') {
        const embed = new EmbedBuilder()
            .setTitle(`${emojis.suporte} Suporte & Atendimento`)
            .setDescription('Selecione uma opção abaixo para abrir um ticket.')
            .setColor('#2b2d31');
        
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('abrir_tkt').setPlaceholder('Selecione o assunto...')
                .addOptions([{ label: 'Suporte Técnico', value: 'suporte' }, { label: 'Financeiro', value: 'financeiro' }])
        );
        await i.reply({ embeds: [embed], components: [menu] });
    }

    // LÓGICA DE ABERTURA
    if (i.isStringSelectMenu() && i.customId === 'abrir_tkt') {
        await i.deferReply({ ephemeral: true });
        const canal = await i.guild.channels.create({
            name: `${emojis.ticket}-${i.user.username}`,
            type: 0,
            permissionOverwrites: [{ id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }]
        });
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fechar').setLabel('Fechar').setStyle(ButtonStyle.Danger).setEmoji(emojis.cancelar));
        await canal.send({ content: `${emojis.confirmar} ${i.user}, ticket aberto.`, components: [btn] });
        await i.editReply({ content: `✅ Ticket criado em ${canal}` });
    }

    if (i.isButton() && i.customId === 'fechar') {
        await i.reply('Fechando...');
        setTimeout(() => i.channel.delete(), 2000);
    }
});

client.login(process.env.DISCORD_TOKEN);
