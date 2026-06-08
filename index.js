const { 
    Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, REST, Routes, 
    StringSelectMenuBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');
const fs = require('fs');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const DB_FILE = './database.json';
let db = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) : {};
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

const myEmojis = {
    suporte: "<:suporte:1513232110691942574>",
    confirmar: "<:corfimar:1513377028412280844>",
    cancelar: "<:cancelar:1513377029267914762>",
    proibido: "<:proibid:1513291681326305280>"
};

client.once('ready', async () => {
    const cmd = new SlashCommandBuilder().setName('configurar').setDescription('Painel de Gerenciamento Orca');
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: [cmd] });
    console.log('🚀 Orca Sistema Online!');
});

client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    if (!db[i.guild.id]) db[i.guild.id] = { opcoes_ticket: [] };
    const config = db[i.guild.id];

    // COMANDO CONFIGURAR (Público)
    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('add_tkt').setLabel('Criar Categoria').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('pub_tkt').setLabel('Publicar Painel').setStyle(ButtonStyle.Success)
        );
        await i.reply({ content: `⚙️ **Painel de Configuração Orca**\nGerencie seu sistema abaixo:`, components: [row] });
    }

    // BOTÕES DO PAINEL
    if (i.isButton()) {
        if (i.customId === 'add_tkt') {
            const modal = new ModalBuilder().setCustomId('modal_tkt').setTitle('Nova Categoria');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nome').setLabel('Nome da Categoria').setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Descrição').setStyle(TextInputStyle.Short))
            );
            return i.showModal(modal);
        }
        
        if (i.customId === 'pub_tkt') {
            await i.deferReply({ ephemeral: true });
            const embed = new EmbedBuilder().setTitle(`${myEmojis.suporte} Central de Atendimento`).setDescription('Selecione uma opção abaixo para abrir seu ticket:').setColor('#2b2d31');
            const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('abrir_tkt').setPlaceholder('Escolha um assunto...').addOptions(config.opcoes_ticket));
            await i.channel.send({ embeds: [embed], components: [menu] });
            await i.editReply({ content: '✅ Painel publicado com sucesso!' });
        }
    }

    // MODAL DE SALVAMENTO
    if (i.isModalSubmit() && i.customId === 'modal_tkt') {
        config.opcoes_ticket.push({ label: i.fields.getTextInputValue('nome'), value: `tkt_${Date.now()}`, description: i.fields.getTextInputValue('desc') });
        saveDB();
        await i.reply({ content: '✅ Categoria adicionada!', ephemeral: true });
    }

    // ABERTURA DO TICKET
    if (i.isStringSelectMenu() && i.customId === 'abrir_tkt') {
        await i.deferReply({ ephemeral: true });
        const canal = await i.guild.channels.create({
            name: `🎫-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fechar').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.cancelar));
        await canal.send({ content: `${myEmojis.confirmar} ${i.user}, seu ticket foi aberto.`, components: [btn] });
        await i.editReply({ content: `✅ Ticket aberto em ${canal}` });
    }

    // FECHAR TICKET
    if (i.isButton() && i.customId === 'fechar') {
        await i.reply('Fechando canal...');
        setTimeout(() => i.channel.delete().catch(() => {}), 2000);
    }
});

client.login(process.env.DISCORD_TOKEN);
