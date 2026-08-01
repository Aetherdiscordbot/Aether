/**
 * Discord formatting helpers shared across the bot.
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const Colors = {
  primary: 0x8b5cf6, // Aether violet
  success: 0x22c55e,
  warning: 0xf59e0b,
  error: 0xef4444,
  info: 0x3b82f6,
  premium: 0xf1c40f,
  neutral: 0x6b7280,
};

/** Aether-themed base embed. */
function baseEmbed({ color = Colors.primary, author, title, description, footer, thumbnail, image, fields, timestamp = true } = {}) {
  const embed = new EmbedBuilder().setColor(color);
  if (title) embed.setTitle(String(title).slice(0, 256));
  if (description) embed.setDescription(String(description).slice(0, 4096));
  if (author) embed.setAuthor(author);
  if (footer) embed.setFooter(footer);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (fields?.length) embed.addFields(fields.map((f) => ({ ...f, name: String(f.name).slice(0, 256), value: String(f.value).slice(0, 1024) })));
  if (timestamp) embed.setTimestamp();
  return embed;
}

/** Standard "denied" reply embed. */
function errorEmbed(message) {
  return baseEmbed({ color: Colors.error, description: `❌ ${message}` });
}

/** Standard "success" reply embed. */
function successEmbed(message) {
  return baseEmbed({ color: Colors.success, description: `✅ ${message}` });
}

/** Standard "info" reply embed. */
function infoEmbed(message) {
  return baseEmbed({ color: Colors.info, description: `ℹ️ ${message}` });
}

/** Standard premium lock message. */
function premiumRequiredEmbed() {
  return baseEmbed({
    color: Colors.premium,
    description:
      '> ✨ **This is an Aether Premium feature.**\n' +
      '> This server does not have an active subscription.\n' +
      '> Use `/premium info` to learn more.',
  });
}

/** A numbered embed used for list-style output. */
function listEmbed(items, { title = 'List', empty = 'Nothing to show.', max = 25 } = {}) {
  if (!items?.length) return infoEmbed(empty);
  const embed = baseEmbed({ title, description: items.slice(0, max).join('\n') });
  if (items.length > max) embed.setFooter({ text: `Showing ${max} of ${items.length}` });
  return embed;
}

/** Paginated embeds with prev/next buttons. Returns { embeds, components } array of pages. */
function paginate(items, { pageSize = 10, title, pageFormat, itemFormat } = {}) {
  if (!items?.length) return [{ embed: infoEmbed('Nothing to show.'), components: [] }];
  const pages = [];
  for (let i = 0; i < items.length; i += pageSize) {
    const slice = items.slice(i, i + pageSize);
    pages.push({
      embed: baseEmbed({
        title,
        description: slice.map((item, j) => `${itemFormat ? itemFormat(item) : String(item)}`).join('\n'),
        footer: { text: `Page ${pages.length + 1}/${Math.ceil(items.length / pageSize)}` },
      }),
      components: [],
    });
  }
  return pages.map((page, index) => ({
    ...page,
    components: pages.length > 1 ? buildPaginationRow(index, pages.length) : [],
  }));
}

function buildPaginationRow(index, total) {
  const prev = new ButtonBuilder()
    .setCustomId(`pagination:prev:${index}`)
    .setLabel('◀')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(index === 0);
  const next = new ButtonBuilder()
    .setCustomId(`pagination:next:${index}`)
    .setLabel('▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(index === total - 1);
  return [new ActionRowBuilder().addComponents(prev, next)];
}

/** Truncate long text. */
function truncate(text, max = 100) {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Normalize a Discord ID that may be wrapped in <@123> / <#123> / <@&123>. */
function cleanId(value) {
  const m = String(value ?? '').match(/\d{15,20}/);
  return m ? m[0] : null;
}

module.exports = {
  Colors,
  baseEmbed,
  errorEmbed,
  successEmbed,
  infoEmbed,
  premiumRequiredEmbed,
  listEmbed,
  paginate,
  truncate,
  cleanId,
};
