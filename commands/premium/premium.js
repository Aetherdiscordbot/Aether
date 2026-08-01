/**
 * /premium — Aether Premium management.
 * info    → what premium is and how to buy it (auto-fulfillment via Whop webhooks).
 * status  → this server's premium status.
 * activate→ manual fallback when the checkout Discord fields were wrong/missing.
 * remove  → (Admin) remove premium from this server.
 * whitelist → (Owner) mark a server premium without payment.
 */
const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('../../config/config');
const whop = require('../../services/whop');
const premiumService = require('../../services/premium');
const { baseEmbed, Colors, errorEmbed, successEmbed, infoEmbed, premiumRequiredEmbed } = require('../../utils/discord');
const { formatDate, timestamp, formatDuration } = require('../../utils/time');
const { str, sub, req } = require('../../utils/commandBuilder');

const FEATURES = [
  'Advanced tickets, applications & moderation',
  'Advanced security & anti-raid protection',
  'Advanced customizable logging',
  'Server backups',
  'Custom embed builder',
  'Higher limits & extra customization',
  'Priority support',
];

const PRICE = '$10/month';

module.exports = {
  name: 'premium',
  description: 'Aether Premium — manage your subscription',
  permissions: [],
  subPermissions: {
    remove: ['Administrator'],
    whitelist: ['Administrator'],
  },
  ownerOnlySubcommands: ['whitelist'],
  options: [
    sub('info', 'What is Aether Premium and how do I get it?'),
    sub('status', 'Check this server\'s premium status'),
    sub('activate', 'Manually activate premium on this server (fallback)', [
      str('whop', 'Your Whop username or membership ID (mem_...)', req()),
    ]),
    sub('remove', 'Remove premium from this server', [], { default_member_permissions: '8' }),
    sub('whitelist', '[Owner] Mark a server as premium without payment', [
      str('server_id', 'Server ID (defaults to current server)', {}),
    ]),
  ],
  async run(client, interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'info':
        return info(interaction);
      case 'status':
        return status(interaction);
      case 'activate':
        return activate(interaction);
      case 'remove':
        return remove(interaction);
      case 'whitelist':
        return whitelist(interaction);
    }
  },
};

