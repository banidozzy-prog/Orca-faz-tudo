const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, 
    StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
    AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits 
} = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ] 
});

// Banco de dados dinâmico por Servidor
const db = new Map();
const cooldownsNot = new Map();

function getGuildConfig(guildId) {
    if (!db.has(guildId)) {
        db.set(guildId, {
            cargo_suporte: null, cargo_admin: null,
            msg_entrada: "Seja bem-vindo(a) ao servidor, {membro}! 🔔",
            msg_saida: "{membro} saiu do servidor. ❌",
            url_foto_entrada: null, url_foto_ticket: null,
            canal_entrada: null, canal_saida: null,
            logs_ticket: null, logs_mensagens: null, logs_punicoes: null, logs_cargos: null,
            local_conversas_texto: null, local_conversas_topico: null, opcoes_ticket: [] 
        });
    }
    return db.get(guildId);
}

const emojis = { suporte: "🎧", criar: "➕", codigo: "⚙️", confirmar: "✅", cancelar: "❌", proibido: "⛔", sino: "🔔" };

client.once('ready', async () => {
    // IDs dos seus servidores
    const SERVIDORES_ID = ['1513013438975184896', '1513267513008586871'];
    const commands = [new SlashCommandBuilder().setName('configurar').setDescription('Painel de Configuração Mestre')];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    for (const guildId of SERVIDORES_ID) {
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
            console.log(`🚀 Comando registrado no servidor: ${guildId}`);
        } catch (error) { console.error(`❌ Erro no servidor ${guildId}:`, error); }
    }
});

client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    // Resposta imediata para evitar erro de interação
    if (i.isButton() || i.isStringSelectMenu() || i.isChannelSelectMenu() || i.isRoleSelectMenu()) {
        await i.deferUpdate().catch(() => {});
    }

    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return i.reply({ content: `${emojis.proibido} Acesso Negado.`, ephemeral: true });

        const embed = new EmbedBuilder().setTitle(`${emojis.codigo} Central de Gerenciamento`).setDescription('Configure os módulos abaixo:').setColor('#4f46e5');
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_mestre_config').setPlaceholder('Escolha o módulo...')
                .addOptions([
                    { label: 'Moderação', value: 'mod_config', emoji: '🛡️' },
                    { label: 'Logs', value: 'logs_config', emoji: '📋' },
                    { label: 'Tickets', value: 'tickets_config', emoji: '🎫' }
                ])
        );
        await i.reply({ embeds: [embed], components: [menu] });
    }
    
    // [Aqui você mantém o restante da sua lógica de botões e modais...]
    // Nota: Lembre-se de usar 'emojis.nome' em vez de 'myEmojis.nome' no restante do seu código.
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    // [Lógica do !not]
});

client.login(process.env.DISCORD_TOKEN);

