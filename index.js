// 1. ALTERE O REGISTRO DO COMANDO NO client.once('ready')
client.once('ready', async () => {
    const SERVIDORES_ID = ['1513013438975184896', '1513267513008586871'];
    
    // MUDOU AQUI: Agora o nome é "painel"
    const commands = [
        new SlashCommandBuilder()
            .setName('painel')
            .setDescription('Abrir o painel de configuração do bot')
    ];
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    for (const guildId of SERVIDORES_ID) {
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
            console.log(`🚀 Comando /painel registrado em: ${guildId}`);
        } catch (error) { console.error(`❌ Erro no servidor ${guildId}:`, error); }
    }
});

// 2. ALTERE A VERIFICAÇÃO NO interactionCreate
client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    // ADICIONEI O deferUpdate AQUI PARA SUMIR O ERRO DE INTERAÇÃO
    if (i.isButton() || i.isStringSelectMenu() || i.isChannelSelectMenu() || i.isRoleSelectMenu()) {
        await i.deferUpdate().catch(() => {});
    }

    // MUDOU AQUI: Verifica por i.commandName === 'painel'
    if (i.isChatInputCommand() && i.commandName === 'painel') {
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({ content: `${emojis.proibido} Acesso Negado.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${emojis.codigo} Central de Gerenciamento`)
            .setDescription('Configure os módulos abaixo:')
            .setColor('#4f46e5');

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu_mestre_config')
                .setPlaceholder('Escolha o módulo...')
                .addOptions([
                    { label: 'Moderação', value: 'mod_config', emoji: '🛡️' },
                    { label: 'Logs', value: 'logs_config', emoji: '📋' },
                    { label: 'Tickets', value: 'tickets_config', emoji: '🎫' }
                ])
        );
        
        // Respondendo o comando /painel
        await i.reply({ embeds: [embed], components: [menu] });
    }

    // O resto do seu código (ifs de StringSelectMenu, botões, etc) continua igual!
});
