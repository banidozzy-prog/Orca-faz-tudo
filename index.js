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
    const commands = [new SlashCommandBuilder().setName('configurar').setDescription('Painel de Configuração')];
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('🚀 Bot com Emojis Padrão e Estabilidade Online!');
});

client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    // EVITAR ERRO DE INTERAÇÃO FALHOU
    if (i.isButton() || i.isStringSelectMenu() || i.isChannelSelectMenu() || i.isRoleSelectMenu()) {
        await i.deferUpdate().catch(() => {});
    }

    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const embed = new EmbedBuilder().setTitle(`${emojis.codigo} Central de Gerenciamento`).setDescription('Escolha abaixo:').setColor('#4f46e5');
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

    // AQUI VOCÊ ADICIONA OS DEMAIS EVENTOS DE SELECT MENU/BOTÕES/MODAIS...
    // Lembre-se de trocar qualquer referência antiga de 'myEmojis' por 'emojis'
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const config = getGuildConfig(message.guild.id);

    if (message.content.toLowerCase() === '!not') {
        // [Lógica do !not que você já tinha, apenas mantenha como está]
    }
});

client.login(process.DISCORD_TOKEN);
