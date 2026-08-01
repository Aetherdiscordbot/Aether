/**
 * Economy service: balances, daily, work, payments, shop and inventory.
 * Configuration under the `economy` settings key.
 */
const db = require('../../database/db');
const settings = require('../../services/settings');

const DEFAULT_CONFIG = {
  enabled: true,
  currency: '🪙',
  startBalance: 0,
  dailyAmount: 200,
  workMin: 50,
  workMax: 200,
  workCooldownSec: 60 * 60,
};

function getConfig(guildId) {
  return { ...structuredClone(DEFAULT_CONFIG), ...settings.getSetting(guildId, 'economy', {}) };
}

function setConfig(guildId, partial) {
  settings.setSetting(guildId, 'economy', { ...getConfig(guildId), ...partial });
}

function getBalance(guildId, userId) {
  return (
    db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, userId) || {
      guild_id: guildId,
      user_id: userId,
      balance: getConfig(guildId).startBalance,
    }
  );
}

function ensureRow(guildId, userId) {
  const row = getBalance(guildId, userId);
  db.prepare(
    `INSERT INTO economy (guild_id, user_id, balance) VALUES (?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO NOTHING`
  ).run(guildId, userId, row.balance);
  return row;
}

/** Add or subtract from a balance. Returns the new balance. */
function changeBalance(guildId, userId, amount) {
  ensureRow(guildId, userId);
  const row = getBalance(guildId, userId);
  const balance = Math.max(0, row.balance + amount);
  db.prepare('UPDATE economy SET balance = ? WHERE guild_id = ? AND user_id = ?').run(balance, guildId, userId);
  return balance;
}

/** Daily reward. Returns { amount, balance } or { error, retryInMs }. */
function claimDaily(guildId, userId) {
  const cfg = getConfig(guildId);
  ensureRow(guildId, userId);
  const row = getBalance(guildId, userId);
  const now = new Date().toISOString();
  const last = row.last_daily;

  if (last) {
    const elapsed = Date.now() - Date.parse(last);
    const dayMs = 24 * 60 * 60 * 1000;
    if (elapsed < dayMs) return { error: 'already claimed', retryInMs: dayMs - elapsed };
  }

  const balance = row.balance + cfg.dailyAmount;
  db.prepare('UPDATE economy SET balance = ?, last_daily = ? WHERE guild_id = ? AND user_id = ?').run(balance, now, guildId, userId);
  return { amount: cfg.dailyAmount, balance };
}

/** Work reward. Returns { amount, balance } or { error, retryInMs }. */
function work(guildId, userId) {
  const cfg = getConfig(guildId);
  ensureRow(guildId, userId);
  const row = getBalance(guildId, userId);
  const now = new Date().toISOString();
  const last = row.last_work;

  if (last) {
    const elapsed = Date.now() - Date.parse(last);
    const cooldownMs = cfg.workCooldownSec * 1000;
    if (elapsed < cooldownMs) return { error: 'on cooldown', retryInMs: cooldownMs - elapsed };
  }

  const amount = cfg.workMin + Math.floor(Math.random() * (cfg.workMax - cfg.workMin + 1));
  const balance = row.balance + amount;
  db.prepare('UPDATE economy SET balance = ?, last_work = ? WHERE guild_id = ? AND user_id = ?').run(balance, now, guildId, userId);
  return { amount, balance };
}

/** Transfer currency between users. */
function transfer(guildId, fromId, toId, amount) {
  if (amount <= 0) return { error: 'Amount must be positive.' };
  const from = getBalance(guildId, fromId);
  if (from.balance < amount) return { error: 'Insufficient balance.' };
  changeBalance(guildId, fromId, -amount);
  changeBalance(guildId, toId, amount);
  return { amount };
}

function getShop(guildId) {
  return db.prepare('SELECT * FROM shop_items WHERE guild_id = ? ORDER BY price ASC').all(guildId);
}

function addShopItem(guildId, { name, description, price, roleId }) {
  return db.prepare('INSERT INTO shop_items (guild_id, name, description, price, role_id) VALUES (?, ?, ?, ?, ?)').run(
    guildId,
    name,
    description || null,
    Math.max(0, Math.floor(price)),
    roleId || null
  );
}

function removeShopItem(itemId) {
  return db.prepare('DELETE FROM shop_items WHERE id = ?').run(itemId);
}

function getInventory(guildId, userId) {
  return db
    .prepare(
      `SELECT i.item_id, i.quantity, s.name, s.description, s.role_id, s.price
       FROM inventory i JOIN shop_items s ON s.id = i.item_id
       WHERE i.guild_id = ? AND i.user_id = ?`
    )
    .all(guildId, userId);
}

/** Buy a shop item. Returns the item or an error. */
async function buyItem(guildId, userId, member, itemId) {
  const item = db.prepare('SELECT * FROM shop_items WHERE guild_id = ? AND id = ?').get(guildId, itemId);
  if (!item) return { error: 'Item not found.' };

  const balance = getBalance(guildId, userId).balance;
  if (balance < item.price) return { error: `Insufficient balance. You need **${item.price}** but have **${balance}**.` };

  changeBalance(guildId, userId, -item.price);

  // Role purchase: grant directly, don't store an inventory entry.
  if (item.role_id) {
    const role = member.guild.roles.cache.get(item.role_id);
    if (!role) {
      changeBalance(guildId, userId, item.price);
      return { error: 'The role for this item no longer exists (refunded).' };
    }
    if (member.roles.cache.has(item.role_id)) {
      changeBalance(guildId, userId, item.price);
      return { error: 'You already own this role (refunded).' };
    }
    await member.roles.add(role, 'Aether shop purchase');
    return { item, type: 'role' };
  }

  db.prepare(
    `INSERT INTO inventory (guild_id, user_id, item_id, quantity) VALUES (?, ?, ?, 1)
     ON CONFLICT(guild_id, user_id, item_id) DO UPDATE SET quantity = quantity + 1`
  ).run(guildId, userId, item.id);
  return { item, type: 'inventory' };
}

module.exports = {
  DEFAULT_CONFIG,
  getConfig,
  setConfig,
  getBalance,
  changeBalance,
  claimDaily,
  work,
  transfer,
  getShop,
  addShopItem,
  removeShopItem,
  getInventory,
  buyItem,
};
