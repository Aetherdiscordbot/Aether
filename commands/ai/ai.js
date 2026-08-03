/**
 * /ai — OpenRouter chat + image generation with history, rate limits, usage.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ai = require('../../services/ai');

module.exports = {
  name: 'ai',
  description: 'AI chat and image generation',
  premium: true,
  options: [
    {
      name: 'chat',
      description: 'Chat with the AI (remembers conversation)',
      type: 1,
      options: [
        { name: 'prompt', description: 'What to ask', type: 3, required: true },
        { name: 'system', description: 'System prompt (optional)', type: 3, required: false },
        { name: 'model', description: 'Model override', type: 3, required: false, choices: [
          { name: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' },
          { name: 'GPT-4o', value: 'openai/gpt-4o' },
          { name: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
          { name: 'Gemini 2.5 Flash', value: 'google/gemini-2.5-flash' },
        ]},
      ],
    },
    {
      name: 'image',
      description: 'Generate an image',
      type: 1,
      options: [
        { name: 'prompt', description: 'Image description', type: 3, required: true },
        { name: 'model', description: 'Model override', type: 3, required: false, choices: [
          { name: 'Gemini 2.5 Flash Image', value: 'google/gemini-2.5-flash-image' },
          { name: 'DALL-E 3', value: 'openai/dall-e-3' },
          { name: 'Stable Diffusion XL', value: 'stability-ai/stable-diffusion-xl' },
        ]},
        { name: 'size', description: 'Image size', type: 3, required: false, choices: [
          { name: '1024x1024', value: '1024x1024' },
          { name: '1792x1024', value: '1792x1024' },
          { name: '1024x1792', value: '1024x1792' },
        ]},
      ],
    },
    {
      name: 'clear',
      description: 'Clear your conversation history',
      type: 1,
    },
    {
      name: 'usage',
      description: 'View AI usage stats for this server',
      type: 1,
      options: [
        { name: 'days', description: 'Days to look back (default 30)', type: 4, required: false },
      ],
    },
  ],
  async run(client, interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    try {
      if (sub === 'chat') {
        const prompt = interaction.options.getString('prompt');
        const system = interaction.options.getString('system');
        const model = interaction.options.getString('model');

        const reply = await ai.chatWithHistory(
          interaction.guildId,
          interaction.user.id,
          prompt,
          system,
          { model }
        );
        const embed = new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
          .setDescription(reply.slice(0, 4000))
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } else if (sub === 'image') {
        const prompt = interaction.options.getString('prompt');
        const model = interaction.options.getString('model');
        const size = interaction.options.getString('size');

        const url = await ai.generateImage(interaction.guildId, interaction.user.id, prompt, { model, size });
        const embed = new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
          .setTitle('🖼️ Generated Image')
          .setImage(url)
          .setFooter({ text: prompt.slice(0, 100) })
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } else if (sub === 'clear') {
        await ai.clearHistory(interaction.guildId, interaction.user.id);
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x44ff44).setTitle('✅ Conversation Cleared').setDescription('Your AI conversation history has been reset.').setTimestamp()] });
      } else if (sub === 'usage') {
        const days = interaction.options.getInteger('days') || 30;
        const data = await ai.getUsage(interaction.guildId, days);
        const totals = data.reduce((a, d) => {
          a.prompts += Number(d.prompts || 0);
          a.images += Number(d.images || 0);
          a.tokens += Number(d.tokens || 0);
          return a;
        }, { prompts: 0, images: 0, tokens: 0 });
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x8b5cf6)
            .setTitle(`🤖 AI Usage (last ${days}d)`)
            .addFields(
              { name: '💬 Prompts', value: totals.prompts.toLocaleString(), inline: true },
              { name: '🖼️ Images', value: totals.images.toLocaleString(), inline: true },
              { name: '🔢 Tokens', value: totals.tokens.toLocaleString(), inline: true },
            )
            .setTimestamp()],
        });
      }
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff4444).setTitle('❌ AI Error').setDescription(e.message.slice(0, 4000)).setTimestamp()] });
    }
  },
};