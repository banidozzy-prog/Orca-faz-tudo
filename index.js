const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, 
    ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Message, Partials.Channel]
});

const CONFIG_ENTRADA = {
    texto: "Seja bem-vindo(a) ao servidor, {membro}!",
    imagem: "" 
};

const db_canais = new Map(); 
const invitesCache = new Map();

client.once('ready', async () => {
    console.log(`Bot conectado: ${client.user.tag}`);
    await client.application.commands.set([{
        name: 'configurar',
        description: 'Define os canais de logs e boas-vindas'
    }]);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'configurar') {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('menu_config')
            .setPlaceholder('Escolha o que deseja configurar...')
            .addOptions([
                { label: 'Logs de Mensagens', value: 'logs', description: 'Canal para mensagens apagadas e editadas' },
                { label: 'Entrada de Membros', value: 'entrada', description: 'Canal para boas-vindas e convites' }
            ]);
        const row = new ActionRowBuilder().addComponents(menu);
        await interaction.reply({ content: 'Selecione uma opcao:', components: [row], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_config') {
        const escolha = interaction.values[0];
        const canalMenu = new ChannelSelectMenuBuilder()
            .setCustomId(`set_canal_${escolha}`)
            .setPlaceholder('Escolha o canal...');
        const row = new ActionRowBuilder().addComponents(canalMenu);
        await interaction.update({ content: `Selecione o canal para ${escolha === 'logs' ? 'Logs de Mensagens' : 'Entrada de Membros'}:`, components: [row] });
    }

    if (interaction.isChannelSelectMenu()) {
        const canal = interaction.channels.first();
        const tipo = interaction.customId.replace('set_canal_', '');
        const guildId = interaction.guild.id;

        if (!db_canais.has(guildId)) db_canais.set(guildId, {});
        if (tipo === 'logs') db_canais.get(guildId).mensagens = canal.id;
        if (tipo === 'entrada') db_canais.get(guildId).membros = canal.id;

        await interaction.update({ content: `Sucesso! Canal de ${tipo} definido como <#${canal.id}>.`, components: [] });
    }
});

client.on('messageDelete', async (message) => {
    if (message.author?.bot || !message.guild) return;
    const config = db_canais.get(message.guild.id);
    if (!config?.mensagens) return;

    const canalLog = message.guild.channels.cache.get(config.mensagens);
    const embed = new EmbedBuilder()
        .setTitle('Mensagem Apagada')
        .setColor(0xFF0000)
        .setDescription(`Autor: ${message.author}\nCanal: ${message.channel}\nConteudo: ${message.content || 'Sem texto'}`);
    
    const attachment = message.attachments.first();
    if (attachment) {
        embed.addFields({ name: 'Arquivo ou Imagem:', value: attachment.url });
        embed.setImage(attachment.url);
    }
    
    canalLog?.send({ embeds: [embed] }).catch(() => null);
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (oldMsg.author?.bot || !oldMsg.guild || oldMsg.content === newMsg.content) return;
    const config = db_canais.get(oldMsg.guild.id);
    if (!config?.mensagens) return;

    const canalLog = oldMsg.guild.channels.cache.get(config.mensagens);
    const embed = new EmbedBuilder()
        .setTitle('Mensagem Editada')
        .setColor(0xFFFF00)
        .addFields({ name: 'Antes', value: oldMsg.content || 'Vazio' }, { name: 'Depois', value: newMsg.content || 'Vazio' });
    canalLog?.send({ embeds: [embed] }).catch(() => null);
});

client.on('guildMemberAdd', async (member) => {
    const config = db_canais.get(member.guild.id);
    if (!config?.membros) return;

    const canalLog = member.guild.channels.cache.get(config.membros);
    if (!canalLog) return;

    let logInvite = `${member.user.username} entrou no servidor.`;
    try {
        const novosInvites = await member.guild.invites.fetch();
        const cacheAntigo = invitesCache.get(member.guild.id);
        const inviteUsado = novosInvites.find(inv => inv.uses > (cacheAntigo?.get(inv.code) || 0));
        
        if (inviteUsado) {
            logInvite = `${member.user.username} foi convidado por ${inviteUsado.inviter.username}.`;
        }
        
        const codeMap = new Map();
        novosInvites.forEach(inv => codeMap.set(inv.code, inv.uses));
        invitesCache.set(member.guild.id, codeMap);
    } catch (e) { console.error("Erro no rastreamento de convites:", e); }

    const textoFinal = CONFIG_ENTRADA.texto.replace('{membro}', member.toString());
    const embedBoasVindas = new EmbedBuilder()
        .setColor(0x00FF7F)
        .setDescription(textoFinal);
    if (CONFIG_ENTRADA.imagem) embedBoasVindas.setImage(CONFIG_ENTRADA.imagem);

    await canalLog.send({ content: logInvite }).catch(() => null);
    await canalLog.send({ embeds: [embedBoasVindas] }).catch(() => null);
});

client.login(process.env.DISCORD_TOKEN);

