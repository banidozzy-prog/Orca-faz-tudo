const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, 
    StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
    AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits 
} = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ] 
});

// Banco de dados dinâmico por Servidor
const db = new Map();

function getGuildConfig(guildId) {
    if (!db.has(guildId)) {
        db.set(guildId, {
            cargo_suporte: null,
            cargo_admin: null,
            msg_entrada: "Seja bem-vindo(a) ao servidor, {membro}! 🔔",
            msg_saida: "{membro} saiu do servidor. ❌",
            url_foto_entrada: null, 
            url_foto_ticket: null,
            canal_entrada: null,
            canal_saida: null,
            logs_ticket: null,
            logs_mensagens: null,
            logs_punicoes: null,
            logs_cargos: null,
            local_conversas_texto: null, 
            local_conversas_topico: null, 
            opcoes_ticket: [] 
        });
    }
    return db.get(guildId);
}

const cooldownsNot = new Map();

// Emojis padrão Unicode
const emojis = {
    suporte: "🎧",
    criar: "➕",
    codigo: "⚙️",
    confirmar: "✅",
    cancelar: "❌",
    proibido: "⛔",
    sino: "🔔"
};

const commands = [
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Painel de Configuração Mestre do Bot')
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('🚀 Bot com Emojis Padrão Online!');
    } catch (error) { console.error(error); }
});

// ==================== COMANDO !not ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const config = getGuildConfig(message.guild.id);

    if (message.content.toLowerCase() === '!not') {
        if (config.cargo_suporte && !message.member?.roles.cache.has(config.cargo_suporte) && !message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ content: `${emojis.cancelar} Apenas a equipe de suporte pode usar este comando.` }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000));
        }

        const guildId = message.guild.id;
        const agora = Date.now();
        const DOIS_HORAS = 2 * 60 * 60 * 1000;

        if (!cooldownsNot.has(guildId)) cooldownsNot.set(guildId, []);
        let historicoUsos = cooldownsNot.get(guildId).filter(tempo => agora - tempo < DOIS_HORAS);

        if (historicoUsos.length >= 4) {
            const minutosRestantes = Math.ceil((DOIS_HORAS - (agora - historicoUsos[0])) / (1000 * 60));
            return message.reply({ content: `⚠️ **Limite atingido!** Tente novamente em **${minutosRestantes} minutos**.` }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 7000));
        }

        let userIdTicket = message.channel.topic || (message.channel.isThread() ? (await message.channel.fetchOwner()?.catch(() => null))?.id : null);

        if (userIdTicket) {
            await message.delete().catch(() => {});
            historicoUsos.push(agora);
            cooldownsNot.set(guildId, historicoUsos);
            await message.channel.send(`${emojis.sino} <@${userIdTicket}>, a equipe de suporte respondeu!`);
        } else {
            return message.reply({ content: `${emojis.cancelar} Não encontrei o dono deste ticket.` }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000));
        }
    }
});

// ==================== PAINEL /configurar ====================
client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return i.reply({ content: `${emojis.proibido} Acesso Negado.`, ephemeral: true });

        const embedPrincipal = new EmbedBuilder()
            .setTitle(`${emojis.codigo} Central de Gerenciamento`)
            .setDescription('Configure os módulos abaixo.')
            .setColor('#4f46e5');

        const menuMestre = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_mestre_config').setPlaceholder('Escolha o módulo...')
                .addOptions([
                    { label: 'Moderação', value: 'mod_config', emoji: '🛡️' },
                    { label: 'Logs', value: 'logs_config', emoji: '📋' },
                    { label: 'Tickets', value: 'tickets_config', emoji: '🎫' }
                ])
        );
        await i.reply({ embeds: [embedPrincipal], components: [menuMestre] });
    }

    // [O restante da lógica segue exatamente o mesmo padrão, apenas troque os ids dos emojis]
    // Exemplo: Onde estava myEmojis.suporte, coloque emojis.suporte
    // Onde estava myEmojis.criar, coloque emojis.criar, e assim por diante.
});

// ==================== LÓGICA RESTANTE ====================
// (Mantenha o restante das suas funções de Botão/Modal/SelectMenu e apenas altere as referências de 'myEmojis' para 'emojis')

client.login(process.DISCORD_TOKEN);