async function info(interaction) {
  const embed = baseEmbed({
    color: Colors.premium,
    title: '✨ Aether Premium',
    description:
      'Aether Premium unlocks the full power of Aether for your server.\n\n' +
      `**Price: ${PRICE}**\n\n` +
      '**What you get:**\n' +
      FEATURES.map((f) => `• ${f}`).join('\n') +
      `\n\n**How it works:**\n1. Buy at [${config.whop.checkoutUrl}](${config.whop.checkoutUrl})\n2. Enter your **Discord Username** and **Discord Server ID** at checkout\n3. Premium is applied automatically the moment payment completes\n\n_Need help? Contact Aether support._`,
    footer: { text: 'Aether Premium' },
  });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function status(interaction) {
  const row = premiumService.getPremiumServer(interaction.guildId);
  const isPremium = premiumService.isPremium(interaction.guildId);

  if (!row || !isPremium) {
    return interaction.reply({ embeds: [premiumRequiredEmbed()], ephemeral: true });
  }

  const embed = baseEmbed({
    color: Colors.premium,
    title: `Premium Status — ${interaction.guild.name}`,
    description: '✅ This server has an active Aether Premium subscription.',
    fields: [
      { name: 'Plan', value: row.plan || 'Premium', inline: true },
      { name: 'Status', value: '🟢 Active', inline: true },
      { name: 'Activated', value: formatDate(row.activated_at), inline: true },
      { name: 'Expires', value: row.expires_at ? timestamp(row.expires_at) : 'Never (lifetime)', inline: true },
      { name: 'Type', value: row.whitelisted ? 'Whitelisted (manual)' : 'Whop subscription', inline: true },
      { name: 'Membership', value: row.membership_id ? `\`${row.membership_id}\`` : 'N/A', inline: true },
    ],
    footer: { text: 'Aether Premium' },
  });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function activate(interaction) {
  const identifier = interaction.options.getString('whop', true).trim();

  // Require the invoker to actually manage this server.
  const perms = interaction.memberPermissions || interaction.member?.permissions;
  if (!perms?.has('Administrator')) {
    return interaction.reply({
      embeds: [errorEmbed('You need **Administrator** permission in this server to activate premium on it.')],
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const membership = await whop.resolveMembership(identifier);

    // Safety: if the checkout recorded a Discord username, it must match.
    const { discordUsername, discordServerId } = whop.extractCheckoutFields(membership);
    if (discordUsername) {
      const buyer = discordUsername.replace(/^@/, '').split('#')[0].toLowerCase();
      const invoker = interaction.user.username.toLowerCase();
      if (buyer !== invoker) {
        return interaction.followUp({
          embeds: [
            errorEmbed(
              `The Discord Username on this membership (**${discordUsername}**) does not match your account. ` +
                `If you typo\'d it, contact support to re-link your subscription.`
            ),
          ],
          ephemeral: true,
        });
      }
    }

    // If a server was specified at checkout, verify ownership before overriding.
    if (discordServerId && discordServerId !== interaction.guildId) {
      return interaction.followUp({
        embeds: [
          errorEmbed(
            `This membership is linked to server ID \`${discordServerId}\`. You\'re activating on **${interaction.guild.name}** (${interaction.guildId}). ` +
              `Run this command inside the server you selected at checkout, or contact support.`
          ),
        ],
        ephemeral: true,
      });
    }

    await premiumService.fulfillGrant({
      membership_id: membership.id,
      guild_id: interaction.guildId,
      discord_user_id: interaction.user.id,
      discord_username: interaction.user.username,
      plan: whop.getPlanLabel(membership),
      expires_at: membership.renewal_period_end || null,
      whop_customer_id: membership.user?.id || null,
    });

    return interaction.followUp({
      embeds: [
        successEmbed(
          `**Aether Premium activated for ${interaction.guild.name}!**\n` +
            `Premium features are now unlocked in this server, and the **Aether Premium** role has been granted on the bot's main server.`
        ),
      ],
      ephemeral: true,
    });
  } catch (err) {
    return interaction.followUp({
      embeds: [errorEmbed(err.message || 'Could not verify that membership.')],
      ephemeral: true,
    });
  }
}

async function remove(interaction) {
  const isPremium = premiumService.isPremium(interaction.guildId);
  if (!isPremium) {
    return interaction.reply({ embeds: [errorEmbed('This server is not premium.')], ephemeral: true });
  }

  premiumService.removeServerPremium(interaction.guildId);

  // Remove the role from any member holding it.
  const role = interaction.guild.roles.cache.find((r) => r.name === config.premium.roleName);
  if (role) {
    for (const member of interaction.guild.members.cache.values()) {
      if (member.roles.cache.has(role.id)) {
        member.roles.remove(role, 'Aether Premium removed by administrator').catch(() => {});
      }
    }
  }

  return interaction.reply({
    embeds: [successEmbed('Aether Premium has been removed from this server.')],
    ephemeral: true,
  });
}

async function whitelist(interaction) {
  const targetId = interaction.options.getString('server_id') || interaction.guildId;
  const guild = interaction.client.guilds.cache.get(targetId);
  if (!guild) {
    return interaction.reply({ embeds: [errorEmbed(`The bot is not in server \`${targetId}\`.`)], ephemeral: true });
  }

  premiumService.whitelistServer(guild.id, interaction.user.id);

  const role = await premiumService.ensurePremiumRole(guild).catch(() => null);
  const owner = guild.members.cache.get(guild.ownerId);
  if (owner && role) owner.roles.add(role, 'Aether Premium (whitelisted)').catch(() => {});

  return interaction.reply({
    embeds: [successEmbed(`**${guild.name}** has been whitelisted as an Aether Premium server.`)],
    ephemeral: true,
  });
}
