const { 
    Client, 
    GatewayIntentBits, 
    Partials,
    ActionRowBuilder, 
    ChannelSelectMenuBuilder, 
    RoleSelectMenuBuilder, 
    ChannelType, 
    EmbedBuilder, 
    PermissionFlagsBits,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Banco de dados em memória e cache de convites
const db_canais = new Map();
const invitesCache = new Map(); 

// --- FUNÇÃO DE VERIFICAÇÃO DE PERMISSÃO DE COMANDOS ---
function temPermissao(interaction) {
    const guildId = interaction.guild.id;
    const config = db_canais.get(guildId);
    
    if (interaction.user.id === interaction.guild.ownerId) return true;
    if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;

    if (config && config.cargoStaffId) {
        if (interaction.member.roles.cache.has(config.cargoStaffId)) return true;
    }

    return false;
}

// Função para mapear e carregar os convites do servidor para a memória
const carregarInvitesDoServidor = async (guild) => {
    try {
        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) return;
        
        const invites = await guild.invites.fetch();
        const codeMap = new Map();
        invites.forEach(inv => codeMap.set(inv.code, inv.uses));
        
        if (guild.features.includes('VANITY_URL')) {
            const vanity = await guild.fetchVanityData().catch(() => null);
            if (vanity) codeMap.set('VANITY_CODE', vanity.uses);
        }

        invitesCache.set(guild.id, codeMap);
    } catch (err) {
        console.error(`Erro ao carregar convites de ${guild.name}:`, err);
    }
};

// --- FUNÇÃO PARA REGISTRAR O COMANDO /CONFIGURAR NO DISCORD ---
const registarComandos = async (guildId) => {
    const comandos = [
        new SlashCommandBuilder()
            .setName('configurar')
            .setDescription('Configura o sistema de logs e permissões da Orca.')
    ].map(cmd => cmd.toJSON());

    // Puxa a variável DISCORD_TOKEN direto do painel oculto da ShardCloud
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`⏳ Registrando comandos de barra para o servidor: ${guildId}`);
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, guildId),
            { body: comandos }
        );
        console.log('✅ Comando /configurar registrado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
};

client.once('ready', async () => {
    console.log(`🐳 Orca Bot online como ${client.user.tag}`);
    for (const guild of client.guilds.cache.values()) {
        await carregarInvitesDoServidor(guild);
        await registarComandos(guild.id).catch(() => null);
    }
});

// Comando de texto para forçar o registro caso o Discord trave o cache visual
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    if (message.content === '!registar') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        await registarComandos(message.guild.id);
        message.reply('🔄 Comando `/configurar` foi forçado a registrar neste servidor!');
    }
});

client.on('inviteCreate', async (invite) => await carregarInvitesDoServidor(invite.guild));
client.on('inviteDelete', async (invite) => await carregarInvitesDoServidor(invite.guild));

// --- COMANDO /CONFIGURAR ---
async function executarConfigurar(interaction) {
    if (!temPermissao(interaction)) {
        return interaction.reply({ content: '⚠️ Você não tem permissão para usar os comandos deste bot.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Configuração do Sistema de Logs - Orca')
        .setDescription('Selecione abaixo os canais correspondentes e o cargo permitido para gerenciar o bot.')
        .setColor('#00AAFF');

    const menuMensagens = new ChannelSelectMenuBuilder()
        .setCustomId('log_mensagens')
        .setPlaceholder('Selecione o canal para logs de Mensagens')
        .addChannelTypes(ChannelType.GuildText);

    const menuMembros = new ChannelSelectMenuBuilder()
        .setCustomId('log_membros')
        .setPlaceholder('Selecione o canal para logs de Membros e Invites')
        .addChannelTypes(ChannelType.GuildText);

    const menuCargo = new RoleSelectMenuBuilder()
        .setCustomId('cargo_staff')
        .setPlaceholder('Selecione o cargo que pode usar o bot');

    const row1 = new ActionRowBuilder().addComponents(menuMensagens);
    const row2 = new ActionRowBuilder().addComponents(menuMembros);
    const row3 = new ActionRowBuilder().addComponents(menuCargo);

    await interaction.reply({ embeds: [embed], components: [row1, row2, row3], ephemeral: true });
}

// --- ESCUTANDO AS INTERAÇÕES ---
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'configurar') {
        return executarConfigurar(interaction);
    }

    if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
        if (!temPermissao(interaction)) {
            return interaction.reply({ content: '⚠️ Você não tem permissão para alterar as configurações.', ephemeral: true });
        }

        const guildId = interaction.guild.id;
        if (!db_canais.has(guildId)) {
            db_canais.set(guildId, { mensagens: null, membros: null, cargoStaffId: null });
        }

        const configAtual = db_canais.get(guildId);

        if (interaction.customId === 'log_mensagens') {
            configAtual.mensagens = interaction.values[0];
            await interaction.reply({ content: `✅ Canal de logs de **Mensagens** definido com sucesso para <#${interaction.values[0]}>!`, ephemeral: true });
        }

        if (interaction.customId === 'log_membros') {
            configAtual.membros = interaction.values[0];
            await interaction.reply({ content: `✅ Canal de logs de **Membros e Invites** definido com sucesso para <#${interaction.values[0]}>!`, ephemeral: true });
        }

        if (interaction.customId === 'cargo_staff') {
            configAtual.cargoStaffId = interaction.values[0];
            await interaction.reply({ content: `✅ Cargo permitido definido com sucesso para: <@&${interaction.values[0]}>!`, ephemeral: true });
        }

        db_canais.set(guildId, configAtual);
    }
});

