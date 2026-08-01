/**
 * Central interaction router. Every button, select menu, modal, command and
 * context menu flows through here.
 */
const logger = require('../services/logger');
const commandHandler = require('../handlers/commandHandler');
const componentHandler = require('../handlers/componentHandler');

module.exports = {
  name: 'interactionCreate',
  run(client, interaction) {
    handle(client, interaction).catch((err) => {
      logger.error(`Interaction handling error: ${err.stack || err.message}`);
      const payload = { content: '⚠️ Something went wrong.', ephemeral: true };
      if (!interaction.replied && !interaction.deferred) interaction.reply(payload).catch(() => {});
      else interaction.followUp(payload).catch(() => {});
    });
  },
};

async function handle(client, interaction) {
  if (interaction.isChatInputCommand()) {
    await commandHandler.dispatch(client, interaction);
    return;
  }

  if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
    await commandHandler.dispatch(client, interaction);
    return;
  }

  if (interaction.isButton()) {
    await componentHandler.dispatchButton(client, interaction);
    return;
  }

  const isSelect =
    interaction.isStringSelectMenu() ||
    interaction.isUserSelectMenu() ||
    interaction.isRoleSelectMenu() ||
    interaction.isChannelSelectMenu() ||
    interaction.isMentionableSelectMenu();
  if (isSelect) {
    await componentHandler.dispatchSelect(client, interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    await componentHandler.dispatchModal(client, interaction);
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = commandHandler.commands.get(interaction.commandName);
    if (command?.autocomplete) await command.autocomplete(client, interaction);
  }
}
