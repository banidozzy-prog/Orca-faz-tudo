const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, 
    SlashCommandBuilder, REST, Routes, PermissionFlagsBits 
} = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// Seus Emojis Personalizados
const emojis = {
    suporte: "<:suporte:1513232110691942574>",
    confirmar: "<:corfimar:1513377028412280844>",
    cancelar: "<:cancelar:1513377029267914762>",
    proibido: "<:proibid:1513291681326305280>",
    ticket: "💳"
};

client.once('ready', async () => {
    const commands = [
        new SlashCommandBuilder().setName('ticket').setDescription('Envia o painel de atendimento')
    ];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Sistema de Ticket Online!');
});

client.on('interactionCreate', async (i) => {
    // Comando para enviar o Painel
    if (i.isChatInputCommand() && i.commandName === 'ticket') {
        const embed = new EmbedBuilder()
            .setTitle(`${emojis.suporte} Central de Atendimento`)
            .setDescription('Clique abaixo para abrir um novo ticket de suporte.')
            .setColor('#2b2d31');
        
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('abrir_tkt')
                .setPlaceholder('Escolha o motivo do contato...')
                .addOptions([
                    { label: 'Suporte Geral', value: 'suporte', description: 'Dúvidas em geral' },
                    { label: 'Denúncia', value: 'denuncia', description: 'Reportar usuários' }
                ])
        );
        await i.reply({ embeds: [embed], components: [menu] });
    }

    // Abertura do Ticket
    if (i.isStringSelectMenu() && i.customId === 'abrir_tkt') {
        const canal = await i.guild.channels.create({
            name: `${emojis.ticket}-${i.user.username}`,
            type: 0,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        
        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('fechar')
                .setLabel('Fechar Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji(emojis.cancelar)
        );
        
        await canal.send({ 
            content: `${emojis.confirmar} ${i.user}, seu ticket foi aberto com sucesso!`, 
            components: [btn] 
        });
        
        await i.reply({ content: `✅ Ticket criado em ${canal}`, ephemeral: true });
    }

    // Fechar Ticket
    if (i.isButton() && i.customId === 'fechar') {
        await i.reply(`${emojis.confirmar} Fechando canal...`);
        setTimeout(() => i.channel.delete(), 2000);
    }
});

client.login(process.env.DISCORD_TOKEN);

