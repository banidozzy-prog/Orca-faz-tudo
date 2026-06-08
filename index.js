const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Message, Partials.Channel]
});

// --- PERSONALIZAÇÃO FÁCIL ---
const CONFIG_ENTRADA = {
    texto: "👋 Seja bem-vindo(a) ao servidor, {membro}! <:sino:1510520622625849355>",
    imagem: "LINK_DA_SUA_IMAGEM_AQUI" // Cole o link da imagem aqui
};

// Mapas de Cache
const db_canais = new Map(); 
const invitesCache = new Map();

// --- LOG: MENSAGEM APAGADA ---
client.on('messageDelete', async (message) => {
    if (message.author?.bot || !message.guild) return;
    const config = db_canais.get(message.guild.id);
    if (!config?.mensagens) return;

    const canalLog = message.guild.channels.cache.get(config.mensagens);
    const embed = new EmbedBuilder()
        .setTitle('🗑️ Mensagem Apagada')
        .setColor('#FF0000')
        .setDescription(`**Autor:** ${message.author}\n**Canal:** ${message.channel}\n**Conteúdo:** ${message.content || 'Sem texto'}`);
    
    canalLog?.send({ embeds: [embed] }).catch(() => null);
});

// --- LOG: MENSAGEM EDITADA ---
client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (oldMsg.author?.bot || !oldMsg.guild || oldMsg.content === newMsg.content) return;
    const config = db_canais.get(oldMsg.guild.id);
    if (!config?.mensagens) return;

    const canalLog = oldMsg.guild.channels.cache.get(config.mensagens);
    const embed = new EmbedBuilder()
        .setTitle('✏️ Mensagem Editada')
        .setColor('#FFFF00')
        .addFields(
            { name: 'Antes', value: oldMsg.content || 'Vazio' }, 
            { name: 'Depois', value: newMsg.content || 'Vazio' }
        );

    canalLog?.send({ embeds: [embed] }).catch(() => null);
});

// --- ENTRADA: INVITES + BOAS-VINDAS ---
client.on('guildMemberAdd', async (member) => {
    const config = db_canais.get(member.guild.id);
    if (!config?.membros) return;

    const canalLog = member.guild.channels.cache.get(config.membros);
    if (!canalLog) return;

    // Lógica de Rastreamento de Convites
    let logInvite = `📥 **${member.user.username}** entrou no servidor.`;
    try {
        const novosInvites = await member.guild.invites.fetch();
        const cacheAntigo = invitesCache.get(member.guild.id);
        const inviteUsado = novosInvites.find(inv => inv.uses > (cacheAntigo?.get(inv.code) || 0));
        
        if (inviteUsado) {
            logInvite = `📥 **${member.user.username}** foi convidado por **${inviteUsado.inviter.username}**.`;
        }
        
        const codeMap = new Map();
        novosInvites.forEach(inv => codeMap.set(inv.code, inv.uses));
        invitesCache.set(member.guild.id, codeMap);
    } catch (e) { console.error("Erro no tracking de invites:", e); }

    // Preparar Mensagem de Boas-vindas
    const textoFinal = CONFIG_ENTRADA.texto.replace('{membro}', member.toString());
    const embedBoasVindas = new EmbedBuilder()
        .setColor('#00FF7F')
        .setDescription(textoFinal)
        .setImage(CONFIG_ENTRADA.imagem);

    // Envio Separado
    await canalLog.send({ content: logInvite }).catch(() => null);
    await canalLog.send({ embeds: [embedBoasVindas] }).catch(() => null);
});

// Autenticação usando a variável de ambiente do ShardCloud
client.login(process.env.DISCORD_TOKEN);
