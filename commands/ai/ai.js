/**
 * /ai — AI assistant via OpenRouter (premium).
 * Subcommands: ask, image, summarize, translate, rewrite.
 */
const { baseEmbed, Colors, errorEmbed } = require('../../utils/discord');
const aiService = require('../../services/ai');
const analytics = require('../../services/analytics');
const { sub, str, req } = require('../../utils/commandBuilder');

const SYSTEM = {
  summarize: 'You are a concise summarizer. Summarize the user-provided text into clear bullet points. Keep it short and factual.',
  translate: 'You are a professional translator. Translate the user-provided text into the requested language. Reply with only the translation.',
  rewrite: 'You are a skilled writer. Rewrite the user-provided text in the requested style while keeping the original meaning and tone intent intact.',
};

module.exports = {
  name: 'ai',
  description: 'AI assistant (premium)',
  cooldown: 10,
  options: [
    sub('ask', 'Ask the AI anything', [str('prompt', 'Your question', req())]),
    sub('image', 'Generate an image from a description', [str('prompt', 'Describe the image', req())]),
    sub('summarize', 'Summarize a block of text', [str('text', 'Text to summarize', req())]),
    sub('translate', 'Translate text into another language', [str('text', 'Text to translate', req()), str('language', 'Target language, e.g. French', req())]),
    sub('rewrite', 'Rewrite text in a different style', [str('text', 'Text to rewrite', req()), str('style', 'Target style, e.g. formal, casual', req())]),
  ],
  async run(client, interaction) {
    if (!aiService.isConfigured()) {
      return interaction.reply({ embeds: [errorEmbed('AI is not configured on this bot yet.')], ephemeral: true });
    }
    if (aiEnabled(interaction.guildId) === false) {
      return interaction.reply({ embeds: [errorEmbed('AI is disabled for this server. Enable it in the dashboard → AI Center.')], ephemeral: true });
    }
    await interaction.deferReply();

    const subCmd = interaction.options.getSubcommand();
    const record = (extra = {}) =>
      analytics.recordAiUsage(interaction.guildId, { prompts: 1, images: 0, ...extra });

    try {
      if (subCmd === 'ask') {
        const { text } = await aiService.chat(interaction.options.getString('prompt'));
        record();
        return interaction.editReply({ embeds: [aiEmbed(client, '✨ AI', text)] });
      }

      if (subCmd === 'image') {
        const prompt = interaction.options.getString('prompt');
        const loading = baseEmbed({
          color: Colors.primary,
          title: '🎨 Generating image…',
          description: `*${prompt.slice(0, 1024)}*`,
          footer: { text: 'This can take up to a minute' },
        });
        await interaction.editReply({ embeds: [loading] });
        const { buffer, tokens } = await aiService.image(prompt);
        record({ prompts: 0, images: 1, tokens });
        const embed = baseEmbed({ color: Colors.primary, title: '🎨 Generated image', description: `*${prompt.slice(0, 1024)}*` });
        return interaction.editReply({ embeds: [embed], files: [{ attachment: buffer, name: 'aether-ai.png' }] });
      }

      if (subCmd === 'summarize') {
        const { text, tokens } = await aiService.chat(interaction.options.getString('text'), { system: SYSTEM.summarize });
        record({ tokens });
        return interaction.editReply({ embeds: [aiEmbed(client, '📝 Summary', text)] });
      }

      if (subCmd === 'translate') {
        const lang = interaction.options.getString('language');
        const { text, tokens } = await aiService.chat(interaction.options.getString('text'), {
          system: `${SYSTEM.translate} Target language: ${lang}.`,
        });
        record({ tokens });
        return interaction.editReply({ embeds: [aiEmbed(client, `🌐 Translated (${lang})`, text)] });
      }

      const style = interaction.options.getString('style') || 'clear';
      const { text, tokens } = await aiService.chat(interaction.options.getString('text'), {
        system: `${SYSTEM.rewrite} Requested style: ${style}.`,
      });
      record({ tokens });
      return interaction.editReply({ embeds: [aiEmbed(client, `✍️ Rewritten (${style})`, text)] });
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed(`AI request failed: ${err.message}`)] });
    }
  },
};

/** Per-server AI toggle stored in automation_config (dashboard → AI Center). */
function aiEnabled(guildId) {
  try {
    const row = require('../../database/db')
      .prepare('SELECT value FROM automation_config WHERE guild_id = ? AND key = ?')
      .get(guildId, 'ai_enabled');
    if (!row) return true; // default: enabled
    return JSON.parse(row.value) !== false;
  } catch {
    return true;
  }
}

function aiEmbed(client, title, text) {
  return baseEmbed({
    color: Colors.primary,
    author: { name: client.user?.username || 'Aether', iconURL: client.user?.displayAvatarURL?.() },
    title,
    description: String(text).slice(0, 4096),
  });
}
