require('dotenv').config(); // Carrega o token do arquivo .env
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
        GatewayIntentBits.MessageContent
    ] 
});

// Banco de dados dinâmico por Servidor (Apenas Tickets e Logs)
const db = new Map();

function getGuildConfig(guildId) {
    if (!db.has(guildId)) {
        db.set(guildId, {
            cargo_suporte: null,
            cargo_admin: null,
            url_foto_ticket: null, 
            logs_ticket: null,
            local_conversas_texto: null, 
            local_conversas_topico: null, 
            opcoes_ticket: [] 
        });
    }
    return db.get(guildId);
}

// Controle de Cooldown para o !not (4 usos a cada 2 horas por servidor)
const cooldownsNot = new Map();

// ==================== SEUS EMOJIS ATUALIZADOS ====================
const myEmojis = {
    suporte: "<:suporte:1513232110691942574>",
    confirmar: "<:corfimar:1513377028412280844>",
    cancelar: "<:cancelar:1513377029267914762>",
    proibido: "<:proibid:1513291681326305280>",
    criar: "➕", 
    codigo: "⚙️"  
};

const commands = [
    new SlashCommandBuilder()
        .setName('configurar')
        .setDescription('Painel de Configuração do Sistema de Tickets')
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // Registra os comandos slash globalmente para funcionar em qualquer servidor
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('⚙️ Orca Ticket carregado perfeitamente com seus emojis!');
    } catch (error) { 
        console.error('Erro ao sincronizar os comandos slash:', error); 
    }
});

// ==================== COMANDO MANUAL DE NOTIFICAÇÃO (!not) ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const config = getGuildConfig(message.guild.id);

    if (message.content.toLowerCase() === '!not') {
        if (config.cargo_suporte && !message.member?.roles.cache.has(config.cargo_suporte) && !message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ content: `❌ Apenas a equipe de suporte pode usar este comando.` })
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000));
        }

        const guildId = message.guild.id;
        const agora = Date.now();
        const DOIS_HORAS = 2 * 60 * 60 * 1000;

        if (!cooldownsNot.has(guildId)) cooldownsNot.set(guildId, []);
        let historicoUsos = cooldownsNot.get(guildId).filter(tempo => agora - tempo < DOIS_HORAS);

        if (historicoUsos.length >= 4) {
            const minutosRestantes = Math.ceil((DOIS_HORAS - (agora - historicoUsos[0])) / (1000 * 60));
            return message.reply({ content: `⚠️ **Limite atingido!** O comando \`!not\` só pode ser usado 4 vezes a cada 2 horas. Aguarde **${minutosRestantes} minutos**.` })
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 7000));
        }

        let userIdTicket = null;
        if (message.channel.type === ChannelType.GuildText && message.channel.topic) {
            userIdTicket = message.channel.topic;
        } else if (message.channel.isThread()) {
            const owner = await message.channel.fetchOwner();
            if (owner && owner.id !== client.user.id) userIdTicket = owner.id;
        }

        if (userIdTicket) {
            await message.delete().catch(() => {});
            const membro = await message.guild.members.fetch(userIdTicket).catch(() => null);
            if (membro) {
                historicoUsos.push(agora);
                cooldownsNot.set(guildId, historicoUsos);
                await message.channel.send(`🔔 ${membro}, a nossa equipe respondeu ao seu chamado!`);
                await membro.send(`🎫 **Suporte:** Nova resposta no seu ticket em **${message.guild.name}**: ${message.channel}`).catch(() => {});
            }
        }
    }
});