// --- EVENTO: MENSAGEM APAGADA ---
client.on('messageDelete', async message => {
    if (message.author?.bot || !message.guild) return;

    const servidorConfig = db_canais.get(message.guild.id);
    if (!servidorConfig || !servidorConfig.mensagens) return;

    const canalLog = message.guild.channels.cache.get(servidorConfig.mensagens);
    if (!canalLog) return;

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Mensagem Apagada')
        .setColor('#FF0000')
        .setDescription(`**Autor:** ${message.author} (\`${message.author.id}\`)\n**Canal:** ${message.channel}`)
        .setTimestamp();

    if (message.content) {
        embed.addFields({ name: '📝 Conteúdo do Texto:', value: message.content });
    }

    if (message.attachments.size > 0) {
        const anexo = message.attachments.first();
        if (anexo.contentType?.startsWith('image/')) {
            embed.addFields({ name: '🖼️ Arquivo Anexado:', value: `Uma imagem foi apagada (\`${anexo.name}\`)` });
            embed.setImage(anexo.proxyURL); 
        } else {
            embed.addFields({ name: '📁 Outro Arquivo Apagado:', value: `Arquivo: \`${anexo.name}\`` });
        }
    }

    if (!message.content && message.attachments.size === 0) {
        embed.addFields({ name: 'Aviso:', value: '*Não foi possível carregar os dados desta mensagem (Muito antiga ou disparada antes do bot ligar).*' });
    }

    canalLog.send({ embeds: [embed] }).catch(() => null);
});

// --- EVENTO: MENSAGEM EDITADA ---
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (oldMessage.author?.bot || !oldMessage.guild) return;
    if (oldMessage.content === newMessage.content) return;

    const servidorConfig = db_canais.get(oldMessage.guild.id);
    if (!servidorConfig || !servidorConfig.mensagens) return;

    const canalLog = oldMessage.guild.channels.cache.get(servidorConfig.mensagens);
    if (!canalLog) return;

    const embed = new EmbedBuilder()
        .setTitle('✏️ Mensagem Editada')
        .setColor('#FFFF00')
        .setDescription(`**Autor:** ${oldMessage.author}\n**Canal:** ${oldMessage.channel}`)
        .addFields(
            { name: 'Antes:', value: oldMessage.content || 'Vazio' },
            { name: 'Depois:', value: newMessage.content || 'Vazio' }
        )
        .setTimestamp();

    canalLog.send({ embeds: [embed] }).catch(() => null);
});

// --- EVENTO: ENTRADA DE MEMBRO ---
client.on('guildMemberAdd', async member => {
    const servidorConfig = db_canais.get(member.guild.id);
    if (!servidorConfig || !servidorConfig.membros) return;

    const canalLog = member.guild.channels.cache.get(servidorConfig.membros);
    if (!canalLog) return;

    let mensagemFinal = `📥 ${member.user.username} entrou no servidor.`;

    try {
        const novosInvites = await member.guild.invites.fetch();
        const cacheAntigo = invitesCache.get(member.guild.id);
        
        let entrouPorVanity = false;

        if (member.guild.features.includes('VANITY_URL') && cacheAntigo) {
            const vanityNova = await member.guild.fetchVanityData().catch(() => null);
            const usosAntigosVanity = cacheAntigo.get('VANITY_CODE') || 0;
            
            if (vanityNova && vanityNova.uses > usosAntigosVanity) {
                entrouPorVanity = true;
            }
        }

        if (entrouPorVanity) {
            mensagemFinal = `📥 ${member.user.username} entrou usando o link personalizado do servidor.`;
        } else if (cacheAntigo) {
            const inviteUsado = novosInvites.find(inv => inv.uses > (cacheAntigo.get(inv.code) || 0));
            
            if (inviteUsado) {
                const inviter = inviteUsado.inviter;
                const todosOsInvitesDoMembro = novosInvites.filter(inv => inv.inviter && inv.inviter.id === inviter.id);
                const totalConvites = todosOsInvitesDoMembro.reduce((total, inv) => total + inv.uses, 0);

                mensagemFinal = `📥 ${member} foi convidado por **${inviter.username}** (atualmente tem ${totalConvites} invites).`;
            }
        }
        
        const codeMap = new Map();
        novosInvites.forEach(inv => codeMap.set(inv.code, inv.uses));
        if (member.guild.features.includes('VANITY_URL')) {
            const vanity = await member.guild.fetchVanityData().catch(() => null);
            if (vanity) codeMap.set('VANITY_CODE', vanity.uses);
        }
        invitesCache.set(member.guild.id, codeMap);

    } catch (err) {
        console.error("Erro ao checar os convites:", err);
    }

    canalLog.send({ content: mensagemFinal }).catch(() => null);
});

// --- EVENTO: SAÍDA DE MEMBRO ---
client.on('guildMemberRemove', async member => {
    const servidorConfig = db_canais.get(member.guild.id);
    if (!servidorConfig || !servidorConfig.membros) return;

    const canalLog = member.guild.channels.cache.get(servidorConfig.membros);
    if (!canalLog) return;

    const embed = new EmbedBuilder()
        .setTitle('📤 Saída de Membro')
        .setColor('#FF5555')
        .setDescription(`O usuário ${member} (${member.user.tag}) saiu do servidor ou foi expulso.`)
        .setTimestamp();

    canalLog.send({ embeds: [embed] }).catch(() => null);
});

// Conecta de forma totalmente segura
client.login(process.env.DISCORD_TOKEN);

