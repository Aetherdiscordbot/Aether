-- Aether bridge: client side.
-- Handles anything that must run on the player's machine (spectate etc.).

RegisterNetEvent('aether:spectate')
AddEventHandler('aether:spectate', function(targetId)
  local targetPed = GetPlayerPed(targetId)
  NetworkSetInSpectatorMode(true, targetPed)
end)

RegisterNetEvent('aether:spectate:stop')
AddEventHandler('aether:spectate:stop', function()
  NetworkSetInSpectatorMode(false)
end)
