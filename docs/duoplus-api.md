# DuoPlus API — mappa di riferimento

- **Base:** `https://openapi.duoplus.net` · **Auth:** header `DuoPlus-API-Key` · tutto **POST + JSON**
- **Envelope:** `{ code, data, message }` — `200` ok, `401` re-login. Nessuna tabella errori completa documentata.
- **Rate limit:** 1 richiesta/sec per endpoint. Paginazione: `page`/`pagesize` (max 100), risposta `total`/`total_page`.
- Header opzionale `Lang`: zh|zh-TW|en|ru.

## Cloud Phone
- `cloudPhone/list` — lista (filtri: name, group_id, link_status[], …)
- `cloudPhone/status` — `image_ids[]` → stati (0 non config,1 acceso,2 spento,3 scaduto,4 rinnovo,10 accensione,11 config,12 fallita)
- `cloudPhone/info` — `image_id` → dettaglio completo (proxy, gps, locale, sim, device fingerprint imei/android_id/gaid…)
- `cloudPhone/powerOn` (≤100, **avvia fatturazione temporanea**), `cloudPhone/powerOff` (≤20), `cloudPhone/restart` (≤20)
- `cloudPhone/update` — modifica params (name, proxy, locale, sim, device, wifi…)
- `cloudPhone/initProxy` — config iniziale proxy+fingerprint (image_id, ip_scan_channel ip2location|ipapi, proxy{id|host,port,user,password}, brand/model, network_mode, sim, locale)
- `cloudPhone/newPhone` — reset/re-roll device (data_type 1 reinstall/2-3 clear app, keep_gp)
- `cloudPhone/command` — esegue ADB (`image_ids[]`|`image_id` + `command`, <10s)
- `cloudPhone/openAdb`/`closeAdb`/`setAdbIpWhitelist`/`batchRoot`
- `cloudPhone/share` — link condivisione con permessi
- `cloudPhone/live` — usa un MP4 come feed camera
- `cloudPhone/purchase` — **acquista device** (`os` 10|11|12A|12B|15|15pro, `duration` 7/30/90/180/360, `quantity`) → `order_id`
- Risorse: `mobile/modelList` (os→brand→model), `mobile/timezoneList` (iso), `mobile/languageList`

## Proxy
- `proxy/list`, `proxy/add` (`proxy_list[]` {protocol **socks5**, host, port, user, password, name}; ip_scan_channel), `proxy/delete`, `proxy/refresh`, `proxy/update`, `proxy/check` (test + geo IP)

## Gruppi
- `cloudPhone/groupList`, `cloudPhone/createGroup`, `cloudPhone/updateGroup`, `cloudPhone/deleteGroup`, `cloudPhone/addToGroup` ({id, image_ids[]}), `cloudPhone/moveToGroup`

## App
- `app/list` (catalogo {id, name, pkg, version_list[{id,name}]}), `app/teamList`
- `app/install` (`image_ids[]`, `app_id`, `app_version_id?`), `app/installedList` (`image_id` → pkg[]), `app/uninstall`/`start`/`stop` (`image_ids[]`, `pkg`)

## Cloud Drive (media → telefono)
- `cloudDisk/signedUrl` (step1: {name con estensione, is_app?, pkg?} → signedUrl) + **PUT** del file allo signedUrl (step2)
- `cloudDisk/list`, `cloudDisk/pushFiles` ({ids[] file, image_ids[] phone, dest_dir es. /sdcard/Download}), `cloudDisk/delFiles`

## Automation / RPA
- Modello: **task = template applicato a N telefoni** con config per-telefono + orario. I template **custom si creano in console** (non via API), poi referenziati per `template_id`.
- `automation/officialTemplateList` (es. "TikTok Auto Comment", "Reddit Account Warming"), `automation/userTemplateList`
- `automation/addTask` (one-shot: template_id, template_type 1 official/2 custom, name, images[{image_id, config, issue_at}])
- `automation/addPlan` (ricorrente: images[{image_id, config, start_at, end_at, execute_type 1 interval/2 daily/3 weekly/4 monthly, gap_time, execute_time, mode, weeks, days}])
- `automation/planList`/`savePlan`/`setPlanStatus` (0 pausa/1 esegui)/`deletePlan`
- `automation/taskList`/`taskLogList` (log per step: action START/OPEN_APP/CLICK_ELEMENT…, screenshot, dati estratti)/`updateTaskTime`/`setTaskStatus`
- Vocabolario step (nei template custom): OPEN_APP, CLICK_ELEMENT/COORDINATE, INPUT_CONTENT, SLIDE_PAGE, WAIT_TIME/WAIT_FOR_SELECTOR, GET_*/TEXT_EXTRACTION, IF_CONDITION/FOR_TIMES/FOR_DATA, UPLOAD_FILE, EXECUTE_ADB, GET_EMAIL/OUTLOOK_EMAIL, INSTALL_APP… (no verbi "like/follow/post" pronti: si compongono).
- **AI Agent**: solo da UI/console, NON via API.

## CloudNumber (registrazione/verifica account)
- `cloudNumber/numberList`, `cloudNumber/smsList` (`number_id` → {message, **code** estratto, received_at}), `cloudNumber/package` (region ISO, type 0 VOIP/1 non-VOIP → durate disponibili), `cloudNumber/purchase` (region, duration, type, quantity), `cloudNumber/renewalPackage`/`renewal`, `cloudNumber/imageWriteSms` (inietta SMS nel device, solo Android 15 / 12 Region A)

## Subscription / Team
- `subscriptionStartup/list`/`purchase` ($16,9/mese flat, avvii illimitati)/`renewal`
- `team/order` (storico ordini/spesa)

## Note operative
- **Creare account social non è un endpoint**: si fa con cloud phone + app + CloudNumber (SMS) + RPA (template di registrazione). 
- **Pubblicazione**: o nativa via RPA (push media con cloudDisk + app/start + template post) o — meglio — via **API ufficiale Upload-Post** (già integrata in ShortFlow).
