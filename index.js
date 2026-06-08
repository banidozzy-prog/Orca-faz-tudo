const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, 
    StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
    AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits 
} = require('discord.js');
const fs = require('fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ] 
});

// Banco de Dados Simples com persistência
const DB_FILE = './database.json';
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) : {};

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getGuildConfig(guildId) {
    if (!db[guildId]) {
        db[guildId] = {
            cargo_suporte: null, cargo_admin: null,
            msg_entrada: "Seja bem-vindo(a) ao servidor, {membro}!",
            msg_saida: "{membro} saiu do servidor.",
            canal_entrada: null, canal_saida: null,
            logs_ticket: null, logs_mensagens: null, logs_punicoes: null, logs_cargos: null,
            local_conversas_texto: null, local_conversas_topico: null, opcoes_ticket: [] 
        };
        saveDB();
    }
    return db[guildId];
}

// SEUS NOVOS EMOJIS
const myEmojis = {
    suporte: "<:suporte:1513232110691942574>",
    confirmar: "<:corfimar:1513377028412280844>",
    cancelar: "<:cancelar:1513377029267914762>",
    proibido: "<:proibid:1513291681326305280>"
};

const commands = [new SlashCommandBuilder().setName('configurar').setDescription('Painel de Configuração')];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('🚀 Sistema com Emojis Novos Online!');
});

// Comando !not
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const config = getGuildConfig(message.guild.id);

    if (message.content.toLowerCase() === '!not') {
        if (config.cargo_suporte && !message.member?.roles.cache.has(config.cargo_suporte) && !message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

        let userIdTicket = message.channel.topic || (message.channel.isThread() ? (await message.channel.fetchOwner())?.id : null);

        if (userIdTicket) {
            await message.delete().catch(() => {});
            const membro = await message.guild.members.fetch(userIdTicket).catch(() => null);
            if (membro) {
                await message.channel.send(`🔔 ${membro}, a equipe de suporte respondeu!`);
                await membro.send(`🎫 **Suporte:** Responderam seu ticket no servidor **${message.guild.name}**.`).catch(() => {});
            }
        }
    }
});

client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const embed = new EmbedBuilder().setTitle(`${myEmojis.suporte} Painel Mestre`).setDescription('Configure tudo abaixo:').setColor('#2b2d31');
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_mestre_config').setPlaceholder('Escolha o módulo...')
                .addOptions([
                    { label: 'Moderação', value: 'mod_config', emoji: '🛡️' },
                    { label: 'Logs', value: 'logs_config', emoji: '📋' },
                    { label: 'Tickets', value: 'tickets_config', emoji: '🎫' }
                ])
        );
        await i.reply({ embeds: [embed], components: [menu], ephemeral: true });
    }

    if (i.isStringSelectMenu() && i.customId === 'menu_mestre_config') {
        const cat = i.values[0];
        if (cat === 'tickets_config') {
            const embed = new EmbedBuilder().setTitle(`${myEmojis.suporte} Gerenciador de Tickets`).setColor('#2b2d31');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_ticket_opcao').setLabel('Criar Opção').setStyle(ButtonStyle.Primary).setEmoji(myEmojis.confirmar),
                new ButtonBuilder().setCustomId('enviar_painel_membros').setLabel('Publicar Painel').setStyle(ButtonStyle.Success).setEmoji('📢')
            );
            await i.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
    }

    // Lógica para abrir ticket
    if (i.isStringSelectMenu() && i.customId === 'abrir_ticket_membro') {
        const opcao = config.opcoes_ticket.find(o => o.value === i.values[0]);
        const canalCriado = await i.guild.channels.create({
            name: `🎫-${opcao.label}-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [{ id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel] }]
        });
        
        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('fechar_ticket_btn').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.cancelar)
        );
        await canalCriado.send({ content: `${myEmojis.confirmar} ${i.user}, suporte iniciado.`, components: [btn] });
        await i.reply({ content: `✅ Criado em ${canalCriado}`, ephemeral: true });
    }

    if (i.isButton() && i.customId === 'fechar_ticket_btn') {
        await i.reply('Fechando...');
        setTimeout(() => i.channel.delete().catch(() => {}), 2000);
    }
});

client.login(process.env.DISCORD_TOKEN);