// ==================== PAINEL DE CONFIGURAÇÃO INTERATIVO ====================
client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const possuiCargoAdmin = config.cargo_admin ? i.member.roles.cache.has(config.cargo_admin) : false;
        if (!possuiCargoAdmin && !i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({ content: `${myEmojis.proibido} Acesso Negado.`, ephemeral: true });
        }

        let txtOpcoes = config.opcoes_ticket.length > 0 
            ? config.opcoes_ticket.map((o, idx) => `**${idx + 1}️⃣ ${o.label}** [${o.tipo}]\n└ *${o.description}*`).join('\n\n') 
            : '*Nenhuma categoria criada.*';

        const embedTicket = new EmbedBuilder()
            .setTitle(`${myEmojis.suporte} Central de Configuração`)
            .setDescription(txtOpcoes)
            .setColor('#2ed573')
            .addFields(
                { name: '📁 Categoria Texto:', value: config.local_conversas_texto ? `<#${config.local_conversas_texto}>` : '*Não definido*', inline: true },
                { name: '💬 Canal Tópicos:', value: config.local_conversas_topico ? `<#${config.local_conversas_topico}>` : '*Não definido*', inline: true },
                { name: '📋 Canal de Logs:', value: config.logs_ticket ? `<#${config.logs_ticket}>` : '*Não definido*', inline: true }
            );

        const rowCargos = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('sel_cargo_admin').setPlaceholder('Cargo Admin (Configuração)'));
        const rowSuporte = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('sel_cargo_suporte').setPlaceholder('Cargo Suporte (Quem será marcado)'));
        const rowCanais = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sel_canais_ticket').setPlaceholder('Definir Categoria, Canal de Tópicos ou Canal de Logs').setChannelTypes([ChannelType.GuildCategory, ChannelType.GuildText]));
        
        const botoesTicket = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('add_ticket_opcao').setLabel('Criar Opção').setStyle(ButtonStyle.Primary).setEmoji(myEmojis.criar),
            new ButtonBuilder().setCustomId('btn_banner_ticket').setLabel('Mudar Imagem/Banner').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
            new ButtonBuilder().setCustomId('limpar_ticket_opcoes').setLabel('Limpar Tudo').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.cancelar),
            new ButtonBuilder().setCustomId('enviar_painel_membros').setLabel('Enviar Painel').setStyle(ButtonStyle.Success).setEmoji('📢')
        );

        await i.reply({ embeds: [embedTicket], components: [rowCargos, rowSuporte, rowCanais, botoesTicket], ephemeral: true });
    }

    // Salvamento de seletores nativos
    if (i.isRoleSelectMenu()) {
        if (i.customId === 'sel_cargo_admin') config.cargo_admin = i.values[0];
        if (i.customId === 'sel_cargo_suporte') config.cargo_suporte = i.values[0];
        await i.reply({ content: `${myEmojis.confirmar} Cargos atualizados!`, ephemeral: true });
    }

    if (i.isChannelSelectMenu() && i.customId === 'sel_canais_ticket') {
        const canalSelecionado = i.channels.first();
        if (canalSelecionado.type === ChannelType.GuildCategory) {
            config.local_conversas_texto = canalSelecionado.id;
            await i.reply({ content: `${myEmojis.confirmar} Categoria para canais de texto definida!`, ephemeral: true });
        } else {
            const rowDestino = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`set_topico_${canalSelecionado.id}`).setLabel('Definir como Canal de Tópicos').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`set_logs_${canalSelecionado.id}`).setLabel('Definir como Canal de Logs').setStyle(ButtonStyle.Secondary)
            );
            await i.reply({ content: `O canal <#${canalSelecionado.id}> serve para qual função?`, components: [rowDestino], ephemeral: true });
        }
    }

    if (i.isButton() && i.customId.startsWith('set_')) {
        const partes = i.customId.split('_');
        const tipo = partes[1];
        const canalId = partes[2];
        if (tipo === 'topico') config.local_conversas_topico = canalId;
        if (tipo === 'logs') config.logs_ticket = canalId;
        await i.update({ content: `${myEmojis.confirmar} Canal configurado com sucesso!`, components: [] });
    }

    // Modais e botões de gerenciamento de opções
    if (i.isButton() && i.customId === 'btn_banner_ticket') {
        const modal = new ModalBuilder().setCustomId('modal_ticket_banner').setTitle('Banner do Painel de Atendimento');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_tkt_url').setLabel('Link (URL) da Imagem').setStyle(TextInputStyle.Short).setValue(config.url_foto_ticket || "").setRequired(false))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'modal_ticket_banner') {
        const urlInput = i.fields.getTextInputValue('in_tkt_url');
        config.url_foto_ticket = urlInput.trim() !== "" ? urlInput.trim() : null;
        await i.reply({ content: `${myEmojis.confirmar} Imagem do painel updated!`, ephemeral: true });
    }

    if (i.isButton() && i.customId === 'add_ticket_opcao') {
        const modal = new ModalBuilder().setCustomId('modal_add_ticket').setTitle('Nova Categoria');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_nome').setLabel('Nome').setStyle(TextInputStyle.Short)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_desc').setLabel('Descrição').setStyle(TextInputStyle.Short)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t_tipo').setLabel('"TEXTO" ou "TOPICO"').setStyle(TextInputStyle.Short).setPlaceholder('TEXTO'))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'modal_add_ticket') {
        const nome = i.fields.getTextInputValue('t_nome');
        const desc = i.fields.getTextInputValue('t_desc');
        const tipo = i.fields.getTextInputValue('t_tipo').toUpperCase() === 'TOPICO' ? 'TOPICO' : 'TEXTO';
        config.opcoes_ticket.push({ label: nome, description: desc, value: `tkt_${Date.now()}`, tipo });
        await i.reply({ content: `${myEmojis.confirmar} Opção adicionada!`, ephemeral: true });
    }

    if (i.isButton() && i.customId === 'limpar_ticket_opcoes') {
        config.opcoes_ticket = [];
        await i.reply({ content: `${myEmojis.cancelar} Categorias limpas!`, ephemeral: true });
    }

    // Enviar Painel Final para os Membros
    if (i.isButton() && i.customId === 'enviar_painel_membros') {
        if (config.opcoes_ticket.length === 0) return i.reply({ content: `${myEmojis.proibido} Crie opções primeiro!`, ephemeral: true });
        
        const embed = new EmbedBuilder()
            .setTitle(`${myEmojis.suporte} Central de Atendimento`)
            .setDescription('Selecione abaixo o assunto do seu chamado para abrir um ticket:')
            .setColor('#5865f2');

        if (config.url_foto_ticket) embed.setImage(config.url_foto_ticket);

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('abrir_ticket_membro')
                .setPlaceholder('Escolha um assunto...')
                .addOptions(config.opcoes_ticket.map(o => ({ label: o.label, description: o.description, value: o.value })))
        );

        await i.channel.send({ embeds: [embed], components: [menu] });
        await i.reply({ content: '📢 Painel de atendimento publicado!', ephemeral: true });
    }

    // ==================== EXECUÇÃO DA ABERTURA DO TICKET ====================
    if (i.isStringSelectMenu() && i.customId === 'abrir_ticket_membro') {
        const opcao = config.opcoes_ticket.find(o => o.value === i.values[0]);
        if (!opcao) return i.reply({ content: 'Erro interno.', ephemeral: true });

        let canalCriado;

        if (opcao.tipo === 'TEXTO') {
            const overwrites = [
                { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] }
            ];
            if (config.cargo_suporte) overwrites.push({ id: config.cargo_suporte, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

            canalCriado = await i.guild.channels.create({
                name: `🎫-${opcao.label.toLowerCase()}-${i.user.username}`,
                type: ChannelType.GuildText,
                parent: config.local_conversas_texto || null,
                permissionOverwrites: overwrites
            });
            canalCriado.setTopic(i.user.id); 
        } else {
            const canalAlvo = config.local_conversas_topico ? i.guild.channels.cache.get(config.local_conversas_topico) : i.channel;
            canalCriado = await canalAlvo.threads.create({
                name: `📁-${opcao.label.toLowerCase()}-${i.user.username}`,
                autoArchiveDuration: 1440,
                type: canalAlvo.type === ChannelType.GuildAnnouncement ? ChannelType.GuildPublicThread : ChannelType.GuildPrivateThread
            });
            await canalCriado.members.add(i.user.id);
        }

        const embedInterno = new EmbedBuilder()
            .setTitle(`${myEmojis.suporte} Suporte Iniciado`)
            .setDescription(`Olá ${i.user}, envie suas dúvidas ou problemas aqui.\nA nossa equipe já foi notificada.`)
            .setColor('#2ecc71');

        const rowAcoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('assumir_ticket_btn').setLabel('Assumir Chamado').setStyle(ButtonStyle.Success).setEmoji(myEmojis.confirmar),
            new ButtonBuilder().setCustomId('fechar_ticket_btn').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.proibido)
        );

        // MARCAÇÃO AUTOMÁTICA DO SUPORTE AQUI
        const mencaoSuporte = config.cargo_suporte ? `<@&${config.cargo_suporte}>` : '';
        await canalCriado.send({ content: `${i.user} ${mencaoSuporte}`, embeds: [embedInterno], components: [rowAcoes] });
        await i.reply({ content: `✅ Ticket criado em: ${canalCriado}`, ephemeral: true });
    }

    // Assumir chamado
    if (i.isButton() && i.customId === 'assumir_ticket_btn') {
        if (config.cargo_suporte && !i.member.roles.cache.has(config.cargo_suporte)) return i.reply({ content: `${myEmojis.proibido} Apenas para a equipe de suporte.`, ephemeral: true });
        
        const desabilitado = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('assumir_ticket_btn').setLabel(`Atendido por ${i.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('fechar_ticket_btn').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.proibido)
        );
        await i.message.edit({ components: [desabilitado] });
        await i.channel.send({ content: `${myEmojis.confirmar} O suporte foi assumido por ${i.user}.` });
        await i.reply({ content: 'Você assumiu este ticket!', ephemeral: true });
    }

    // Fechar chamado + Envio do histórico para o canal de logs
    if (i.isButton() && i.customId === 'fechar_ticket_btn') {
        if (config.cargo_suporte && !i.member.roles.cache.has(config.cargo_suporte)) return i.reply({ content: `${myEmojis.proibido} Apenas suporte!`, ephemeral: true });

        await i.reply({ content: 'Salvando histórico e fechando...' });
        const logsCanal = config.logs_ticket ? i.guild.channels.cache.get(config.logs_ticket) : null;

        if (logsCanal) {
            const mensagens = await i.channel.messages.fetch({ limit: 100 });
            let txt = `HISTÓRICO DO TICKET: ${i.channel.name}\n\n`;
            mensagens.reverse().forEach(m => txt += `[${m.createdAt.toLocaleTimeString()}] ${m.author.tag}: ${m.content}\n`);

            let donoId = i.channel.topic;
            if (!donoId && i.channel.isThread()) {
                const owner = await i.channel.fetchOwner();
                if (owner) donoId = owner.id;
            }

            const arquivo = new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: 'logs-ticket.txt' });
            const embed = new EmbedBuilder()
                .setTitle(`${myEmojis.cancelar} Ticket Encerrado`)
                .setColor('#ff4757')
                .addFields(
                    { name: '👤 Dono do Ticket:', value: donoId ? `<@${donoId}>` : '*Não localizado*', inline: true },
                    { name: '🔒 Fechado por:', value: `${i.user}`, inline: true }
                ).setTimestamp();

            await logsCanal.send({ embeds: [embed], files: [arquivo] });
        }
        setTimeout(() => i.channel.delete().catch(() => {}), 2000);
    }
});

client.login(process.env.DISCORD_TOKEN);

