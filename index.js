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
            msg_entrada: "Seja bem-vindo(a) ao servidor, {membro}! <:sino:1510520622625849355>",
            msg_saida: "{membro} saiu do servidor. <:cancelar:1510520615956905985>",
            url_foto_entrada: null, 
            url_foto_ticket: null, // Nova propriedade para o banner do painel de tickets
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

// Controle de Cooldown para o !not (4 usos a cada 2 horas por servidor)
const cooldownsNot = new Map();

// Emojis Personalizados
const myEmojis = {
    suporte: "<:Suporte:1510520624274215092>",
    criar: "<:criar:1510520619630989393>",
    codigo: "<:codigo:1510520618133749821>",
    confirmar: "<:corfimar:1510520614853541979>",
    cancelar: "<:cancelar:1510520615956905985>",
    proibido: "<:proibido:1510520613452644394>",
    sino: "<:sino:1510520622625849355>"
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
        console.log('🚀 Bot Completo com Banners de Entrada e Ticket Online!');
    } catch (error) { console.error(error); }
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

        if (!cooldownsNot.has(guildId)) {
            cooldownsNot.set(guildId, []);
        }

        let historicoUsos = cooldownsNot.get(guildId);
        historicoUsos = historicoUsos.filter(tempo => agora - tempo < DOIS_HORAS);

        if (historicoUsos.length >= 4) {
            const maisAntigo = historicoUsos[0];
            const tempoRestanteMs = DOIS_HORAS - (agora - maisAntigo);
            const minutosRestantes = Math.ceil(tempoRestanteMs / (1000 * 60));

            return message.reply({ content: `⚠️ **Limite de segurança atingido!** O comando \`!not\` só pode ser usado 4 vezes a cada 2 horas. Tente novamente em **${minutosRestantes} minutos**.` })
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

                await message.channel.send(`🔔 ${membro}, a nossa equipe de suporte respondeu ao seu chamado! Verifique as mensagens acima.`);
                await membro.send(`🎫 **Aviso do Suporte:** A equipe respondeu ao seu ticket no servidor **${message.guild.name}**.\n👉 Acesse o chat por aqui: ${message.channel}`).catch(() => {});
            }
        } else {
            return message.reply({ content: `❌ Não encontrei o dono deste ticket neste canal.` })
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000));
        }
    }
});

