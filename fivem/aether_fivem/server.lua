-- Aether bridge: server side.
--
-- Talks to the Aether Discord bot over HTTPS:
--   GET  /fivem/config     fetch guild config (poll interval, framework, etc.)
--   POST /fivem/heartbeat  report player count + list (every poll)
--   GET  /fivem/commands   pick up queued commands (announce, kick, ...)
--   POST /fivem/ack        confirm a queued command ran
--   POST /fivem/verify     Discord link /verify <code>
--
-- Everything is authenticated with Config.Secret, so the bot ignores calls
-- from unknown servers.

local BOT_URL = 'https://aether.ocrp.cc'
local GuildId, HeartbeatUrl, ConfigUrl, CommandsUrl, AckUrl, VerifyUrl
local LastBeat = 0

local function buildUrls()
  local q = ('?secret=%s&guild=%s'):format(Config.Secret, GuildId)
  HeartbeatUrl = BOT_URL .. '/fivem/heartbeat'
  ConfigUrl = BOT_URL .. '/fivem/config' .. q
  CommandsUrl = BOT_URL .. '/fivem/commands' .. q
  AckUrl = BOT_URL .. '/fivem/ack' .. q
  VerifyUrl = BOT_URL .. '/fivem/verify'
end

local function post(url, payload, cb)
  PerformHttpRequest(url, function(status, body)
    if status ~= 200 then
      print(('[aether] request to %s failed (HTTP %s)'):format(url, tostring(status)))
    elseif cb then
      cb(body)
    end
  end, 'POST', json.encode(payload), { ['Content-Type'] = 'application/json' })
end

local function get(url, cb)
  PerformHttpRequest(url, function(status, body)
    if status ~= 200 then
      print(('[aether] GET %s failed (HTTP %s)'):format(url, tostring(status)))
    elseif cb then
      cb(body)
    end
  end, 'GET', '', { ['Content-Type'] = 'application/json' })
end

-- Fetch guild config from the bot (poll interval, framework, etc.)
local function fetchConfig(cb)
  get(ConfigUrl, function(body)
    local ok, data = pcall(json.decode, body)
    if ok and data then
      GuildId = data.guildId or GuildId
      if data.pollInterval then Config.PollInterval = data.pollInterval end
      if data.framework then Config.Framework = data.framework end
      if data.verifiedRole then Config.VerifiedRole = data.verifiedRole end
      if data.announceChannel then Config.AnnounceChannel = data.announceChannel end
      if data.playerFeedChannel then Config.PlayerFeedChannel = data.playerFeedChannel end
      print(('[aether] Config loaded: poll=%s framework=%s'):format(Config.PollInterval, Config.Framework))
    end
    if cb then cb() end
  end)
end

-- ── Player snapshot ────────────────────────────────────────────────────
local function playerSnapshot()
  local players = {}
  for _, playerId in ipairs(GetPlayers()) do
    local license, discord = nil, nil
    for _, id in ipairs(GetPlayerIdentifiers(playerId)) do
      if id:match('^license:') then license = id:sub(9) end
      if id:match('^discord:') then discord = id:sub(9) end
    end
    table.insert(players, {
      id = playerId,
      name = GetPlayerName(playerId),
      ping = GetPlayerPing(playerId),
      connected = GetPlayerTime(playerId),
      license = license,
      discord = discord,
    })
  end
  return players
end

-- ── Commands from the bot ──────────────────────────────────────────────
local function givePlayerVehicle(playerId, model)
  local ped = GetPlayerPed(playerId)
  if not IsPedInAnyVehicle(ped, false) then
    RequestModel(model)
    local deadline = GetGameTimer() + 3000
    while not HasModelLoaded(model) and GetGameTimer() < deadline do
      Wait(50)
    end
    if HasModelLoaded(model) then
      local veh = CreateVehicle(model, GetEntityCoords(ped), GetEntityHeading(ped), true, false)
      SetPedIntoVehicle(ped, veh, -1)
      return true
    end
  end
  return false
end

local function economyJob(action, playerId, amount)
  if Config.Framework == 'qbcore' then
    local Player = exports['qb-core']:GetPlayerObject(playerId)
    if Player then
      if action == 'add' then Player.Functions.AddMoney('bank', amount, 'aether')
      else Player.Functions.RemoveMoney('bank', amount, 'aether') end
      return true
    end
  elseif Config.Framework == 'esx' then
    local xPlayer = exports['es_extended']:getSharedObject().GetPlayerFromId(playerId)
    if xPlayer then
      local account = xPlayer.getAccount('bank')
      if account then
        if action == 'add' then account.addMoney(amount)
        else account.removeMoney(amount) end
        return true
      end
    end
  end
  return false
end

local function sendChat(target, text)
  TriggerClientEvent('chat:addMessage', target, {
    color = { 139, 92, 246 },
    args = { 'Aether', text },
  })
end

