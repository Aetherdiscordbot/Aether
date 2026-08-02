/**
 * /ai — AI assistant via OpenRouter (premium).
 * Subcommands: ask, image, summarize, translate, rewrite.
 */
const { baseEmbed, Colors, errorEmbed } = require('../../utils/discord');
const aiService = require('../../services/ai');
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
    await interaction.deferReply();

    const subCmd = interaction.options.getSubcommand();

    try {
      if (subCmd === 'ask') {
        const answer = await aiService.chat(interaction.options.getString('prompt'));
        return interaction.editReply({ embeds: [aiEmbed(client, '✨ AI', answer)] });
      }

      if (subCmd === 'image') {
        const prompt = interaction.options.getString('prompt');
        const { buffer } = await aiService.image(prompt);
        const embed = baseEmbed({ color: Colors.primary, title: '🎨 Generated image', description: `*${prompt.slice(0, 1024)}*` });
        return interaction.editReply({ embeds: [embed], files: [{ attachment: buffer, name: 'aether-ai.png' }] });
      }

      if (subCmd === 'summarize') {
        const answer = await aiService.chat(interaction.options.getString('text'), { system: SYSTEM.summarize });
        return interaction.editReply({ embeds: [aiEmbed(client, '📝 Summary', answer)] });
      }

      if (subCmd === 'translate') {
        const lang = interaction.options.getString('language');
        const answer = await aiService.chat(interaction.options.getString('text'), {
          system: `${SYSTEM.translate} Target language: ${lang}.`,
        });
        return interaction.editReply({ embeds: [aiEmbed(client, `🌐 Translated (${lang})`, answer)] });
      }

      const style = interaction.options.getString('style') || 'clear';
      const answer = await aiService.chat(interaction.options.getString('text'), {
        system: `${SYSTEM.rewrite} Requested style: ${style}.`,
      });
      return interaction.editReply({ embeds: [aiEmbed(client, `✍️ Rewritten (${style})`, answer)] });
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed(`AI request failed: ${err.message}`)] });
    }
  },
};

function aiEmbed(client, title, text) {
  return baseEmbed({
    color: Colors.primary,
    author: { name: client.user?.username || 'Aether', iconURL: client.user?.displayAvatarURL?.() },
    title,
    description: String(text).slice(0, 4096),
  });
}