// ==================== PAINEL ADMINISTRATIVO INTERATIVO (/configurar) ====================
client.on('interactionCreate', async (i) => {
    if (!i.guild) return;
    const config = getGuildConfig(i.guild.id);

    if (i.isChatInputCommand() && i.commandName === 'configurar') {
        const possuiCargoAdmin = config.cargo_admin ? i.member.roles.cache.has(config.cargo_admin) : false;
        const eAdminNativo = i.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!possuiCargoAdmin && !eAdminNativo) {
            return i.reply({ content: `${myEmojis.proibido} **Acesso Negado.** Apenas membros com o cargo de **Administrador definido no bot** podem configurar as funções.`, ephemeral: true });
        }

        const embedPrincipal = new EmbedBuilder()
            .setTitle(`${myEmojis.codigo} Central de Gerenciamento`)
            .setDescription('Configure todos os módulos do seu bot usando os seletores nativos abaixo.')
            .setColor('#4f46e5');

        const menuMestre = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu_mestre_config')
                .setPlaceholder('Escolha o módulo...')
                .addOptions([
                    { label: 'Moderação & Boas-Vindas', value: 'mod_config', emoji: '🛡️' },
                    { label: 'Diretório de Logs', value: 'logs_config', emoji: '📋' },
                    { label: 'Configuração de Tickets', value: 'tickets_config', emoji: '🎫' }
                ])
        );

        await i.reply({ embeds: [embedPrincipal], components: [menuMestre] });
    }

    if (i.isStringSelectMenu() || i.isButton() || i.isChannelSelectMenu() || i.isRoleSelectMenu() || i.isModalSubmit()) {
        const customIdsConfig = ['menu_mestre_config', 'sel_destino_categoria', 'sel_destino_canal_threads', 'sel_canais_welcome', 'sel_logs_principais', 'sel_logs_seguranca', 'sel_cargo_admin', 'sel_cargo_suporte', 'btn_msg_welcome', 'modal_welcome_text', 'add_ticket_opcao', 'modal_add_ticket', 'limpar_ticket_opcoes', 'enviar_painel_membros', 'modal_ticket_banner'];
        
        if (customIdsConfig.some(id => i.customId.startsWith(id))) {
            const possuiCargoAdmin = config.cargo_admin ? i.member.roles.cache.has(config.cargo_admin) : false;
            const eAdminNativo = i.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!possuiCargoAdmin && !eAdminNativo) {
                return i.reply({ content: `${myEmojis.proibido} Você não tem permissão para alterar as configurações do bot.`, ephemeral: true });
            }
        }
    }

    if (i.isStringSelectMenu() && i.customId === 'menu_mestre_config') {
        const categoria = i.values[0];

        if (categoria === 'mod_config') {
            const embedMod = new EmbedBuilder()
                .setTitle('🛡️ Moderação & Boas-Vindas')
                .setColor('#ff4757')
                .addFields(
                    { name: '👑 Cargo Admin (Pode Configurar):', value: config.cargo_admin ? `<@&${config.cargo_admin}>` : '*Não definido*', inline: true },
                    { name: '🎫 Cargo Suporte:', value: config.cargo_suporte ? `<@&${config.cargo_suporte}>` : '*Não definido*', inline: true },
                    { name: '🖼️ Foto de Entrada:', value: config.url_foto_entrada ? `[Clique para ver](${config.url_foto_entrada})` : '*Sem foto (Mensagem normal)*', inline: true },
                    { name: '🚪 Canais:', value: `**Entrada:** ${config.canal_entrada ? `<#${config.canal_entrada}>` : '*Não definido*'}\n**Saída:** ${config.canal_saida ? `<#${config.canal_saida}>` : '*Não definido*'}`, inline: false }
                );

            const rowCargos = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('sel_cargo_admin').setPlaceholder('Definir Cargo Admin (Quem pode configurar)'));
            const rowSuporte = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('sel_cargo_suporte').setPlaceholder('Definir Cargo Suporte'));
            const rowCanais = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sel_canais_welcome').setPlaceholder('Canais de Entrada e Saída').setMinValues(1).setMaxValues(2).setChannelTypes([ChannelType.GuildText]));
            const rowTextoBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_msg_welcome').setLabel('Editar Textos e Imagem').setStyle(ButtonStyle.Primary).setEmoji('📝'));

            await i.reply({ embeds: [embedMod], components: [rowCargos, rowSuporte, rowCanais, rowTextoBtn], ephemeral: true });
        }

        if (categoria === 'logs_config') {
            const embedLogs = new EmbedBuilder()
                .setTitle('📋 Configuração do Sistema de Logs')
                .setColor('#ffa502')
                .addFields(
                    { name: '🎫 Logs de Tickets:', value: config.logs_ticket ? `<#${config.logs_ticket}>` : '*Não definido*', inline: true },
                    { name: '💬 Logs de Mensagens:', value: config.logs_mensagens ? `<#${config.logs_mensagens}>` : '*Não definido*', inline: true },
                    { name: '🔨 Logs de Punições:', value: config.logs_punicoes ? `<#${config.logs_punicoes}>` : '*Não definido*', inline: true },
                    { name: '👑 Logs de Cargos:', value: config.logs_cargos ? `<#${config.logs_cargos}>` : '*Não definido*', inline: true }
                );

            const rowSelLogs1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sel_logs_principais').setPlaceholder('Logs de Tickets [1] e Mensagens [2]').setMinValues(2).setMaxValues(2).setChannelTypes([ChannelType.GuildText]));
            const rowSelLogs2 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sel_logs_seguranca').setPlaceholder('Logs de Punições [1] e Cargos [2]').setMinValues(2).setMaxValues(2).setChannelTypes([ChannelType.GuildText]));

            await i.reply({ embeds: [embedLogs], components: [rowSelLogs1, rowSelLogs2], ephemeral: true });
        }

        if (categoria === 'tickets_config') {
            let txtOpcoes = config.opcoes_ticket.length > 0 
                ? config.opcoes_ticket.map((o, idx) => `**${idx + 1}️⃣ ${o.label}** [${o.tipo}]\n└ *${o.description}*`).join('\n\n') 
                : '*Nenhuma categoria criada.*';

            const embedTicket = new EmbedBuilder()
                .setTitle(`${myEmojis.suporte} Gerenciador de Tickets`)
                .setDescription(txtOpcoes)
                .setColor('#2ed573')
                .addFields(
                    { name: '📁 Categoria Texto:', value: config.local_conversas_texto ? `<#${config.local_conversas_texto}>` : '*Não definido*', inline: true },
                    { name: '💬 Canal Tópicos:', value: config.local_conversas_topico ? `<#${config.local_conversas_topico}>` : '*Não definido*', inline: true },
                    { name: '🖼️ Banner do Painel:', value: config.url_foto_ticket ? `[Clique para ver](${config.url_foto_ticket})` : '*Sem imagem personalizada*', inline: true }
                );

            const rowDestinoTexto = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sel_destino_categoria').setPlaceholder('Categoria (Canais de Texto)').setChannelTypes([ChannelType.GuildCategory]));
            const rowDestinoTopico = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sel_destino_canal_threads').setPlaceholder('Canal de Texto (Para os Tópicos)').setChannelTypes([ChannelType.GuildText]));
            
            const botoesTicket = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('add_ticket_opcao').setLabel('Criar Opção').setStyle(ButtonStyle.Primary).setEmoji(myEmojis.criar),
                new ButtonBuilder().setCustomId('btn_banner_ticket').setLabel('Mudar Imagem/Banner').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
                new ButtonBuilder().setCustomId('limpar_ticket_opcoes').setLabel('Limpar Tudo').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.cancelar),
                new ButtonBuilder().setCustomId('enviar_painel_membros').setLabel('Enviar Painel').setStyle(ButtonStyle.Success).setEmoji('📢')
            );

            await i.reply({ embeds: [embedTicket], components: [rowDestinoTexto, rowDestinoTopico, botoesTicket], ephemeral: true });
        }
    }

    // ==================== SALVAMENTO DE CONFIGURAÇÕES ====================
    if (i.isChannelSelectMenu()) {
        if (i.customId === 'sel_destino_categoria') config.local_conversas_texto = i.values[0];
        if (i.customId === 'sel_destino_canal_threads') config.local_conversas_topico = i.values[0];
        if (i.customId === 'sel_canais_welcome') { config.canal_entrada = i.values[0]; config.canal_saida = i.values[1] || i.values[0]; }
        if (i.customId === 'sel_logs_principais') { config.logs_ticket = i.values[0]; config.logs_mensagens = i.values[1]; }
        if (i.customId === 'sel_logs_seguranca') { config.logs_punicoes = i.values[0]; config.logs_cargos = i.values[1]; }
        await i.reply({ content: '✅ Canais salvos!', ephemeral: true });
    }

    if (i.isRoleSelectMenu()) {
        if (i.customId === 'sel_cargo_admin') config.cargo_admin = i.values[0];
        if (i.customId === 'sel_cargo_suporte') config.cargo_suporte = i.values[0];
        await i.reply({ content: '✅ Cargos atualizados com sucesso!', ephemeral: true });
    }

    // Modal de Textos/Imagem de Boas-vindas
    if (i.isButton() && i.customId === 'btn_msg_welcome') {
        const modal = new ModalBuilder().setCustomId('modal_welcome_text').setTitle('Mensagens e Imagem de Entrada');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_m_ent').setLabel('Mensagem de Entrada').setStyle(TextInputStyle.Paragraph).setValue(config.msg_entrada)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_m_sai').setLabel('Mensagem de Saída').setStyle(TextInputStyle.Paragraph).setValue(config.msg_saida)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_m_url').setLabel('Link (URL) da Imagem/Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(config.url_foto_entrada || "").setRequired(false).setPlaceholder('Deixe vazio para mensagem comum sem Embed'))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'modal_welcome_text') {
        config.msg_entrada = i.fields.getTextInputValue('in_m_ent');
        config.msg_saida = i.fields.getTextInputValue('in_m_sai');
        const urlInput = i.fields.getTextInputValue('in_m_url');
        config.url_foto_entrada = urlInput.trim() !== "" ? urlInput.trim() : null;
        await i.reply({ content: '✅ Configurações de entrada atualizadas!', ephemeral: true });
    }

    // MODAL PARA ALTERAR APENAS A FOTO/BANNER DO TICKET
    if (i.isButton() && i.customId === 'btn_banner_ticket') {
        const modal = new ModalBuilder().setCustomId('modal_ticket_banner').setTitle('Imagem do Painel de Atendimento');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('in_tkt_url').setLabel('Link (URL) da Imagem ou Banner').setStyle(TextInputStyle.Short).setValue(config.url_foto_ticket || "").setRequired(false).setPlaceholder('https://i.imgur.com/link.png'))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'modal_ticket_banner') {
        const urlInput = i.fields.getTextInputValue('in_tkt_url');
        config.url_foto_ticket = urlInput.trim() !== "" ? urlInput.trim() : null;
        await i.reply({ content: '✅ Imagem do painel de tickets atualizada com sucesso!', ephemeral: true });
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
        await i.reply({ content: '✅ Opção integrada!', ephemeral: true });
    }

    if (i.isButton() && i.customId === 'limpar_ticket_opcoes') {
        config.opcoes_ticket = [];
        await i.reply({ content: '🗑️ Categorias zeradas!', ephemeral: true });
    }

    // ENVIO DO PAINEL DE TICKETS COM SUPORTE A BANNER/IMAGEM
    if (i.isButton() && i.customId === 'enviar_painel_membros') {
        if (config.opcoes_ticket.length === 0) return i.reply({ content: '❌ Crie opções primeiro!', ephemeral: true });
        
        const embed = new EmbedBuilder()
            .setTitle(`${myEmojis.suporte} Central de Atendimento`)
            .setDescription('Selecione abaixo a categoria para abrir o seu ticket:')
            .setColor('#5865f2');

        // Se você configurou um link de foto para o ticket, aplica no painel aqui!
        if (config.url_foto_ticket) {
            embed.setImage(config.url_foto_ticket);
        }

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('abrir_ticket_membro')
                .setPlaceholder('Escolha um assunto...')
                .addOptions(config.opcoes_ticket.map(o => ({ label: o.label, description: o.description, value: o.value })))
        );

        await i.channel.send({ embeds: [embed], components: [menu] });
        await i.reply({ content: '📢 Painel publicado com sucesso!', ephemeral: true });
    }

    // ==================== EXECUÇÃO DA ABERTURA DO TICKET ====================
    if (i.isStringSelectMenu() && i.customId === 'abrir_ticket_membro') {
        const opcao = config.opcoes_ticket.find(o => o.value === i.values[0]);
        if (!opcao) return i.reply({ content: 'Erro interno ao validar opção.', ephemeral: true });

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
            .setDescription(`Olá ${i.user}, envie os detalhes do seu problema. Use \`!not\` quando o suporte responder para alertá-lo.`)
            .setColor('#2ecc71');

        const rowAcoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('assumir_ticket_btn').setLabel('Assumir Chamado').setStyle(ButtonStyle.Success).setEmoji(myEmojis.confirmar),
            new ButtonBuilder().setCustomId('fechar_ticket_btn').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.proibido)
        );

        const mencaoSuporte = config.cargo_suporte ? `<@&${config.cargo_suporte}>` : '';
        await canalCriado.send({ content: `${i.user} ${mencaoSuporte}`, embeds: [embedInterno], components: [rowAcoes] });
        await i.reply({ content: `✅ Ticket criado: ${canalCriado}`, ephemeral: true });
    }

    // INTERAÇÕES INTERNAS DO TICKET
    if (i.isButton() && i.customId === 'assumir_ticket_btn') {
        if (config.cargo_suporte && !i.member.roles.cache.has(config.cargo_suporte)) return i.reply({ content: 'Apenas a equipe de suporte!', ephemeral: true });
        
        const desabilitado = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('assumir_ticket_btn').setLabel(`Atendido por ${i.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('fechar_ticket_btn').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji(myEmojis.proibido)
        );
        await i.message.edit({ components: [desabilitado] });
        await i.channel.send({ content: `${myEmojis.confirmar} O suporte foi assumido por ${i.user}.` });
        await i.reply({ content: 'Chamado assumido!', ephemeral: true });
    }

    if (i.isButton() && i.customId === 'fechar_ticket_btn') {
        if (config.cargo_suporte && !i.member.roles.cache.has(config.cargo_suporte)) return i.reply({ content: 'Apenas suporte!', ephemeral: true });

        await i.reply({ content: 'Arquivando canal...' });
        const logsCanal = config.logs_ticket ? i.guild.channels.cache.get(config.logs_ticket) : null;

        if (logsCanal) {
            const mensagens = await i.channel.messages.fetch({ limit: 50 });
            let txt = `HISTÓRICO DO TICKET: ${i.channel.name}\n\n`;
            mensagens.reverse().forEach(m => txt += `[${m.createdAt.toLocaleTimeString()}] ${m.author.tag}: ${m.content}\n`);

            let donoId = i.channel.topic;
            if (!donoId && i.channel.isThread()) {
                const owner = await i.channel.fetchOwner();
                if (owner) donoId = owner.id;
            }

            const arquivo = new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: 'logs.txt' });
            const embed = new EmbedBuilder()
                .setTitle('📁 Ticket Encerrado')
                .setColor('#ff4757')
                .addFields(
                    { name: '👤 Dono do Ticket:', value: donoId ? `<@${donoId}>` : '*Não localizado*', inline: true },
                    { name: '🔒 Fechado por:', value: `${i.user}`, inline: true }
                );

            await logsCanal.send({ embeds: [embed], files: [arquivo] });
        }
        setTimeout(() => i.channel.delete().catch(() => {}), 2000);
    }
});

// ==================== MONITORAMENTO DAS LOGS ADICIONAIS ====================
client.on('messageDelete', async (m) => {
    if (!m.guild || m.author?.bot) return;
    const canal = m.guild.channels.cache.get(getGuildConfig(m.guild.id).logs_mensagens);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setTitle(`${myEmojis.cancelar} Mensagem Apagada`)
        .setDescription(`**Autor:** ${m.author}\n**Canal:** ${m.channel}`)
        .addFields({ name: 'Conteúdo:', value: m.content || '*Sem texto*' })
        .setColor('#ff4757').setTimestamp();
    canal.send({ embeds: [embed] });
});

client.on('messageUpdate', async (antiga, nova) => {
    if (!antiga.guild || antiga.author?.bot || antiga.content === nova.content) return;
    const canal = antiga.guild.channels.cache.get(getGuildConfig(antiga.guild.id).logs_mensagens);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setTitle('📝 Mensagem Editada')
        .setDescription(`**Autor:** ${antiga.author}\n**Canal:** ${antiga.channel}`)
        .addFields({ name: 'Antes:', value: antiga.content || '*Vazio*' }, { name: 'Depois:', value: nova.content || '*Vazio*'})
        .setColor('#ffa502').setTimestamp();
    canal.send({ embeds: [embed] });
});

client.on('guildBanAdd', async (ban) => {
    const canal = ban.guild.channels.cache.get(getGuildConfig(ban.guild.id).logs_punicoes);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setTitle(`${myEmojis.proibido} Membro Banido`)
        .setDescription(`**Usuário:** ${ban.user} (${ban.user.tag})\n**Motivo:** ${ban.reason || 'Não informado.'}`)
        .setColor('#ff4757').setTimestamp();
    canal.send({ embeds: [embed] });
});

client.on('guildMemberUpdate', async (antigo, novo) => {
    const canal = novo.guild.channels.cache.get(getGuildConfig(novo.guild.id).logs_cargos);
    if (!canal) return;

    const adicionados = novo.roles.cache.filter(r => !antigo.roles.cache.has(r.id));
    const removidos = antigo.roles.cache.filter(r => !novo.roles.cache.has(r.id));

    if (adicionados.size > 0 || removidos.size > 0) {
        const embed = new EmbedBuilder()
            .setTitle('👑 Cargos Atualizados')
            .setDescription(`**Membro:** ${novo.user}`)
            .setColor('#2ed573').setTimestamp();

        if (adicionados.size > 0) embed.addFields({ name: '➕ Adicionados:', value: adicionados.map(r => `${r}`).join(', ') });
        if (removidos.size > 0) embed.addFields({ name: '➖ Removidos:', value: removidos.map(r => `${r}`).join(', ') });

        canal.send({ embeds: [embed] });
    }
});

// ==================== ENTRADA INTELIGENTE (SEM EMBED SE ESTIVER SEM FOTO) ====================
client.on('guildMemberAdd', async (m) => {
    const conf = getGuildConfig(m.guild.id);
    const c = m.guild.channels.cache.get(conf.canal_entrada);
    
    if (c) {
        if (conf.url_foto_entrada) {
            const embedWelcome = new EmbedBuilder()
                .setTitle('👋 Bem-vindo(a) ao Servidor!')
                .setDescription(conf.msg_entrada.replace('{membro}', `${m.user}`))
                .setImage(conf.url_foto_entrada) 
                .setThumbnail(m.user.displayAvatarURL({ dynamic: true })) 
                .setColor('#4f46e5')
                .addFields(
                    { name: '📅 Entrou em:', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
                )
                .setFooter({ text: `Membro nº ${m.guild.memberCount}` }) 
                .setTimestamp();

            c.send({ embeds: [embedWelcome] }).catch(console.error);
        } else {
            c.send({ content: conf.msg_entrada.replace('{membro}', `${m.user}`) }).catch(console.error);
        }
    }
});

client.on('guildMemberRemove', async (m) => {
    const conf = getGuildConfig(m.guild.id);
    const c = m.guild.channels.cache.get(conf.canal_saida);
    if (c) c.send({ content: conf.msg_saida.replace('{membro}', `${m.user.tag}`) });
});

client.login(process.env.DISCORD_TOKEN);