-- command handlers receive (args, fromId)
local CommandHandlers = {
  announce = function(args)
    local msg = args.message or 'Server announcement'
    TriggerClientEvent('chat:addMessage', -1, {
      color = { 139, 92, 246 },
      multiline = true,
      args = { 'AETHER', msg },
    })
    return true
  end,

  kick = function(args)
    local playerId = tonumber(args.playerId)
    if playerId and GetPlayerName(playerId) then
      DropPlayer(playerId, args.reason or 'Kicked by staff')
      return true
    end
    return false
  end,

  heal = function(args)
    local playerId = tonumber(args.playerId)
    if playerId and GetPlayerPed(playerId) then
      SetEntityHealth(GetPlayerPed(playerId), 200)
      return true
    end
    return false
  end,

  revive = function(args)
    local playerId = tonumber(args.playerId)
    local ped = GetPlayerPed(playerId)
    if playerId and ped then
      SetEntityHealth(ped, 200)
      ClearPedTasksImmediately(ped)
      SetPedToRagdoll(ped, 0, 0, 0, 0, 0, false)
      return true
    end
    return false
  end,

  freeze = function(args)
    local playerId = tonumber(args.playerId)
    if playerId and GetPlayerPed(playerId) then
      FreezeEntityPosition(GetPlayerPed(playerId), args.toggle == 'true' or args.toggle == true)
      return true
    end
    return false
  end,

  teleport = function(args)
    local playerId = tonumber(args.playerId)
    local x, y, z = tonumber(args.x), tonumber(args.y), tonumber(args.z)
    if playerId and x and y and z then
      SetEntityCoords(GetPlayerPed(playerId), x, y, z, false, false, false, false)
      return true
    end
    return false
  end,

  goto = function(args)
    local playerId = tonumber(args.playerId)
    local targetId = tonumber(args.targetId)
    if playerId and targetId and GetPlayerPed(targetId) then
      SetEntityCoords(GetPlayerPed(playerId), GetEntityCoords(GetPlayerPed(targetId)), false, false, false, false)
      return true
    end
    return false
  end,

  bring = function(args)
    local playerId = tonumber(args.playerId)
    local sourceId = tonumber(args.fromId)
    if playerId and sourceId and GetPlayerPed(sourceId) then
      SetEntityCoords(GetPlayerPed(playerId), GetEntityCoords(GetPlayerPed(sourceId)), false, false, false, false)
      return true
    end
    return false
  end,

  spectate = function(args)
    local playerId = tonumber(args.playerId)
    local targetId = tonumber(args.targetId)
    if playerId and targetId and GetPlayerPed(targetId) then
      TriggerClientEvent('aether:spectate', playerId, targetId)
      return true
    end
    return false
  end,

  money = function(args)
    local playerId = tonumber(args.playerId)
    local amount = tonumber(args.amount)
    if not (playerId and amount) then return false end
    local ok = economyJob(args.action or 'add', playerId, amount)
    if not ok then
      print(('[aether] money %s failed for player %s (framework %q)'):format(args.action or 'add', playerId, Config.Framework))
    end
    return ok
  end,

  vehicle = function(args)
    local playerId = tonumber(args.playerId)
    local model = args.model and tonumber(args.model) or GetHashKey(tostring(args.model or 'adder'))
    if not playerId then return false end
    if args.action == 'spawn' then return givePlayerVehicle(playerId, model) end
    local ped = GetPlayerPed(playerId)
    local veh = GetVehiclePedIsIn(ped, false)
    if not veh then veh = GetVehiclePedIsIn(ped, true) end
    if not veh then return false end
    if args.action == 'delete' then DeleteVehicle(veh); return true end
    if args.action == 'fix' then SetVehicleFixed(veh); SetVehicleDirtLevel(veh, 0); return true end
    if args.action == 'fuel' then
      if GetVehicleFuelLevel then SetVehicleFuelLevel(veh, 100) end
      return true
    end
    return false
  end,
}

local function runCommand(cmd)
  local handler = CommandHandlers[cmd.type]
  local ok = handler and handler(cmd.args or {}, cmd.fromId)
  post(AckUrl .. '&id=' .. tostring(cmd.id), { ok = ok == true })
end

local function pollCommands()
  get(CommandsUrl, function(body)
    if not body then return end
    local ok, data = pcall(json.decode, body)
    if ok and type(data) == 'table' then
      for _, cmd in ipairs(data) do
        runCommand(cmd)
      end
    end
  end)
end

-- ── Discord verify /verify <code> ──────────────────────────────────────
local function onVerify(source, args)
  local code = tostring(args[1] or ''):match('^%s*(.-)%s*$')
  if code == '' then
    sendChat(source, 'Usage: /' .. Config.VerifyCommand .. ' <code> — get the code with /verify in Discord.')
    return
  end
  local license = nil
  for _, id in ipairs(GetPlayerIdentifiers(source)) do
    if id:match('^license:') then license = id:sub(9) break end
  end
  post(VerifyUrl, {
    secret = Config.Secret,
    code = code,
    license = license,
    playerId = source,
    name = GetPlayerName(source),
  }, function(body)
    local ok, data = pcall(json.decode, body)
    if ok and data.ok then
      sendChat(source, ('Discord linked to %s. Welcome!'):format(data.name or 'your account'))
    else
      local msg = data and data.error or 'That code is invalid or expired.'
      sendChat(source, ('Link failed: %s'):format(msg))
    end
  end)
end

RegisterCommand(Config.VerifyCommand, onVerify, false)

-- ── Poll loop + heartbeat ──────────────────────────────────────────────
Citizen.CreateThread(function()
  Wait(2000)
  if Config.Secret == 'REPLACE_ME' then
    print('^3[aether]^0 Config.Secret is still REPLACE_ME — set it in config.lua!')
    return
  end
  buildUrls()
  fetchConfig(function()
    if not GuildId then
      print('^3[aether]^0 Failed to fetch guild config from bot. Check secret and bot availability.')
      return
    end
    print(('[aether] Connected to guild %s'):format(GuildId))
    SetInterval(function()
      post(HeartbeatUrl, { secret = Config.Secret, guild = GuildId, players = playerSnapshot() })
      pollCommands()
    end, math.max(3, tonumber(Config.PollInterval) or 5) * 1000)
  end)
end)
